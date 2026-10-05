<?php

namespace App\Console\Commands;

use App\Services\Portal\PortalDirectorySync;
use Illuminate\Console\Command;

class SyncPortalDirectory extends Command
{
    protected $signature = 'portal:sync';

    protected $description = 'Sync organization units and employees from Portal INTES';

    public function handle(PortalDirectorySync $sync): int
    {
        $result = $sync->sync();
        $this->info("Unit organisasi: {$result['org_units']}, karyawan: {$result['users']}, dinonaktifkan: {$result['deactivated']}.");

        return self::SUCCESS;
    }
}
