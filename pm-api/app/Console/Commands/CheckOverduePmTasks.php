<?php

namespace App\Console\Commands;

use App\Services\Pm\PmStatusRefresher;
use Illuminate\Console\Command;

class CheckOverduePmTasks extends Command
{
    protected $signature = 'pm:check-overdue';

    protected $description = 'Move PM tasks to JATUH_TEMPO / TERLAMBAT and send the upcoming, due and overdue reminders';

    public function handle(PmStatusRefresher $refresher): int
    {
        $r = $refresher->run();

        $this->info(
            "Jatuh tempo: {$r['due']}, terlambat: {$r['overdue']}, dilewati otomatis: {$r['skipped']}; ".
            "pengingat awal: {$r['upcoming_reminders']}, H-0: {$r['due_reminders']}, overdue: {$r['overdue_reminders']}."
        );

        return self::SUCCESS;
    }
}
