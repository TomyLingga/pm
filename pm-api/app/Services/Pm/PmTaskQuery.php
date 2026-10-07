<?php

namespace App\Services\Pm;

use App\Enums\PmTaskStatus;
use App\Models\PmTask;
use App\Models\User;
use App\Services\Org\ExecutorDirectory;
use App\Support\EndedPeriodFilter;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Builder;

/** Filtered PM task query shared by the list, the Excel export, the summary and the calendar. */
class PmTaskQuery
{
    public const SCOPES = ['mine', 'unit', 'all'];

    public const FINAL_STATUSES = ['completed', 'skipped'];

    public function __construct(private ExecutorDirectory $directory)
    {
    }

    public function build(User $user, array $filters): Builder
    {
        $query = $this->scoped($user, $filters['scope'] ?? 'mine');

        if (! empty($filters['status'])) {
            $query->whereIn('status', array_filter(explode(',', $filters['status'])));
        }
        foreach (['executor_unit_id', 'equipment_id', 'pic_user_id'] as $field) {
            if (! empty($filters[$field])) {
                $query->where($field, $filters[$field]);
            }
        }
        if (! empty($filters['schedule_id'])) {
            $query->where('pm_schedule_id', $filters['schedule_id']);
        }
        if (! empty($filters['due_from'])) {
            $query->whereDate('due_at', '>=', $filters['due_from']);
        }
        if (! empty($filters['due_to'])) {
            $query->whereDate('due_at', '<=', $filters['due_to']);
        }
        // Period for finished tasks only (selesai / dilewati, by the date they ended);
        // scheduled, due, overdue and in-progress tasks are always listed.
        EndedPeriodFilter::apply($query, self::FINAL_STATUSES, ['completed_at', 'skipped_at'],
            $filters['from'] ?? null, $filters['to'] ?? null);
        if (! empty($filters['q'])) {
            $term = '%'.mb_strtolower(trim($filters['q'])).'%';
            $query->where(fn (Builder $q) => $q
                ->whereHas('equipment', fn (Builder $e) => $e->where(fn (Builder $w) => $w
                    ->whereRaw('LOWER(code) LIKE ?', [$term])->orWhereRaw('LOWER(name) LIKE ?', [$term])))
                ->orWhereHas('schedule', fn (Builder $s) => $s->whereRaw('LOWER(name) LIKE ?', [$term])));
        }

        return ($filters['sort'] ?? 'due_at') === '-due_at'
            ? $query->orderByDesc('due_at')->orderByDesc('id')
            : $query->orderBy('due_at')->orderBy('id');
    }

    /** `mine` = I am the PIC, `unit` = my executor units, `all` = admin/management. */
    public function scoped(User $user, string $scope): Builder
    {
        $query = PmTask::query();

        return match ($scope) {
            'unit' => $query->whereIn('executor_unit_id', $this->directory->unitIdsFor($user) ?: [0]),
            'all' => $user->canSeeEverything()
                ? $query
                : throw new AuthorizationException('Hanya admin yang dapat melihat semua tugas PM.'),
            default => $query->where('pic_user_id', $user->id),
        };
    }

    /** @return array{due: int, overdue: int, in_progress: int} */
    public function counts(User $user, string $scope): array
    {
        $counts = $this->scoped($user, $scope)
            ->whereIn('status', [PmTaskStatus::Due->value, PmTaskStatus::Overdue->value, PmTaskStatus::InProgress->value])
            ->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');

        return [
            'due' => (int) ($counts['due'] ?? 0),
            'overdue' => (int) ($counts['overdue'] ?? 0),
            'in_progress' => (int) ($counts['in_progress'] ?? 0),
        ];
    }
}
