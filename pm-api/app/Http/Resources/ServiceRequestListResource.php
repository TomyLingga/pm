<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\ServiceRequest */
class ServiceRequestListResource extends JsonResource
{
    public const RELATIONS = [
        'executorUnit',
        'serviceCategory',
        'office',
        'requester',
        'pendingStep.assigneeUser',
        'pendingStep.executorUnit',
    ];

    public function toArray($request): array
    {
        $step = $this->pendingStep;

        return [
            'id' => $this->id,
            'request_number' => $this->request_number,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'priority' => $this->priority->value,
            'priority_label' => $this->priority->requestLabel(),
            'executor_unit' => [
                'id' => $this->executorUnit->id,
                'code' => $this->executorUnit->code,
                'display_name' => $this->executorUnit->display_name,
            ],
            'service_category' => $this->serviceCategory ? ['id' => $this->serviceCategory->id, 'name' => $this->serviceCategory->name] : null,
            'office' => $this->office ? ['id' => $this->office->id, 'code' => $this->office->code, 'name' => $this->office->name] : null,
            'purpose' => $this->purpose,
            'requester' => new UserBriefResource($this->requester),
            'requester_sub_bagian_name' => $this->requester_sub_bagian_name,
            'current_step' => $step ? [
                'key' => $step->step_key,
                'label' => $step->step_label,
                'assignee_label' => $step->assigneeLabel(),
                'waiting_since' => $step->activated_at?->toIso8601String(),
            ] : null,
            'revision_no' => $this->revision_no,
            'created_at' => $this->created_at?->toIso8601String(),
            'submitted_at' => $this->submitted_at?->toIso8601String(),
            'completed_at' => $this->completed_at?->toIso8601String(),
        ];
    }
}
