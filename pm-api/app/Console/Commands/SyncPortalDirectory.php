<?php

namespace App\Console\Commands;

use App\Services\Portal\PortalDirectorySync;
use Illuminate\Console\Command;

class SyncPortalDirectory extends Command
{
    protected $signature = 'portal:sync';

    protected $description = 'Sync organization units, placements (Form Request offices) and employees from Portal INTES';

    public function handle(PortalDirectorySync $sync): int
    {
        $result = $sync->sync();
        $offices = $result['offices'] ?? '-';
        $this->info("Unit organisasi: {$result['org_units']}, penempatan area: {$offices}, karyawan: {$result['users']}, dinonaktifkan: {$result['deactivated']}.");
        if ($result['offices_error']) {
            $this->warn("Penempatan area tidak bisa diambil dari Portal ({$result['offices_error']}); daftar office tidak diubah.");
        }

        return self::SUCCESS;
    }
}
