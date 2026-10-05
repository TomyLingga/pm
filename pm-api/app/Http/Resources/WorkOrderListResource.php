<?php

namespace App\Http\Resources;

use App\Models\WorkOrderAssignee;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\WorkOrder */
class WorkOrderListResource extends JsonResource
{
    /** Relations needed by this resource. */
    public const RELATIONS = [
        'executorUnit',
        'serviceCategory',
        'location',
        'requester',
        'activeAssignments.user',
    ];

    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'wo_number' => $this->wo_number,
            'issued_at' => $this->issued_at?->toIso8601String(),
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'priority' => $this->priority->value,
            'priority_label' => $this->priority->label(),
            'executor_unit' => [
                'id' => $this->executorUnit->id,
                'code' => $this->executorUnit->code,
                'display_name' => $this->executorUnit->display_name,
            ],
            'service_category' => [
                'id' => $this->serviceCategory->id,
                'name' => $this->serviceCategory->name,
            ],
            'category_note' => $this->category_note,
            'equipment_code' => $this->equipment_code,
            'equipment_name' => $this->equipment_name,
            'location_name' => $this->location?->name ?? $this->location_note,
            'request_description' => $this->request_description,
            'requester' => new UserBriefResource($this->requester),
            'requester_sub_bagian_name' => $this->requester_sub_bagian_name,
            'assignees' => $this->activeAssignments->map(fn (WorkOrderAssignee $a) => array_merge(
                (new UserBriefResource($a->user))->toArray($request),
                ['is_lead' => $a->is_lead],
            ))->values(),
            'picked_at' => $this->picked_at?->toIso8601String(),
            'completed_at' => $this->completed_at?->toIso8601String(),
            'closed_at' => $this->closed_at?->toIso8601String(),
        ];
    }
}
