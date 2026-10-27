<?php

namespace Database\Seeders;

use App\Models\Office;
use Illuminate\Database\Seeder;

/**
 * Offices for tests and demo data only. Real offices are Portal "Penempatan Area", synced by `portal:sync`
 * (which takes over an office with the same code and deactivates the others).
 */
class OfficeSeeder extends Seeder
{
    public function run(): void
    {
        foreach ([['HO', 'Head Office'], ['PBK', 'Pabrik']] as [$code, $name]) {
            Office::query()->firstOrCreate(['code' => $code], ['name' => $name, 'is_active' => true]);
        }
    }
}
