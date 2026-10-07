<?php

namespace App\Services\Activities;

use App\Enums\DailyActivityStatus;
use App\Models\DailyActivity;
use App\Models\User;
use App\Models\WorkOrder;
use App\Models\WorkProgramActivity;
use App\Services\Audit\StatusLogger;
use App\Services\Org\OrgVisibility;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/** Aktivitas Harian: one report per person per piece of work, with a status trail. */
class DailyActivityService
{
    public const SCOPES = ['mine', 'team', 'all'];

    public function __construct(private OrgVisibility $visibility, private StatusLogger $logger)
    {
    }

    /** `mine` = my reports, `team` = everyone in my subtree (leads), `all` = admin. */
    public function scoped(User $user, string $scope): Builder
    {
        $query = DailyActivity::query();

        return match ($scope) {
            'team' => $this->visibility->isLead($user)
                ? $query->where(fn (Builder $q) => $q
                    ->whereIn('org_unit_id', $this->visibility->subtreeIds($user) ?: [0])
                    ->orWhere('user_id', $user->id))
                : throw new AuthorizationException('Hanya pimpinan yang dapat melihat aktivitas tim.'),
            'all' => $user->isAdmin() ? $query : throw new AuthorizationException('Hanya admin yang dapat melihat semua aktivitas.'),
            default => $query->where('user_id', $user->id),
        };
    }

    public function filtered(User $user, array $filters): Builder
    {
        $query = $this->scoped($user, $filters['scope'] ?? 'mine');

        // The period only narrows closed reports (by activity date); open / on-progress ones are always
        // listed, the same rule as the WO / Form Request / PM lists.
        [$from, $to] = $this->period($filters);
        if ($from || $to) {
            $closed = DailyActivityStatus::Closed->value;
            $query->where(fn (Builder $q) => $q
                ->where('status', '!=', $closed)
                ->orWhere(function (Builder $finished) use ($closed, $from, $to) {
                    $finished->where('status', $closed);
                    if ($from) {
                        $finished->whereDate('activity_date', '>=', $from);
                    }
                    if ($to) {
                        $finished->whereDate('activity_date', '<=', $to);
                    }
                }));
        }
        if (! empty($filters['week'])) {
            $week = (int) $filters['week'];
            $query->whereRaw('LEAST(5, ((EXTRACT(DAY FROM activity_date)::int - 1) / 7) + 1) = ?', [$week]);
        }
        if (! empty($filters['status'])) {
            $query->whereIn('status', array_filter(explode(',', $filters['status'])));
        }
        if (! empty($filters['user_id'])) {
            $query->where('user_id', $filters['user_id']);
        }
        if (! empty($filters['work_program_activity_id'])) {
            $query->where('work_program_activity_id', $filters['work_program_activity_id']);
        }
        if (! empty($filters['q'])) {
            $term = '%'.mb_strtolower(trim($filters['q'])).'%';
            $query->where(fn (Builder $q) => $q
                ->whereRaw('LOWER(title) LIKE ?', [$term])
                ->orWhereRaw('LOWER(description) LIKE ?', [$term])
                ->orWhereHas('user', fn (Builder $u) => $u->whereRaw('LOWER(name) LIKE ?', [$term])));
        }

        return $query;
    }

    /** @return array{0: ?string, 1: ?string} inclusive date bounds from month/year or from/to (applied to closed reports only) */
    public function period(array $filters): array
    {
        if (! empty($filters['from']) || ! empty($filters['to'])) {
            return [$filters['from'] ?? null, $filters['to'] ?? null];
        }
        if (! empty($filters['month']) && ! empty($filters['year'])) {
            $start = Carbon::create((int) $filters['year'], (int) $filters['month'], 1);

            return [$start->toDateString(), $start->copy()->endOfMonth()->toDateString()];
        }
        if (! empty($filters['year'])) {
            return ["{$filters['year']}-01-01", "{$filters['year']}-12-31"];
        }

        return [null, null];
    }

    /** @return array{total: int, open: int, on_progress: int, closed: int} */
    public function summary(Builder $query): array
    {
        $counts = (clone $query)->toBase()->selectRaw('status, count(*) as n')->groupBy('status')->pluck('n', 'status');

        return [
            'total' => (int) $counts->sum(),
            'open' => (int) ($counts['open'] ?? 0),
            'on_progress' => (int) ($counts['on_progress'] ?? 0),
            'closed' => (int) ($counts['closed'] ?? 0),
        ];
    }

    /** @param  string|null  $notes  recorded on the `create` log entry (e.g. "Diimpor dari Excel") */
    public function create(User $by, array $data, ?string $notes = null): DailyActivity
    {
        return DB::transaction(function () use ($by, $data, $notes) {
            $pic = ! empty($data['user_id']) ? User::query()->findOrFail($data['user_id']) : $by;
            $this->assertProgramActivity($pic, $data['work_program_activity_id'] ?? null);

            $activity = DailyActivity::query()->create([
                'user_id' => $pic->id,
                'org_unit_id' => $pic->org_unit_id,
                'work_program_activity_id' => $data['work_program_activity_id'] ?? null,
                'activity_date' => $data['activity_date'],
                'title' => trim($data['title']),
                'description' => $data['description'],
                'follow_up' => $data['follow_up'] ?? null,
                'obstacles' => $data['obstacles'] ?? null,
                'status' => $data['status'] ?? DailyActivityStatus::Open->value,
                'closed_at' => ($data['status'] ?? null) === DailyActivityStatus::Closed->value ? now() : null,
                'created_by_id' => $by->id,
            ]);
            $this->logger->log($activity, 'create', null, $activity->status, $by, $notes);

            return $activity;
        });
    }

    /**
     * A completed Work Order becomes a closed daily report for every technician still assigned to it
     * (or for the one completing it). Called inside WorkOrderService::complete()'s transaction; idempotent per technician.
     */
    public function createFromWorkOrder(WorkOrder $workOrder, User $by): void
    {
        $technicians = $workOrder->activeAssignments()->with('user')->get()->pluck('user')->filter()->values();
        if ($technicians->isEmpty()) {
            $technicians = collect([$by]);
        }
        $completedAt = $workOrder->completed_at ?? now();
        $subject = trim((string) ($workOrder->equipment_name ?: $workOrder->request_description));
        $title = Str::limit("{$workOrder->wo_number}: {$subject}", 250, ''); // wo_number already starts with "WO/"
        $description = 'Permintaan: '.trim((string) $workOrder->request_description)."\n\nPekerjaan: ".trim((string) $workOrder->work_done);

        foreach ($technicians as $technician) {
            if (DailyActivity::query()->where('work_order_id', $workOrder->id)->where('user_id', $technician->id)->exists()) {
                continue;
            }
            $activity = DailyActivity::query()->create([
                'user_id' => $technician->id,
                'org_unit_id' => $technician->org_unit_id,
                'work_order_id' => $workOrder->id,
                'activity_date' => $completedAt->toDateString(),
                'title' => $title,
                'description' => $description,
                'follow_up' => filled($workOrder->remarks) ? $workOrder->remarks : null,
                'status' => DailyActivityStatus::Closed->value,
                'closed_at' => $completedAt,
                'created_by_id' => $by->id,
            ]);
            $this->logger->log($activity, 'create', null, $activity->status, $by, "Otomatis dari penyelesaian Work Order {$workOrder->wo_number}.");
        }
    }

    public function update(DailyActivity $activity, User $by, array $data): DailyActivity
    {
        return DB::transaction(function () use ($activity, $by, $data) {
            if (array_key_exists('work_program_activity_id', $data)) {
                $this->assertProgramActivity($activity->user, $data['work_program_activity_id']);
                $activity->work_program_activity_id = $data['work_program_activity_id'];
            }
            foreach (['activity_date', 'title', 'description', 'follow_up', 'obstacles'] as $field) {
                if (array_key_exists($field, $data)) {
                    $activity->{$field} = $field === 'title' ? trim($data[$field]) : $data[$field];
                }
            }
            $activity->save();
            $this->logger->log($activity, 'update', $activity->status, $activity->status, $by);

            return $activity;
        });
    }

    public function setStatus(DailyActivity $activity, User $by, string $status, ?string $notes = null): DailyActivity
    {
        return DB::transaction(function () use ($activity, $by, $status, $notes) {
            $from = $activity->status;
            $to = DailyActivityStatus::from($status);
            if ($from === $to) {
                throw ValidationException::withMessages(['status' => ['Status tidak berubah.']]);
            }
            $activity->status = $to;
            $activity->closed_at = $to === DailyActivityStatus::Closed ? now() : null;
            $activity->save();
            $this->logger->log($activity, 'status', $from, $to, $by, $notes);

            return $activity;
        });
    }

    public function delete(DailyActivity $activity, User $by): void
    {
        DB::transaction(function () use ($activity, $by) {
            $this->logger->log($activity, 'delete', $activity->status, $activity->status, $by);
            $activity->delete();
        });
    }

    /** A report may only be linked to a programme activity the PIC can see. */
    private function assertProgramActivity(User $pic, ?int $programActivityId): void
    {
        if (! $programActivityId) {
            return;
        }
        $activity = WorkProgramActivity::query()->with('item.program')->find($programActivityId);
        if (! $activity || ! ($this->visibility->canSeeUnit($pic, $activity->item->program->org_unit_id) || $activity->isPic($pic))) {
            throw ValidationException::withMessages(['work_program_activity_id' => ['Kegiatan program kerja tidak ditemukan atau tidak dapat diakses.']]);
        }
    }
}
