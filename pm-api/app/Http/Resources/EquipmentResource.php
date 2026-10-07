<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Equipment */
class EquipmentResource extends JsonResource
{
    public const RELATIONS = ['location', 'executorUnit'];

    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'name' => $this->name,
            'location' => $this->location
                ? ['id' => $this->location->id, 'code' => $this->location->code, 'name' => $this->location->name] : null,
            'executor_unit' => $this->executorUnit ? [
                'id' => $this->executorUnit->id,
                'code' => $this->executorUnit->code,
                'display_name' => $this->executorUnit->display_name,
            ] : null,
            'brand' => $this->brand,
            'model' => $this->model,
            'serial_number' => $this->serial_number,
            'status' => $this->status,
            'status_label' => $this->statusLabel(),
        ];
    }
}
