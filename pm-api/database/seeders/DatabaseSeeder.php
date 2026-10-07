<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * A fresh install seeds only the admin role and the first administrator (AdminSeeder).
     * Org units and employees come from Portal on login (or `php artisan portal:sync`), executor units are
     * created from the Kategori Layanan page (or `php artisan pm:executor-unit`), offices optionally via
     * `db:seed --class=OfficeSeeder`, demo data only via `db:seed --class=DemoSeeder`.
     */
    public function run(): void
    {
        $this->call([RoleSeeder::class, AdminSeeder::class]);
    }
}
