<?php

namespace Database\Factories;

use App\Models\Material;
use Illuminate\Database\Eloquent\Factories\Factory;

class MaterialFactory extends Factory
{
    protected $model = Material::class;

    public function definition(): array
    {
        return [
            'code' => strtoupper($this->faker->unique()->bothify('MAT-####')),
            'name' => 'Material '.$this->faker->unique()->word(),
            'unit' => 'pcs',
            'is_active' => true,
        ];
    }
}
