<?php

namespace Database\Factories;

use App\Models\ExecutorUnit;
use App\Models\ServiceCategory;
use Illuminate\Database\Eloquent\Factories\Factory;

class ServiceCategoryFactory extends Factory
{
    protected $model = ServiceCategory::class;

    public function definition(): array
    {
        return [
            'executor_unit_id' => ExecutorUnit::factory(),
            'name' => ucfirst($this->faker->unique()->word()),
            'for_work_order' => true,
            'for_request' => true,
            'requires_note' => false,
            'is_active' => true,
        ];
    }
}
