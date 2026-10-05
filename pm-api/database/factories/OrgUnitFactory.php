<?php

namespace Database\Factories;

use App\Models\OrgUnit;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class OrgUnitFactory extends Factory
{
    protected $model = OrgUnit::class;

    public function definition(): array
    {
        return [
            'portal_unit_id' => (string) Str::uuid(),
            'code' => strtoupper($this->faker->unique()->lexify('U???')),
            'name' => 'Unit '.$this->faker->unique()->word(),
            'type' => OrgUnit::TYPE_SEKSI,
            'is_active' => true,
        ];
    }

    public function ofType(string $type, ?OrgUnit $parent = null): static
    {
        return $this->state(fn () => ['type' => $type, 'parent_id' => $parent?->id]);
    }
}
