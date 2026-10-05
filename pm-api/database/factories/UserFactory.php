<?php

namespace Database\Factories;

use App\Models\OrgUnit;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class UserFactory extends Factory
{
    protected $model = User::class;

    public function definition(): array
    {
        return [
            'portal_user_id' => (string) Str::uuid(),
            'portal_employee_id' => (string) Str::uuid(),
            'nrk' => (string) $this->faker->unique()->numerify('1190#####'),
            'name' => $this->faker->name(),
            'email' => $this->faker->unique()->userName().'@inl.co.id',
            'phone' => $this->faker->numerify('08##########'),
            'employment_status' => 'Karyawan Tetap',
            'position' => 'Staf',
            'grade_code' => 'BOM-4',
            'grade_level' => 5,
            'is_active' => true,
        ];
    }

    public function inUnit(OrgUnit $unit): static
    {
        return $this->state(fn () => ['org_unit_id' => $unit->id]);
    }

    /** Executor lead (Assisten/Supervisor). */
    public function lead(): static
    {
        return $this->state(fn () => ['grade_code' => 'BOM-3', 'grade_level' => 8, 'position' => 'Supervisor']);
    }

    public function technician(): static
    {
        return $this->state(fn () => ['grade_code' => 'BOM-4', 'grade_level' => 5, 'position' => 'Teknisi']);
    }
}
