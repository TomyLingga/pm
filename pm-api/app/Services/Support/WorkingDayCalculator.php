<?php

namespace App\Services\Support;

use App\Models\Holiday;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

/**
 * Adds working days (config `pm.working_days`, minus `holidays`), keeping the time of day.
 */
class WorkingDayCalculator
{
    public function addWorkingDays(CarbonInterface $from, int $days): CarbonImmutable
    {
        $date = CarbonImmutable::instance($from);
        $workingDays = config('pm.working_days');
        $holidays = Holiday::query()
            ->whereBetween('date', [$date->toDateString(), $date->addDays($days * 3 + 14)->toDateString()])
            ->pluck('date')
            ->map(fn ($d) => $d->toDateString())
            ->flip();

        $added = 0;
        while ($added < $days) {
            $date = $date->addDay();
            if (in_array($date->dayOfWeekIso, $workingDays, true) && ! $holidays->has($date->toDateString())) {
                $added++;
            }
        }

        return $date;
    }
}
