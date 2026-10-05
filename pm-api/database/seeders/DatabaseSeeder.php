<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Reference data only. Org units and employees come from Portal (`php artisan portal:sync`),
     * executor units from `php artisan pm:executor-unit`.
     */
    public function run(): void
    {
        $this->call([RoleSeeder::class, OfficeSeeder::class]);
    }
}
