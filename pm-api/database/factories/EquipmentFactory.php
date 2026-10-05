<?php

namespace Database\Factories;

use App\Models\Equipment;
use App\Models\Location;
use Illuminate\Database\Eloquent\Factories\Factory;

class EquipmentFactory extends Factory
{
    protected $model = Equipment::class;

    public function definition(): array
    {
        return [
            'code' => strtoupper($this->faker->unique()->bothify('EQ-####')),
            'name' => 'Mesin '.$this->faker->unique()->word(),
            'location_id' => Location::factory(),
            'status' => 'active',
        ];
    }
}
