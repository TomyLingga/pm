<?php

namespace App\Services\WorkOrders;

use App\Enums\WorkOrderStatus;
use App\Models\User;
use App\Models\WorkOrder;
use App\Services\Org\ExecutorDirectory;
use App\Support\EndedPeriodFilter;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Builder;

/**
 * Builds the filtered Work Order query shared by the list endpoint and the Excel export.
 */
class WorkOrderQuery
{
    public const SCOPES = ['mine', 'unit', 'pool', 'assigned', 'executor', 'all'];

    public const FINAL_STATUSES = ['closed', 'cancelled', 'converted'];

    public function __construct(private ExecutorDirectory $directory)
    {
    }

    public function build(User $user, array $filters): Builder
    {
        $query = WorkOrder::query();
        $this->applyScope($query, $user, $filters['scope'] ?? 'mine');

        if (! empty($filters['status'])) {
            $query->whereIn('status', array_filter(explode(',', $filters['status'])));
        }
        foreach (['executor_unit_id', 'priority', 'service_category_id', 'location_id', 'equipment_id'] as $field) {
            if (! empty($filters[$field])) {
                $query->where($field, $filters[$field]);
            }
        }
        if (! empty($filters['issued_from'])) {
            $query->whereDate('issued_at', '>=', $filters['issued_from']);
        }
        if (! empty($filters['issued_to'])) {
            $query->whereDate('issued_at', '<=', $filters['issued_to']);
        }
        // Period for finished WOs only (closed / cancelled / converted, by the date they ended);
        // WOs still running (submitted, received, in progress, completed) are always listed.
        EndedPeriodFilter::apply($query, self::FINAL_STATUSES, ['closed_at', 'cancelled_at', 'converted_at'],
            $filters['from'] ?? null, $filters['to'] ?? null);
        if (! empty($filters['q'])) {
            $term = '%'.mb_strtolower(trim($filters['q'])).'%';
            $query->where(function (Builder $q) use ($term) {
                foreach (['wo_number', 'request_description', 'equipment_code', 'equipment_name'] as $column) {
                    $q->orWhereRaw("LOWER({$column}) LIKE ?", [$term]);
                }
            });
        }

        return $this->applySort($query, $filters['sort'] ?? '-issued_at');
    }

    private function applyScope(Builder $query, User $user, string $scope): void
    {
        $executorIds = fn () => $this->directory->unitsFor($user)->pluck('id')->all() ?: [0];

        match ($scope) {
            'mine' => $query->where('requester_id', $user->id),
            'unit' => $query->where('requester_org_unit_id', $user->org_unit_id ?? 0),
            'pool' => $query->where('status', WorkOrderStatus::Submitted->value)->whereIn('executor_unit_id', $executorIds()),
            'assigned' => $query->whereHas('activeAssignments', fn (Builder $q) => $q->where('user_id', $user->id)),
            'executor' => $query->whereIn('executor_unit_id', $executorIds()),
            'all' => $user->canSeeEverything() ? null : throw new AuthorizationException('Hanya admin yang dapat melihat semua WO.'),
        };
    }

    private function applySort(Builder $query, string $sort): Builder
    {
        return match ($sort) {
            'issued_at' => $query->orderBy('issued_at')->orderBy('id'),
            '-priority' => $query->orderByRaw("CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END")->orderByDesc('issued_at'),
            default => $query->orderByDesc('issued_at')->orderByDesc('id'),
        };
    }
}
