<?php

namespace App\Services\Dashboard;

use App\Enums\PmTaskStatus;
use App\Enums\ServiceRequestStatus;
use App\Enums\WorkOrderStatus;
use App\Http\Resources\PmTaskListResource;
use App\Http\Resources\ServiceRequestListResource;
use App\Http\Resources\WorkOrderListResource;
use App\Models\User;
use App\Services\Org\ExecutorDirectory;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;

/**
 * "Papan monitor": what needs attention right now, polled every 30 s by the dashboard / wall display.
 * Never cached. Scope follows the dashboard rules (technician = own, lead = unit, admin = all).
 */
class LiveBoardService
{
    public const LIMIT = 12;

    public function __construct(private ExecutorDirectory $directory)
    {
    }

    public function build(User $user, ?string $requestedScope, Request $request): array
    {
        $scope = new DashboardScope($this->directory, $user, $requestedScope, []);
        $now = CarbonImmutable::now();
        $upcomingUntil = $now->addHours((int) config('pm.live_board.upcoming_hours', 48));

        $workOrders = $scope->workOrders()
            ->whereIn('work_orders.status', [WorkOrderStatus::Submitted->value, WorkOrderStatus::Received->value]);
        $requests = $scope->serviceRequests()
            ->whereIn('service_requests.status', [ServiceRequestStatus::WaitingSuperior->value, ServiceRequestStatus::WaitingExecutor->value]);
        $pm = $scope->pmTasks()->where(fn ($q) => $q
            ->whereIn('pm_tasks.status', [PmTaskStatus::Overdue->value, PmTaskStatus::Due->value, PmTaskStatus::InProgress->value])
            ->orWhere(fn ($s) => $s->where('pm_tasks.status', PmTaskStatus::Scheduled->value)->where('pm_tasks.due_at', '<=', $upcomingUntil)));

        $pmCounts = (clone $pm)->toBase()->selectRaw('pm_tasks.status, count(*) as n')->groupBy('pm_tasks.status')->pluck('n', 'status');

        return [
            'scope' => $scope->scope,
            'available_scopes' => $scope->available,
            'generated_at' => $now->toIso8601String(),
            'upcoming_hours' => (int) config('pm.live_board.upcoming_hours', 48),
            'work_orders' => [
                'total' => (clone $workOrders)->count(),
                'submitted' => (clone $workOrders)->where('work_orders.status', WorkOrderStatus::Submitted->value)->count(),
                'items' => WorkOrderListResource::collection(
                    (clone $workOrders)->with(WorkOrderListResource::RELATIONS)
                        ->orderByRaw("CASE work_orders.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END")
                        ->orderByDesc('work_orders.issued_at')->limit(self::LIMIT)->get()
                )->toArray($request),
            ],
            'requests' => [
                'total' => (clone $requests)->count(),
                'items' => ServiceRequestListResource::collection(
                    (clone $requests)->with(ServiceRequestListResource::RELATIONS)
                        ->orderByDesc('service_requests.submitted_at')->limit(self::LIMIT)->get()
                )->toArray($request),
            ],
            'pm' => [
                'overdue' => (int) ($pmCounts['overdue'] ?? 0),
                'due' => (int) ($pmCounts['due'] ?? 0),
                'in_progress' => (int) ($pmCounts['in_progress'] ?? 0),
                'upcoming' => (int) ($pmCounts['scheduled'] ?? 0),
                'items' => PmTaskListResource::collection(
                    (clone $pm)->with(PmTaskListResource::RELATIONS)->withCount('findings')
                        ->orderByRaw("CASE pm_tasks.status WHEN 'overdue' THEN 1 WHEN 'due' THEN 2 WHEN 'in_progress' THEN 3 ELSE 4 END")
                        ->orderBy('pm_tasks.due_at')->limit(self::LIMIT)->get()
                )->toArray($request),
            ],
        ];
    }
}
