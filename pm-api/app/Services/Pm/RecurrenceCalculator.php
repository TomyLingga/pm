<?php

namespace App\Services\Pm;

use App\Enums\PmFrequency;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

/**
 * Due-date arithmetic for PM schedules. Pure (no database, no clock).
 *
 * Occurrence k (k = 0, 1, 2, …) is always derived from the schedule start, never from the
 * previous occurrence, so anchors do not drift: a monthly schedule starting on the 31st gives
 * 31 Jan → 28/29 Feb → 31 Mar, and a yearly one starting on 29 Feb returns to 29 Feb in leap years.
 */
class RecurrenceCalculator
{
    /** Safety cap for a single range query. */
    public const MAX_OCCURRENCES = 5000;

    public function occurrence(PmFrequency $type, int $interval, CarbonInterface $start, int $index): CarbonImmutable
    {
        $start = CarbonImmutable::instance($start);
        $n = max(0, $index) * $type->normalizeInterval($interval);

        return match ($type) {
            PmFrequency::Hourly => $start->addHours($n),
            PmFrequency::Daily, PmFrequency::EveryNDays => $start->addDays($n),
            PmFrequency::Weekly => $start->addWeeks($n),
            PmFrequency::Monthly => $start->addMonthsNoOverflow($n),
            PmFrequency::Yearly => $start->addYearsNoOverflow($n),
        };
    }

    /** Index of the first occurrence at or after `$from`. */
    public function firstIndexOnOrAfter(PmFrequency $type, int $interval, CarbonInterface $start, CarbonInterface $from): int
    {
        $start = CarbonImmutable::instance($start);
        $from = CarbonImmutable::instance($from);
        if ($from->lessThanOrEqualTo($start)) {
            return 0;
        }

        $n = $type->normalizeInterval($interval);
        $seconds = $from->getTimestamp() - $start->getTimestamp();

        // Jump close to the answer, then walk forward (months and years have variable length).
        $index = match ($type) {
            PmFrequency::Hourly => intdiv($seconds, 3600 * $n),
            PmFrequency::Daily, PmFrequency::EveryNDays => intdiv($seconds, 86400 * $n),
            PmFrequency::Weekly => intdiv($seconds, 604800 * $n),
            PmFrequency::Monthly => intdiv(($from->year - $start->year) * 12 + ($from->month - $start->month), $n) - 1,
            PmFrequency::Yearly => intdiv($from->year - $start->year, $n) - 1,
        };
        $index = max(0, $index);

        while ($this->occurrence($type, $interval, $start, $index)->lessThan($from)) {
            $index++;
        }

        return $index;
    }

    /**
     * Occurrences t with `$from <= t <= $to` (and `t <= $end` when the schedule has an end), ascending.
     *
     * @return CarbonImmutable[]
     */
    public function between(
        PmFrequency $type,
        int $interval,
        CarbonInterface $start,
        ?CarbonInterface $end,
        CarbonInterface $from,
        CarbonInterface $to,
        int $limit = self::MAX_OCCURRENCES,
    ): array {
        $to = CarbonImmutable::instance($to);
        if ($end && $to->greaterThan($end)) {
            $to = CarbonImmutable::instance($end);
        }

        $dates = [];
        $index = $this->firstIndexOnOrAfter($type, $interval, $start, $from);

        while (count($dates) < $limit) {
            $date = $this->occurrence($type, $interval, $start, $index++);
            if ($date->greaterThan($to)) {
                break;
            }
            $dates[] = $date;
        }

        return $dates;
    }

    /**
     * The next `$count` occurrences strictly after `$after`.
     *
     * @return CarbonImmutable[]
     */
    public function next(
        PmFrequency $type,
        int $interval,
        CarbonInterface $start,
        ?CarbonInterface $end,
        CarbonInterface $after,
        int $count = 1,
    ): array {
        $dates = [];
        $index = $this->firstIndexOnOrAfter($type, $interval, $start, $after);

        while (count($dates) < $count) {
            $date = $this->occurrence($type, $interval, $start, $index++);
            if ($end && $date->greaterThan($end)) {
                break;
            }
            if ($date->greaterThan($after)) {
                $dates[] = $date;
            }
        }

        return $dates;
    }

    /** Latest occurrence at or before `$moment`, or null when the schedule has not started yet. */
    public function previous(PmFrequency $type, int $interval, CarbonInterface $start, CarbonInterface $moment): ?CarbonImmutable
    {
        $start = CarbonImmutable::instance($start);
        if ($start->greaterThan($moment)) {
            return null;
        }

        $index = $this->firstIndexOnOrAfter($type, $interval, $start, $moment);
        $date = $this->occurrence($type, $interval, $start, $index);

        return $date->equalTo($moment) ? $date : $this->occurrence($type, $interval, $start, $index - 1);
    }

    /** Moment a task enters JATUH_TEMPO: `$windowHours` before it is due. */
    public function dueWindowAt(CarbonInterface $dueAt, int $windowHours): CarbonImmutable
    {
        return CarbonImmutable::instance($dueAt)->subHours(max(0, $windowHours));
    }

    /** Moment a task becomes TERLAMBAT: due date + tolerance. */
    public function overdueAt(CarbonInterface $dueAt, int $toleranceHours): CarbonImmutable
    {
        return CarbonImmutable::instance($dueAt)->addHours(max(0, $toleranceHours));
    }
}
