<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\User */
class UserBriefResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'nrk' => $this->nrk,
            'name' => $this->name,
            'position' => $this->position,
            'photo_url' => $this->photo_url,
        ];
    }
}
