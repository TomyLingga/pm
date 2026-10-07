<?php

namespace App\Console\Commands;

use App\Services\Pm\PmTaskGenerator;
use Illuminate\Console\Command;

class GeneratePmTasks extends Command
{
    protected $signature = 'pm:generate-tasks';

    protected $description = 'Generate PM tasks from active schedules up to the horizon (idempotent)';

    public function handle(PmTaskGenerator $generator): int
    {
        $created = $generator->generateAll();
        $this->info("{$created} tugas PM dibuat.");

        return self::SUCCESS;
    }
}
