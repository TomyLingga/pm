<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;

/**
 * The first administrator. Only the NRK and name are seeded; the rest of the profile (Portal ids,
 * unit, grade, photo) is filled by PortalUserSync on the first SSO login, which matches the row by NRK.
 * Safe to re-run: existing users keep their data and just get the role.
 */
class AdminSeeder extends Seeder
{
    public const ADMINS = [
        ['nrk' => '121110304', 'name' => 'Tomy Inri Akbar Lingga'],
    ];

    public function run(): void
    {
        Role::findOrCreate(User::ROLE_ADMIN, 'web');

        foreach (self::ADMINS as $admin) {
            $user = User::query()->firstOrCreate(['nrk' => $admin['nrk']], ['name' => $admin['name'], 'is_active' => true]);
            if (! $user->hasRole(User::ROLE_ADMIN)) {
                $user->assignRole(User::ROLE_ADMIN);
            }
            $this->command?->info("Admin: {$user->name} ({$user->nrk})");
        }
    }
}
