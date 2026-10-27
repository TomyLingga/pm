<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * A fresh install seeds only the admin role and the first administrator (AdminSeeder).
     * Org units, employees and offices (Portal "Penempatan Area") come from Portal via `php artisan portal:sync`
     * (daily at 02:00; users also on login), executor units are created from the Kategori Layanan page (or
     * `php artisan pm:executor-unit`), demo data only via `db:seed --class=DemoSeeder`.
     */
    public function run(): void
    {
        $this->call([RoleSeeder::class, AdminSeeder::class]);
    }
}
