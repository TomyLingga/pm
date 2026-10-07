<?php

namespace App\Http\Resources;

use App\Enums\ChecklistResult;
use App\Models\ChecklistTemplateItem;
use App\Models\PmTaskItem;
use App\Models\PmTaskMaterial;
use App\Models\StatusLog;
use App\Services\Pm\PmTaskService;
use Illuminate\Support\Facades\Gate;

/** @mixin \App\Models\PmTask */
class PmTaskResource extends PmTaskListResource
{
    public const RELATIONS = [
        'schedule',
        'equipment.location',
        'executorUnit',
        'pic',
        'checklistTemplate',
        'startedBy',
        'completedBy',
        'skippedBy',
        'skipProposedBy',
        'items.attachments.uploadedBy',
        'items.workOrder',
        'materials',
        'attachments.uploadedBy',
        'statusLogs.user',
    ];

    public const ACTION_LABELS = [
        'due' => 'Masuk jadwal (jatuh tempo)',
        'overdue' => 'Melewati toleransi',
        'auto_skip' => 'Dilewati otomatis',
        'start' => 'Mulai dikerjakan',
        'complete' => 'Selesai dikerjakan',
        'propose_skip' => 'Diusulkan untuk dilewati',
        'skip' => 'Dilewati',
        'reassign' => 'PIC diganti',
        'create_work_order' => 'WO dibuat dari temuan',
    ];

    public function toArray($request): array
    {
        $user = $request->user();
        $gate = Gate::forUser($user);
        $can = fn (string $ability, string $statusAction) => $user
            && $gate->allows($ability, $this->resource)
            && PmTaskService::statusAllows($this->resource, $statusAction);
        $brief = fn ($u) => $u ? (new UserBriefResource($u))->toArray($request) : null;
        $started = $this->started_at !== null;

        return array_merge(parent::toArray($request), [
            'checklist_template' => ['id' => $this->checklistTemplate->id, 'name' => $this->checklistTemplate->name],
            'tolerance_hours' => $this->schedule->tolerance_hours,
            'estimated_minutes' => $this->schedule->estimated_minutes,
            'started_by' => $brief($this->startedBy),
            'completed_by' => $brief($this->completedBy),
            'duration_minutes' => $this->duration_minutes,
            'notes' => $this->notes,
            'skip_reason' => $this->skip_reason,
            'skipped_by' => $brief($this->skippedBy),
            'skipped_at' => $this->skipped_at?->toIso8601String(),
            'skip_proposal' => $this->skip_proposal ? [
                'reason' => $this->skip_proposal,
                'by' => $brief($this->skipProposedBy),
                'at' => $this->skip_proposed_at?->toIso8601String(),
            ] : null,
            // Until the task is started the checklist still follows the template.
            'checklist_preview' => $started ? [] : $this->checklistTemplate->items
                ->map(fn (ChecklistTemplateItem $item) => ChecklistTemplateResource::definition($item))->values(),
            'items' => $this->items->map(fn (PmTaskItem $item) => $this->item($item, $request))->values(),
            'materials' => $this->materials->map(fn (PmTaskMaterial $m) => [
                'id' => $m->id,
                'material_id' => $m->material_id,
                'material_name' => $m->material_name,
                'quantity' => $m->quantity,
                'unit' => $m->unit,
            ])->values(),
            'attachments' => AttachmentResource::collection($this->attachments),
            'logs' => $this->statusLogs->map(fn (StatusLog $log) => [
                'id' => $log->id,
                'action' => $log->action,
                'action_label' => self::ACTION_LABELS[$log->action] ?? $log->action,
                'from_status' => $log->from_status,
                'to_status' => $log->to_status,
                'notes' => $log->notes,
                'user' => $brief($log->user),
                'created_at' => $log->created_at?->toIso8601String(),
            ])->values(),
            'permissions' => [
                'can_start' => $can('work', 'start'),
                'can_work' => $can('work', 'work'),
                'can_complete' => $can('work', 'complete'),
                'can_propose_skip' => $can('proposeSkip', 'propose_skip'),
                'can_skip' => $can('skip', 'skip'),
                'can_reassign' => $can('reassign', 'reassign'),
                'can_create_work_order' => $can('work', 'create_work_order'),
            ],
        ]);
    }

    private function item(PmTaskItem $item, $request): array
    {
        $result = $item->result ? ChecklistResult::from($item->result) : null;
        $workOrder = $item->workOrder;

        return [
            'id' => $item->id,
            'sort_order' => $item->sort_order,
            'section' => $item->section,
            'description' => $item->description,
            'input_type' => $item->input_type,
            'unit' => $item->unit,
            'min_value' => $item->min_value,
            'max_value' => $item->max_value,
            'is_required' => $item->is_required,
            'photo_required' => $item->photo_required,
            'result' => $result?->value,
            'result_label' => $result?->label(),
            'value_number' => $item->value_number,
            'value_text' => $item->value_text,
            'notes' => $item->notes,
            'attachments' => AttachmentResource::collection($item->attachments)->toArray($request),
            'work_order' => $workOrder ? [
                'id' => $workOrder->id,
                'wo_number' => $workOrder->wo_number,
                'status' => $workOrder->status->value,
                'status_label' => $workOrder->status->label(),
            ] : null,
        ];
    }
}
