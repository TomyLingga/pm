<?php

namespace Database\Factories;

use App\Models\Location;
use Illuminate\Database\Eloquent\Factories\Factory;

class LocationFactory extends Factory
{
    protected $model = Location::class;

    public function definition(): array
    {
        return [
            'code' => strtoupper($this->faker->unique()->bothify('LOC-###')),
            'name' => 'Area '.$this->faker->unique()->word(),
            'is_active' => true,
        ];
    }
}
