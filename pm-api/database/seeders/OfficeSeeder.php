<?php

namespace Database\Seeders;

use App\Models\Office;
use Illuminate\Database\Seeder;

/** Reference data: offices selectable on the Form Request. */
class OfficeSeeder extends Seeder
{
    public function run(): void
    {
        foreach ([['HO', 'Head Office'], ['PBK', 'Pabrik']] as [$code, $name]) {
            Office::query()->firstOrCreate(['code' => $code], ['name' => $name, 'is_active' => true]);
        }
    }
}
