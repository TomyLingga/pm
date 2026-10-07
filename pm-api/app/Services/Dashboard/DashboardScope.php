<?php

namespace App\Services\Dashboard;

use App\Models\PmTask;
use App\Models\ServiceRequest;
use App\Models\User;
use App\Models\WorkOrder;
use App\Services\Org\ExecutorDirectory;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Builder;

/**
 * Role-aware visibility of the dashboard (PRD §8): technicians see their own work, leads their unit,
 * management everything — plus the optional unit/location/category filters.
 */
class DashboardScope
{
    public const SCOPES = ['mine', 'unit', 'all'];

    public readonly string $scope;

    /** @var string[] */
    public readonly array $available;

    /** @var int[] executor unit ids the queries are limited to (empty = no limit) */
    private array $unitIds = [];

    public function __construct(
        private ExecutorDirectory $directory,
        public readonly User $user,
        ?string $requested,
        public readonly array $filters,
    ) {
        $myUnits = $this->directory->unitIdsFor($user);

        $available = ['mine'];
        if ($myUnits) {
            $available[] = 'unit';
        }
        if ($user->canSeeEverything()) {
            $available[] = 'all';
        }
        $this->available = $available;

        $default = 'mine';
        if ($user->canSeeEverything()) {
            $default = 'all';
        } elseif ($myUnits && $this->directory->isLeadAnywhere($user)) {
            $default = 'unit';
        }
        $scope = $requested ?: $default;
        if (! in_array($scope, $available, true)) {
            throw new AuthorizationException('Scope dashboard ini tidak tersedia untuk Anda.');
        }
        $this->scope = $scope;

        if ($scope === 'unit') {
            $this->unitIds = $myUnits;
        }
        if (! empty($filters['executor_unit_id'])) {
            $id = (int) $filters['executor_unit_id'];
            $this->unitIds = $scope === 'unit' ? array_values(array_intersect($myUnits, [$id])) ?: [0] : [$id];
        }
    }

    public function workOrders(): Builder
    {
        $query = WorkOrder::query();

        if ($this->scope === 'mine') {
            $id = $this->user->id;
            $query->where(fn (Builder $q) => $q
                ->where('work_orders.requester_id', $id)
                ->orWhere('work_orders.picked_by_id', $id)
                ->orWhere('work_orders.completed_by_id', $id)
                ->orWhereHas('activeAssignments', fn (Builder $a) => $a->where('user_id', $id)));
        }
        if ($this->unitIds) {
            $query->whereIn('work_orders.executor_unit_id', $this->unitIds);
        }
        if (! empty($this->filters['location_id'])) {
            $query->where('work_orders.location_id', $this->filters['location_id']);
        }
        if (! empty($this->filters['service_category_id'])) {
            $query->where('work_orders.service_category_id', $this->filters['service_category_id']);
        }

        return $query;
    }

    public function serviceRequests(): Builder
    {
        $query = ServiceRequest::query()->whereNotNull('submitted_at');

        if ($this->scope === 'mine') {
            $id = $this->user->id;
            $query->where(fn (Builder $q) => $q->where('service_requests.requester_id', $id)->orWhere('service_requests.assigned_executor_id', $id));
        }
        if ($this->unitIds) {
            $query->whereIn('service_requests.executor_unit_id', $this->unitIds);
        }

        return $query;
    }

    public function pmTasks(): Builder
    {
        $query = PmTask::query();

        if ($this->scope === 'mine') {
            $query->where('pm_tasks.pic_user_id', $this->user->id);
        }
        if ($this->unitIds) {
            $query->whereIn('pm_tasks.executor_unit_id', $this->unitIds);
        }
        if (! empty($this->filters['location_id'])) {
            $query->whereHas('equipment', fn (Builder $e) => $e->where('location_id', $this->filters['location_id']));
        }

        return $query;
    }

    /** Users whose workload is shown: the unit's staff, everyone with activity (all), or just me. */
    public function staffUserIds(): ?array
    {
        if ($this->scope === 'mine') {
            // Only executor staff have a workload; a plain requester has none.
            return $this->directory->isStaffAnywhere($this->user) ? [$this->user->id] : [0];
        }
        if (! $this->unitIds) {
            return null; // all
        }

        $ids = [];
        foreach (\App\Models\ExecutorUnit::query()->whereIn('id', $this->unitIds)->get() as $unit) {
            $ids = array_merge($ids, $this->directory->staffQuery($unit)->pluck('id')->map(fn ($i) => (int) $i)->all());
        }

        return array_values(array_unique($ids)) ?: [0];
    }

    public function cacheKey(): string
    {
        return 'dashboard:'.$this->user->id.':'.$this->scope.':'.md5(json_encode($this->filters));
    }
}
