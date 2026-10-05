<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\ApprovalStep */
class ApprovalStepResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'round' => $this->round,
            'order' => $this->step_order,
            'key' => $this->step_key,
            'label' => $this->step_label,
            'kind' => $this->kind,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'assignee_label' => $this->assigneeLabel(),
            'assignee_user' => $this->assigneeUser ? (new UserBriefResource($this->assigneeUser))->toArray($request) : null,
            'acted_by' => $this->actedBy ? (new UserBriefResource($this->actedBy))->toArray($request) : null,
            'actor_name' => $this->actor_name,
            'actor_phone' => $this->actor_phone,
            'acted_at' => $this->acted_at?->toIso8601String(),
            'notes' => $this->notes,
            'activated_at' => $this->activated_at?->toIso8601String(),
        ];
    }
}
