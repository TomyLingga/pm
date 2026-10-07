<?php

namespace App\Services\Dashboard;

use App\Enums\ApprovalStepStatus;
use App\Enums\PmTaskStatus;
use App\Enums\Priority;
use App\Enums\ServiceRequestStatus;
use App\Enums\WorkOrderStatus;
use App\Http\Resources\UserBriefResource;
use App\Models\PmTask;
use App\Models\User;
use App\Services\Approvals\ApprovalEngine;
use App\Services\Org\ExecutorDirectory;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Dashboard numbers (PRD §8). Every figure comes from one aggregate query (GROUP BY / window), never
 * from iterating rows; the whole payload is cached per user, scope and filter set.
 */
class DashboardService
{
    private const FINAL_WO = ['closed', 'cancelled', 'converted'];

    public function __construct(
        private ExecutorDirectory $directory,
        private ApprovalEngine $engine,
    ) {
    }

    public function build(User $user, array $filters): array
    {
        $scope = new DashboardScope($this->directory, $user, $filters['scope'] ?? null, $filters);
        [$from, $to] = $this->period($filters);
        $ttl = (int) config('pm.dashboard.cache_seconds');

        $compute = fn () => $this->compute($scope, $from, $to);

        return $ttl > 0
            ? Cache::remember($scope->cacheKey().':'.$from->toDateString().':'.$to->toDateString(), $ttl, $compute)
            : $compute();
    }

    /** @return array{0: CarbonImmutable, 1: CarbonImmutable} inclusive day bounds in app time */
    private function period(array $filters): array
    {
        $tz = config('app.timezone');
        $to = ! empty($filters['to']) ? CarbonImmutable::parse($filters['to'], $tz) : CarbonImmutable::now($tz);
        $from = ! empty($filters['from']) ? CarbonImmutable::parse($filters['from'], $tz) : $to->subDays(29);

        return [$from->startOfDay(), $to->endOfDay()];
    }

    private function compute(DashboardScope $scope, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $bucket = $from->diffInDays($to) <= 92 ? 'week' : 'month';
        $buckets = $this->buckets($from, $to, $bucket);

        return [
            'scope' => $scope->scope,
            'available_scopes' => $scope->available,
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString(), 'bucket' => $bucket],
            'kpi' => $this->kpi($scope, $from, $to),
            'wo_by_status' => $this->workOrdersByStatus($scope, $from, $to),
            'wo_by_priority' => $this->workOrdersByPriority($scope, $from, $to),
            'wo_by_category' => $this->workOrdersByCategory($scope, $from, $to),
            'wo_trend' => $this->workOrderTrend($scope, $from, $to, $bucket, $buckets),
            'wo_sla_by_priority' => $this->slaByPriority($scope, $from, $to),
            'requests_by_status' => $this->requestsByStatus($scope, $from, $to),
            'requests_pending_by_step' => $this->requestsPendingByStep($scope),
            'pm_compliance' => $this->pmCompliance($scope, $from, $to),
            'pm_trend' => $this->pmTrend($scope, $from, $to, $bucket, $buckets),
            'equipment_breakdown_hours' => $this->equipmentBreakdownHours($scope, $from, $to),
            'equipment_top_failures' => $this->equipmentTopFailures($scope, $from, $to),
            'technician_workload' => $this->technicianWorkload($scope, $from, $to),
            'pm_upcoming' => $this->pmUpcoming($scope),
        ];
    }

    // ── KPI tiles ─────────────────────────────────────────────────────────────

    private function kpi(DashboardScope $scope, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $wo = $scope->workOrders();
        $pm = $scope->pmTasks()
            ->whereIn('status', [PmTaskStatus::Due->value, PmTaskStatus::Overdue->value, PmTaskStatus::InProgress->value])
            ->toBase()->selectRaw('status, count(*) as n')->groupBy('status')->pluck('n', 'status');

        $sla = (clone $wo)->whereBetween('completed_at', [$from, $to])->whereNotNull('picked_at')
            ->toBase()->selectRaw(
                'avg(extract(epoch from (completed_at - picked_at)) / 60) as avg_completion,
                 percentile_cont(0.5) within group (order by extract(epoch from (completed_at - picked_at)) / 60) as median_completion'
            )->first();
        $response = (clone $wo)->whereBetween('picked_at', [$from, $to])
            ->toBase()->selectRaw('avg(extract(epoch from (picked_at - issued_at)) / 60) as avg_response')->value('avg_response');

        $compliance = $this->pmCompliance($scope, $from, $to);

        return [
            'wo_open' => (clone $wo)->whereNotIn('status', self::FINAL_WO)->count(),
            'wo_created' => (clone $wo)->whereBetween('issued_at', [$from, $to])->count(),
            'wo_closed' => (clone $wo)->whereBetween('closed_at', [$from, $to])->count(),
            'wo_awaiting_acceptance' => (clone $wo)->where('status', WorkOrderStatus::Completed->value)->count(),
            'requests_pending_approval' => $scope->serviceRequests()
                ->whereIn('status', [ServiceRequestStatus::WaitingSuperior->value, ServiceRequestStatus::WaitingExecutor->value])->count(),
            'requests_waiting_me' => $this->engine->pendingFor($scope->user)->count(),
            'pm_due' => (int) ($pm['due'] ?? 0),
            'pm_overdue' => (int) ($pm['overdue'] ?? 0),
            'pm_in_progress' => (int) ($pm['in_progress'] ?? 0),
            'pm_compliance_pct' => $compliance['pct_on_time'],
            'wo_avg_response_minutes' => $this->minutes($response),
            'wo_avg_completion_minutes' => $this->minutes($sla?->avg_completion),
            'wo_median_completion_minutes' => $this->minutes($sla?->median_completion),
            'wo_rework_count' => (clone $wo)->whereBetween('issued_at', [$from, $to])->where('rework_count', '>', 0)->count(),
        ];
    }

    // ── Work orders ───────────────────────────────────────────────────────────

    private function workOrdersByStatus(DashboardScope $scope, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $counts = $scope->workOrders()->whereBetween('issued_at', [$from, $to])
            ->toBase()->selectRaw('status, count(*) as n')->groupBy('status')->pluck('n', 'status');

        return collect(WorkOrderStatus::cases())->map(fn (WorkOrderStatus $s) => [
            'status' => $s->value, 'status_label' => $s->label(), 'count' => (int) ($counts[$s->value] ?? 0),
        ])->values()->all();
    }

    private function workOrdersByPriority(DashboardScope $scope, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $counts = $scope->workOrders()->whereBetween('issued_at', [$from, $to])
            ->toBase()->selectRaw('priority, count(*) as n')->groupBy('priority')->pluck('n', 'priority');

        return collect(Priority::cases())->map(fn (Priority $p) => [
            'priority' => $p->value, 'priority_label' => $p->label(), 'count' => (int) ($counts[$p->value] ?? 0),
        ])->values()->all();
    }

    private function workOrdersByCategory(DashboardScope $scope, CarbonImmutable $from, CarbonImmutable $to): array
    {
        return $scope->workOrders()->whereBetween('work_orders.issued_at', [$from, $to])
            ->join('service_categories', 'service_categories.id', '=', 'work_orders.service_category_id')
            ->toBase()->selectRaw('service_categories.id, service_categories.name, count(*) as n')
            ->groupBy('service_categories.id', 'service_categories.name')
            ->orderByDesc('n')->orderBy('service_categories.name')
            ->get()
            ->map(fn ($r) => ['id' => (int) $r->id, 'name' => $r->name, 'count' => (int) $r->n])->all();
    }

    private function workOrderTrend(DashboardScope $scope, CarbonImmutable $from, CarbonImmutable $to, string $bucket, array $buckets): array
    {
        $created = $this->countByBucket($scope->workOrders()->whereBetween('issued_at', [$from, $to]), 'issued_at', $bucket);
        $closed = $this->countByBucket($scope->workOrders()->whereBetween('closed_at', [$from, $to]), 'closed_at', $bucket);

        return array_map(fn ($b) => $b + [
            'created' => (int) ($created[$b['period']] ?? 0),
            'closed' => (int) ($closed[$b['period']] ?? 0),
        ], $buckets);
    }

    private function slaByPriority(DashboardScope $scope, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $rows = $scope->workOrders()->whereBetween('completed_at', [$from, $to])->whereNotNull('picked_at')
            ->toBase()->selectRaw(
                'priority, count(*) as n,
                 avg(extract(epoch from (picked_at - issued_at)) / 60) as avg_response,
                 avg(extract(epoch from (completed_at - picked_at)) / 60) as avg_completion'
            )->groupBy('priority')->get()->keyBy('priority');

        return collect(Priority::cases())->map(fn (Priority $p) => [
            'priority' => $p->value,
            'priority_label' => $p->label(),
            'avg_response_minutes' => $this->minutes($rows[$p->value]->avg_response ?? null),
            'avg_completion_minutes' => $this->minutes($rows[$p->value]->avg_completion ?? null),
            'count' => (int) ($rows[$p->value]->n ?? 0),
        ])->values()->all();
    }

    // ── Form requests ─────────────────────────────────────────────────────────

    private function requestsByStatus(DashboardScope $scope, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $counts = $scope->serviceRequests()->whereBetween('submitted_at', [$from, $to])
            ->toBase()->selectRaw('status, count(*) as n')->groupBy('status')->pluck('n', 'status');

        return collect(ServiceRequestStatus::cases())
            ->reject(fn (ServiceRequestStatus $s) => $s === ServiceRequestStatus::Draft)
            ->map(fn (ServiceRequestStatus $s) => [
                'status' => $s->value, 'status_label' => $s->label(), 'count' => (int) ($counts[$s->value] ?? 0),
            ])->values()->all();
    }

    private function requestsPendingByStep(DashboardScope $scope): array
    {
        $requestIds = $scope->serviceRequests()->whereIn('status', [
            ServiceRequestStatus::WaitingSuperior->value, ServiceRequestStatus::WaitingExecutor->value, ServiceRequestStatus::InProgress->value,
        ])->select('id');

        return DB::table('approval_steps')
            ->where('approvable_type', 'service_request')
            ->where('status', ApprovalStepStatus::Pending->value)
            ->whereIn('approvable_id', $requestIds)
            ->selectRaw('step_key, step_label, count(*) as n')
            ->groupBy('step_key', 'step_label', 'step_order')->orderBy('step_order')
            ->get()
            ->map(fn ($r) => ['key' => $r->step_key, 'label' => $r->step_label, 'count' => (int) $r->n])->all();
    }

    // ── Preventive maintenance ────────────────────────────────────────────────

    private function pmCompliance(DashboardScope $scope, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $rows = $scope->pmTasks()->whereBetween('due_at', [$from, $to])
            ->whereIn('status', [PmTaskStatus::Completed->value, PmTaskStatus::Skipped->value, PmTaskStatus::Overdue->value])
            ->toBase()->selectRaw('status, is_late, count(*) as n')->groupBy('status', 'is_late')->get();

        $count = fn (string $status, ?bool $late = null) => (int) $rows
            ->filter(fn ($r) => $r->status === $status && ($late === null || (bool) $r->is_late === $late))->sum('n');

        $onTime = $count('completed', false);
        $late = $count('completed', true);
        $skipped = $count('skipped');
        $openOverdue = $count('overdue');
        $total = $onTime + $late + $skipped + $openOverdue;

        return [
            'on_time' => $onTime,
            'late' => $late,
            'skipped' => $skipped,
            'open_overdue' => $openOverdue,
            'total' => $total,
            'pct_on_time' => $total ? round($onTime / $total * 100, 1) : null,
        ];
    }

    private function pmTrend(DashboardScope $scope, CarbonImmutable $from, CarbonImmutable $to, string $bucket, array $buckets): array
    {
        $rows = $scope->pmTasks()->whereBetween('due_at', [$from, $to])
            ->whereIn('status', [PmTaskStatus::Completed->value, PmTaskStatus::Skipped->value])
            ->toBase()->selectRaw($this->bucketExpression('due_at', $bucket).' as period, status, is_late, count(*) as n')
            ->groupBy('period', 'status', 'is_late')->get();

        $pick = fn (string $period, string $status, ?bool $late) => (int) $rows
            ->filter(fn ($r) => $r->period === $period && $r->status === $status && ($late === null || (bool) $r->is_late === $late))->sum('n');

        return array_map(fn ($b) => $b + [
            'on_time' => $pick($b['period'], 'completed', false),
            'late' => $pick($b['period'], 'completed', true),
            'skipped' => $pick($b['period'], 'skipped', null),
        ], $buckets);
    }

    private function pmUpcoming(DashboardScope $scope): array
    {
        return $scope->pmTasks()
            ->whereIn('status', [PmTaskStatus::Overdue->value, PmTaskStatus::Due->value, PmTaskStatus::Scheduled->value])
            ->with(['equipment', 'schedule', 'pic'])
            ->orderBy('due_at')->limit(10)->get()
            ->map(fn (PmTask $t) => [
                'id' => $t->id,
                'number' => $t->number,
                'due_at' => $t->due_at->toIso8601String(),
                'status' => $t->status->value,
                'status_label' => $t->status->label(),
                'equipment' => ['id' => $t->equipment->id, 'code' => $t->equipment->code, 'name' => $t->equipment->name],
                'schedule_name' => $t->schedule->name,
                'pic' => (new UserBriefResource($t->pic))->toArray(request()),
            ])->all();
    }

    // ── Equipment ─────────────────────────────────────────────────────────────

    private function equipmentBreakdownHours(DashboardScope $scope, CarbonImmutable $from, CarbonImmutable $to): array
    {
        return $scope->workOrders()->whereBetween('work_orders.closed_at', [$from, $to])
            ->whereNotNull('work_orders.equipment_id')->where('total_breakdown_hours', '>', 0)
            ->join('equipment', 'equipment.id', '=', 'work_orders.equipment_id')
            ->toBase()->selectRaw('equipment.id, equipment.code, equipment.name, sum(total_breakdown_hours) as hours, count(*) as n')
            ->groupBy('equipment.id', 'equipment.code', 'equipment.name')
            ->orderByDesc('hours')->limit(10)->get()
            ->map(fn ($r) => [
                'equipment' => ['id' => (int) $r->id, 'code' => $r->code, 'name' => $r->name],
                'hours' => round((float) $r->hours, 2),
                'work_orders' => (int) $r->n,
            ])->all();
    }

    private function equipmentTopFailures(DashboardScope $scope, CarbonImmutable $from, CarbonImmutable $to): array
    {
        return $scope->workOrders()->whereBetween('work_orders.issued_at', [$from, $to])
            ->whereNotNull('work_orders.equipment_id')
            ->join('equipment', 'equipment.id', '=', 'work_orders.equipment_id')
            ->toBase()->selectRaw('equipment.id, equipment.code, equipment.name, count(*) as n, max(work_orders.issued_at) as last_issued_at')
            ->groupBy('equipment.id', 'equipment.code', 'equipment.name')
            ->orderByDesc('n')->orderBy('equipment.code')->limit(10)->get()
            ->map(fn ($r) => [
                'equipment' => ['id' => (int) $r->id, 'code' => $r->code, 'name' => $r->name],
                'work_orders' => (int) $r->n,
                'last_issued_at' => CarbonImmutable::parse($r->last_issued_at)->toIso8601String(),
            ])->all();
    }

    // ── Technicians ───────────────────────────────────────────────────────────

    private function technicianWorkload(DashboardScope $scope, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $staff = $scope->staffUserIds(); // null = everyone
        $limit = fn (Builder|\Illuminate\Database\Query\Builder $q, string $column) => $staff === null ? $q : $q->whereIn($column, $staff);

        $woIds = $scope->workOrders()->select('work_orders.id');

        $active = $limit(DB::table('work_order_assignees')
            ->join('work_orders', 'work_orders.id', '=', 'work_order_assignees.work_order_id')
            ->whereNull('work_order_assignees.unassigned_at')
            ->whereIn('work_orders.status', [WorkOrderStatus::Received->value, WorkOrderStatus::InProgress->value, WorkOrderStatus::Completed->value])
            ->whereIn('work_orders.id', $woIds), 'work_order_assignees.user_id')
            ->selectRaw('work_order_assignees.user_id, count(distinct work_orders.id) as n')->groupBy('work_order_assignees.user_id')->pluck('n', 'user_id');

        $completed = $limit($scope->workOrders()->whereBetween('completed_at', [$from, $to])->whereNotNull('completed_by_id'), 'completed_by_id')
            ->toBase()->selectRaw('completed_by_id as user_id, count(*) as n')->groupBy('completed_by_id')->pluck('n', 'user_id');

        $pmOpen = $limit($scope->pmTasks()->whereIn('status', [PmTaskStatus::Due->value, PmTaskStatus::Overdue->value, PmTaskStatus::InProgress->value]), 'pic_user_id')
            ->toBase()->selectRaw('pic_user_id as user_id, count(*) as n')->groupBy('pic_user_id')->pluck('n', 'user_id');

        $pmDone = $limit($scope->pmTasks()->whereBetween('completed_at', [$from, $to])->whereNotNull('completed_by_id'), 'completed_by_id')
            ->toBase()->selectRaw('completed_by_id as user_id, count(*) as n')->groupBy('completed_by_id')->pluck('n', 'user_id');

        $labour = $limit(DB::table('work_order_labours')->whereNotNull('user_id')
            ->whereBetween('started_at', [$from, $to])->whereIn('work_order_id', $woIds), 'user_id')
            ->selectRaw('user_id, sum(duration_minutes) as n')->groupBy('user_id')->pluck('n', 'user_id');

        $ids = collect([$active, $completed, $pmOpen, $pmDone, $labour])->flatMap->keys()->unique()->values();
        if ($staff !== null) {
            $ids = $ids->merge($staff)->unique()->values();
        }
        $users = User::query()->whereIn('id', $ids)->get()->keyBy('id');

        return $ids->map(fn ($id) => [
            'user' => isset($users[$id]) ? (new UserBriefResource($users[$id]))->toArray(request()) : null,
            'wo_active' => (int) ($active[$id] ?? 0),
            'wo_completed' => (int) ($completed[$id] ?? 0),
            'pm_open' => (int) ($pmOpen[$id] ?? 0),
            'pm_completed' => (int) ($pmDone[$id] ?? 0),
            'labour_minutes' => (int) ($labour[$id] ?? 0),
        ])->filter(fn ($row) => $row['user'] !== null)
            ->sortByDesc(fn ($row) => $row['wo_active'] + $row['wo_completed'] + $row['pm_open'] + $row['pm_completed'])
            ->take(20)->values()->all();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** @return array<string, int> period key => count */
    private function countByBucket(Builder $query, string $column, string $bucket): array
    {
        return $query->toBase()->selectRaw($this->bucketExpression($column, $bucket).' as period, count(*) as n')
            ->groupBy('period')->pluck('n', 'period')->map(fn ($n) => (int) $n)->all();
    }

    /** PostgreSQL expression giving the ISO week ("2026-W41") or month ("2026-10") of a timestamp. */
    private function bucketExpression(string $column, string $bucket): string
    {
        return $bucket === 'week'
            ? "to_char(date_trunc('week', {$column}), 'IYYY\"-W\"IW')"
            : "to_char(date_trunc('month', {$column}), 'YYYY-MM')";
    }

    /** All buckets covering the period (so charts show zeros instead of gaps). */
    private function buckets(CarbonImmutable $from, CarbonImmutable $to, string $bucket): array
    {
        $out = [];
        $cursor = $bucket === 'week' ? $from->startOfWeek() : $from->startOfMonth();

        while ($cursor->lessThanOrEqualTo($to)) {
            if ($bucket === 'week') {
                $end = $cursor->endOfWeek();
                $label = $cursor->month === $end->month
                    ? $cursor->format('j').'–'.$end->translatedFormat('j M')
                    : $cursor->translatedFormat('j M').'–'.$end->translatedFormat('j M');
                $out[] = ['period' => $cursor->format('o-\WW'), 'label' => $label];
                $cursor = $cursor->addWeek();
            } else {
                $out[] = ['period' => $cursor->format('Y-m'), 'label' => $cursor->translatedFormat('M Y')];
                $cursor = $cursor->addMonth();
            }
        }

        return $out;
    }

    private function minutes($value): ?float
    {
        return $value === null ? null : round((float) $value, 1);
    }
}
