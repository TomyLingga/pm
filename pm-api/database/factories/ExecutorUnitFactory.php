<?php

namespace Database\Factories;

use App\Models\ExecutorUnit;
use App\Models\OrgUnit;
use Illuminate\Database\Eloquent\Factories\Factory;

class ExecutorUnitFactory extends Factory
{
    protected $model = ExecutorUnit::class;

    public function definition(): array
    {
        return [
            'org_unit_id' => OrgUnit::factory(),
            'code' => strtoupper($this->faker->unique()->lexify('X??')),
            'display_name' => 'Pelaksana '.$this->faker->unique()->word(),
            'accepts_work_orders' => true,
            'accepts_requests' => true,
            'is_active' => true,
        ];
    }
}
