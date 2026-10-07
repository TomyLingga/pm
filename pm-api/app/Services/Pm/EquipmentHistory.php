<?php

namespace App\Services\Pm;

use App\Enums\PmTaskStatus;
use App\Models\Equipment;
use App\Models\PmTask;
use App\Models\WorkOrder;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Maintenance log of one equipment: PM tasks and Work Orders merged on a single timeline (PRD §6).
 */
class EquipmentHistory
{
    /** PM tasks appear once something happened to them (not while merely scheduled / due). */
    private const TASK_STATUSES = [
        PmTaskStatus::InProgress, PmTaskStatus::Completed, PmTaskStatus::Overdue, PmTaskStatus::Skipped,
    ];

    public function paginate(Equipment $equipment, int $perPage = 20): LengthAwarePaginator
    {
        $tasks = DB::table('pm_tasks')
            ->selectRaw("'pm_task' as type, id, COALESCE(completed_at, skipped_at, started_at, due_at) as happened_at")
            ->where('equipment_id', $equipment->id)
            ->whereIn('status', array_map(fn (PmTaskStatus $s) => $s->value, self::TASK_STATUSES));

        $workOrders = DB::table('work_orders')
            ->selectRaw("'work_order' as type, id, issued_at as happened_at")
            ->where('equipment_id', $equipment->id)
            ->whereNull('deleted_at');

        $page = DB::query()->fromSub($tasks->unionAll($workOrders), 'history')
            ->orderByDesc('happened_at')->orderBy('type')->orderByDesc('id')
            ->paginate($perPage);

        $rows = collect($page->items());
        $taskModels = PmTask::query()->with(['schedule', 'completedBy', 'skippedBy', 'startedBy'])->withCount('findings')
            ->whereIn('id', $rows->where('type', 'pm_task')->pluck('id'))->get()->keyBy('id');
        $workOrderModels = WorkOrder::query()->with(['requester', 'completedBy'])
            ->whereIn('id', $rows->where('type', 'work_order')->pluck('id'))->get()->keyBy('id');

        $page->setCollection($rows->map(function ($row) use ($taskModels, $workOrderModels) {
            $date = Carbon::parse($row->happened_at)->toIso8601String();

            if ($row->type === 'pm_task') {
                /** @var PmTask $task */
                $task = $taskModels[$row->id];

                return [
                    'type' => 'pm_task',
                    'id' => $task->id,
                    'number' => $task->number,
                    'date' => $date,
                    'status' => $task->status->value,
                    'status_label' => $task->status->label(),
                    'title' => $task->schedule->name,
                    'actor_name' => ($task->completedBy ?? $task->skippedBy ?? $task->startedBy)?->name,
                    'findings_count' => (int) $task->findings_count,
                    'is_late' => $task->is_late,
                ];
            }

            /** @var WorkOrder $workOrder */
            $workOrder = $workOrderModels[$row->id];

            return [
                'type' => 'work_order',
                'id' => $workOrder->id,
                'number' => $workOrder->wo_number,
                'date' => $date,
                'status' => $workOrder->status->value,
                'status_label' => $workOrder->status->label(),
                'title' => Str::limit($workOrder->request_description, 120),
                'actor_name' => ($workOrder->completedBy ?? $workOrder->requester)?->name,
                'findings_count' => null,
                'is_late' => null,
            ];
        })->values());

        return $page;
    }
}
