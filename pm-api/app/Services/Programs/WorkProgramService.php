<?php

namespace App\Services\Programs;

use App\Enums\WorkProgramActivityStatus;
use App\Models\OrgUnit;
use App\Models\User;
use App\Models\WorkProgram;
use App\Models\WorkProgramActivity;
use App\Models\WorkProgramItem;
use App\Notifications\DocumentNotification;
use App\Services\Audit\StatusLogger;
use App\Services\Org\OrgVisibility;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;

/** Program Kerja Tahunan: programmes → sub-items → activities with PICs, every change logged. */
class WorkProgramService
{
    public function __construct(private OrgVisibility $visibility, private StatusLogger $logger)
    {
    }

    /** Programmes the user may see: own branch of the org tree, plus anything they are PIC of. */
    public function visible(User $user): Builder
    {
        $query = WorkProgram::query();
        if ($user->isAdmin()) {
            return $query;
        }

        return $query->where(fn (Builder $q) => $q
            ->whereIn('org_unit_id', $this->visibility->chainIds($user) ?: [0])
            ->orWhereHas('items.activities.pics', fn (Builder $p) => $p->where('users.id', $user->id)));
    }

    /** Org units the user may create programmes for (leads: own unit and everything below; admins: all). */
    public function manageableUnits(User $user): Builder
    {
        $query = OrgUnit::query()->where('is_active', true)->orderBy('type')->orderBy('name');
        if ($user->isAdmin()) {
            return $query;
        }
        if (! $this->visibility->isLead($user)) {
            return $query->whereRaw('1 = 0');
        }

        return $query->whereIn('id', $this->visibility->subtreeIds($user) ?: [0]);
    }

    public function create(User $by, array $data): WorkProgram
    {
        return DB::transaction(function () use ($by, $data) {
            $this->assertUniqueCode((int) $data['year'], (int) $data['org_unit_id'], $data['code']);
            $program = WorkProgram::query()->create([
                'year' => $data['year'],
                'code' => strtoupper(trim($data['code'])),
                'title' => trim($data['title']),
                'description' => $data['description'] ?? null,
                'org_unit_id' => $data['org_unit_id'],
                'status' => WorkProgram::STATUS_ACTIVE,
                'created_by_id' => $by->id,
            ]);
            $this->logger->log($program, 'create', null, $program->status, $by);

            return $program;
        });
    }

    public function update(WorkProgram $program, User $by, array $data): WorkProgram
    {
        return DB::transaction(function () use ($program, $by, $data) {
            if (isset($data['code'])) {
                $this->assertUniqueCode($program->year, $program->org_unit_id, $data['code'], $program->id);
                $program->code = strtoupper(trim($data['code']));
            }
            foreach (['title', 'description'] as $field) {
                if (array_key_exists($field, $data)) {
                    $program->{$field} = $field === 'title' ? trim($data[$field]) : $data[$field];
                }
            }
            $from = $program->status;
            if (! empty($data['status']) && $data['status'] !== $from) {
                $program->status = $data['status'];
                $program->save();
                $this->logger->log($program, $data['status'] === WorkProgram::STATUS_CLOSED ? 'close' : 'reopen', $from, $program->status, $by);
            } else {
                $program->save();
                $this->logger->log($program, 'update', $from, $from, $by);
            }

            return $program;
        });
    }

    public function delete(WorkProgram $program, User $by): void
    {
        DB::transaction(function () use ($program, $by) {
            $this->logger->log($program, 'delete', $program->status, $program->status, $by);
            $program->delete();
        });
    }

    // ── Items ─────────────────────────────────────────────────────────────────

    public function addItem(WorkProgram $program, User $by, array $data): WorkProgramItem
    {
        return DB::transaction(function () use ($program, $by, $data) {
            $code = strtoupper(trim($data['code']));
            if ($program->items()->whereRaw('UPPER(code) = ?', [$code])->exists()) {
                throw ValidationException::withMessages(['code' => ["Sub-item {$code} sudah ada di program ini."]]);
            }
            $item = $program->items()->create([
                'code' => $code,
                'title' => trim($data['title']),
                'description' => $data['description'] ?? null,
                'sort_order' => (int) ($program->items()->max('sort_order') ?? 0) + 1,
            ]);
            $this->logger->log($program, 'item_added', $program->status, $program->status, $by, $item->code.' '.$item->title, ['item_id' => $item->id]);

            return $item;
        });
    }

    public function updateItem(WorkProgramItem $item, User $by, array $data): WorkProgramItem
    {
        return DB::transaction(function () use ($item, $by, $data) {
            if (isset($data['code'])) {
                $code = strtoupper(trim($data['code']));
                if ($item->program->items()->whereKeyNot($item->id)->whereRaw('UPPER(code) = ?', [$code])->exists()) {
                    throw ValidationException::withMessages(['code' => ["Sub-item {$code} sudah ada di program ini."]]);
                }
                $item->code = $code;
            }
            if (isset($data['title'])) {
                $item->title = trim($data['title']);
            }
            if (array_key_exists('description', $data)) {
                $item->description = $data['description'];
            }
            $item->save();
            $this->logger->log($item->program, 'item_updated', null, null, $by, $item->code.' '.$item->title, ['item_id' => $item->id]);

            return $item;
        });
    }

    public function deleteItem(WorkProgramItem $item, User $by): void
    {
        DB::transaction(function () use ($item, $by) {
            $this->logger->log($item->program, 'item_deleted', null, null, $by, $item->code.' '.$item->title, ['item_id' => $item->id]);
            $item->delete();
        });
    }

    // ── Activities ────────────────────────────────────────────────────────────

    public function addActivity(WorkProgramItem $item, User $by, array $data): WorkProgramActivity
    {
        $activity = DB::transaction(function () use ($item, $by, $data) {
            $activity = $item->activities()->create([
                'sequence' => (int) ($item->activities()->max('sequence') ?? 0) + 1,
                'title' => trim($data['title']),
                'action_plan' => $data['action_plan'] ?? null,
                'target_date' => $data['target_date'] ?? null,
                'remarks' => $data['remarks'] ?? null,
                'status' => $data['status'] ?? WorkProgramActivityStatus::Open->value,
                'progress_pct' => $this->progressFor($data['status'] ?? 'open', $data['progress_pct'] ?? 0),
                'created_by_id' => $by->id,
            ]);
            $this->syncPics($activity, $by, $data['pics'] ?? []);
            $this->logger->log($activity, 'create', null, $activity->status, $by);

            return $activity;
        });

        $this->notifyPics($activity, $by, array_column($data['pics'] ?? [], 'user_id'));

        return $activity;
    }

    public function updateActivity(WorkProgramActivity $activity, User $by, array $data, bool $full): WorkProgramActivity
    {
        $newPics = [];
        $activity = DB::transaction(function () use ($activity, $by, $data, $full, &$newPics) {
            $before = $activity->pics->pluck('id')->map(fn ($id) => (int) $id)->all();
            if ($full) {
                foreach (['title', 'action_plan', 'target_date'] as $field) {
                    if (array_key_exists($field, $data)) {
                        $activity->{$field} = $field === 'title' ? trim($data[$field]) : $data[$field];
                    }
                }
                if (array_key_exists('pics', $data)) {
                    $this->syncPics($activity, $by, $data['pics']);
                    $newPics = array_values(array_diff(array_map('intval', array_column($data['pics'], 'user_id')), $before));
                }
            }
            if (array_key_exists('remarks', $data)) {
                $activity->remarks = $data['remarks'];
            }
            if (array_key_exists('progress_pct', $data) && ! $activity->status->isFinal()) {
                $activity->progress_pct = max(0, min(100, (int) $data['progress_pct']));
                if ($activity->progress_pct > 0 && $activity->status === WorkProgramActivityStatus::Open) {
                    $activity->status = WorkProgramActivityStatus::OnProgress;
                }
            }
            $activity->save();
            $this->logger->log($activity, 'update', $activity->status, $activity->status, $by, null, ['progress' => $activity->progress_pct]);

            return $activity;
        });

        $this->notifyPics($activity, $by, $newPics);

        return $activity;
    }

    public function setActivityStatus(WorkProgramActivity $activity, User $by, string $status, ?string $notes = null, ?string $closedDate = null): WorkProgramActivity
    {
        return DB::transaction(function () use ($activity, $by, $status, $notes, $closedDate) {
            $from = $activity->status;
            $to = WorkProgramActivityStatus::from($status);
            if ($from === $to) {
                throw ValidationException::withMessages(['status' => ['Status tidak berubah.']]);
            }
            $activity->status = $to;
            if ($to === WorkProgramActivityStatus::Closed) {
                $activity->progress_pct = 100;
                $activity->closed_date = $closedDate ? Carbon::parse($closedDate) : now()->toDateString();
            } elseif ($to === WorkProgramActivityStatus::Cancelled) {
                $activity->closed_date = $closedDate ? Carbon::parse($closedDate) : now()->toDateString();
            } else {
                $activity->closed_date = null;
                if ($to === WorkProgramActivityStatus::Open) {
                    $activity->progress_pct = 0;
                } elseif ($activity->progress_pct >= 100) {
                    $activity->progress_pct = 90;
                }
            }
            $activity->save();
            $this->logger->log($activity, 'status', $from, $to, $by, $notes);

            return $activity;
        });
    }

    public function deleteActivity(WorkProgramActivity $activity, User $by): void
    {
        DB::transaction(function () use ($activity, $by) {
            $this->logger->log($activity, 'delete', $activity->status, $activity->status, $by);
            $activity->delete();
        });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function syncPics(WorkProgramActivity $activity, User $by, array $pics): void
    {
        $sync = [];
        $utama = 0;
        foreach ($pics as $pic) {
            $role = ($pic['role'] ?? WorkProgramActivity::PIC_PENDUKUNG) === WorkProgramActivity::PIC_UTAMA ? WorkProgramActivity::PIC_UTAMA : WorkProgramActivity::PIC_PENDUKUNG;
            $utama += $role === WorkProgramActivity::PIC_UTAMA ? 1 : 0;
            $sync[(int) $pic['user_id']] = ['role' => $role];
        }
        if ($utama > 1) {
            throw ValidationException::withMessages(['pics' => ['Hanya boleh satu PIC utama.']]);
        }
        $activity->pics()->sync($sync);
        $activity->unsetRelation('pics');
    }

    private function notifyPics(WorkProgramActivity $activity, User $by, array $userIds): void
    {
        $users = User::query()->whereIn('id', $userIds)->whereKeyNot($by->id)->where('is_active', true)->get();
        if ($users->isEmpty()) {
            return;
        }
        $program = $activity->item->program;
        Notification::send($users, new DocumentNotification(
            'work_program.assigned',
            WorkProgram::MORPH_ALIAS,
            $program->id,
            'Anda ditunjuk sebagai PIC program kerja',
            "{$program->code}.{$activity->item->code} {$activity->title} ({$program->year}) oleh {$by->name}.",
        ));
    }

    private function progressFor(string $status, int $progress): int
    {
        return $status === WorkProgramActivityStatus::Closed->value ? 100 : max(0, min(100, $progress));
    }

    private function assertUniqueCode(int $year, int $orgUnitId, string $code, ?int $exceptId = null): void
    {
        $exists = WorkProgram::query()->where('year', $year)->where('org_unit_id', $orgUnitId)
            ->whereRaw('UPPER(code) = ?', [strtoupper(trim($code))])
            ->when($exceptId, fn ($q) => $q->whereKeyNot($exceptId))
            ->exists();
        if ($exists) {
            throw ValidationException::withMessages(['code' => ["Kode program {$code} sudah dipakai unit ini pada tahun {$year}."]]);
        }
    }
}
