<?php

namespace App\Console;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;

class Kernel extends ConsoleKernel
{
    /**
     * Define the application's command schedule.
     *
     * @param  \Illuminate\Console\Scheduling\Schedule  $schedule
     * @return void
     */
    protected function schedule(Schedule $schedule)
    {
        $schedule->command('wo:auto-accept')->hourly()->withoutOverlapping();
        $schedule->command('approvals:remind')->hourly()->withoutOverlapping();

        // Preventive Maintenance: tasks are generated nightly; statuses/reminders follow the clock
        // closely because schedules can be defined per N hours.
        $schedule->command('pm:generate-tasks')->dailyAt('00:05')->withoutOverlapping();
        $schedule->command('pm:check-overdue')->everyFifteenMinutes()->withoutOverlapping();
        $schedule->command('portal:sync')->dailyAt('02:00')->withoutOverlapping();
    }

    /**
     * Register the commands for the application.
     *
     * @return void
     */
    protected function commands()
    {
        $this->load(__DIR__.'/Commands');

        require base_path('routes/console.php');
    }
}
