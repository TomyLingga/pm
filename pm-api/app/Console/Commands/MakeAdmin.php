<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Spatie\Permission\Models\Role;

/**
 * Grant (or revoke) the `admin` role from the command line, e.g. for the very first admin of a fresh install.
 * The user must have logged in once (or been imported by `portal:sync`). Alternatively set PM_BOOTSTRAP_ADMIN_NRKS.
 *
 * Example: php artisan pm:make-admin 121110304
 */
class MakeAdmin extends Command
{
    protected $signature = 'pm:make-admin
        {nrk : NRK karyawan}
        {--revoke : Cabut hak admin}';

    protected $description = 'Grant or revoke the admin role for a user by NRK';

    public function handle(): int
    {
        $user = User::query()->where('nrk', $this->argument('nrk'))->first();
        if (! $user) {
            $this->error('Pengguna dengan NRK tersebut belum ada. Minta yang bersangkutan login sekali lewat Portal, atau jalankan `php artisan portal:sync`.');

            return self::FAILURE;
        }

        Role::findOrCreate(User::ROLE_ADMIN, 'web');
        if ($this->option('revoke')) {
            $user->removeRole(User::ROLE_ADMIN);
            $this->info("Hak admin {$user->name} ({$user->nrk}) dicabut.");
        } else {
            $user->assignRole(User::ROLE_ADMIN);
            $this->info("{$user->name} ({$user->nrk}) sekarang admin.");
        }

        return self::SUCCESS;
    }
}
