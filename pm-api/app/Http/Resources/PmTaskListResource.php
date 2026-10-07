<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\PmTask */
class PmTaskListResource extends JsonResource
{
    public const RELATIONS = ['schedule', 'equipment.location', 'executorUnit', 'pic'];

    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'number' => $this->number,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'due_at' => $this->due_at->toIso8601String(),
            'due_window_at' => $this->due_window_at->toIso8601String(),
            'overdue_at' => $this->overdue_at->toIso8601String(),
            'is_late' => $this->is_late,
            'schedule' => [
                'id' => $this->schedule->id,
                'name' => $this->schedule->name,
                'frequency_label' => $this->schedule->frequencyLabel(),
            ],
            'equipment' => [
                'id' => $this->equipment->id,
                'code' => $this->equipment->code,
                'name' => $this->equipment->name,
                'location_name' => $this->equipment->location?->name,
            ],
            'executor_unit' => [
                'id' => $this->executorUnit->id,
                'code' => $this->executorUnit->code,
                'display_name' => $this->executorUnit->display_name,
            ],
            'pic' => new UserBriefResource($this->pic),
            'started_at' => $this->started_at?->toIso8601String(),
            'completed_at' => $this->completed_at?->toIso8601String(),
            'has_skip_proposal' => $this->skip_proposal !== null && $this->status->isOpen(),
            'findings_count' => (int) ($this->findings_count ?? $this->findings()->count()),
        ];
    }
}
