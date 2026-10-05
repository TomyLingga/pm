<?php

namespace App\Http\Resources;

use App\Models\ExecutorUnit;
use App\Models\OrgUnit;
use App\Services\Org\ExecutorDirectory;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\User */
class MeResource extends JsonResource
{
    public function toArray($request): array
    {
        $directory = app(ExecutorDirectory::class);
        /** @var OrgUnit|null $unit */
        $unit = $this->orgUnit;

        return [
            'id' => $this->id,
            'nrk' => $this->nrk,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'position' => $this->position,
            'employment_status' => $this->employment_status,
            'grade_code' => $this->grade_code,
            'grade_level' => $this->grade_level,
            'photo_url' => $this->photo_url,
            'org_unit' => $unit ? [
                'id' => $unit->id,
                'code' => $unit->code,
                'name' => $unit->name,
                'type' => $unit->type,
            ] : null,
            'bagian' => $unit?->ancestorOfType(OrgUnit::TYPE_BAGIAN)?->name,
            'sub_bagian' => $unit?->ancestorOfType(OrgUnit::TYPE_SUB_BAGIAN)?->name,
            'roles' => $this->getRoleNames()->values(),
            'executor_units' => $directory->unitsFor($this->resource)->map(fn (ExecutorUnit $u) => [
                'id' => $u->id,
                'code' => $u->code,
                'display_name' => $u->display_name,
                'is_lead' => $directory->isLead($this->resource, $u),
            ])->values(),
        ];
    }
}
