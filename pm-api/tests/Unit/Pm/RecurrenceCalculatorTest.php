<?php

namespace Tests\Unit\Pm;

use App\Enums\PmFrequency;
use App\Services\Pm\RecurrenceCalculator;
use Carbon\CarbonImmutable;
use PHPUnit\Framework\TestCase;

/**
 * Due-date arithmetic for every PM frequency type (pure unit test: no database, no framework).
 */
class RecurrenceCalculatorTest extends TestCase
{
    private RecurrenceCalculator $calculator;

    protected function setUp(): void
    {
        parent::setUp();
        $this->calculator = new RecurrenceCalculator();
    }

    private function moment(string $dateTime): CarbonImmutable
    {
        return CarbonImmutable::parse($dateTime, 'Asia/Jakarta');
    }

    /** @param CarbonImmutable[] $dates */
    private function format(array $dates): array
    {
        return array_map(fn (CarbonImmutable $d) => $d->format('Y-m-d H:i'), $dates);
    }

    /** First occurrences of a schedule, starting with the start itself. */
    private function first(PmFrequency $type, int $interval, string $start, int $count): array
    {
        $start = $this->moment($start);

        return $this->format($this->calculator->next($type, $interval, $start, null, $start->subSecond(), $count));
    }

    // ── One test per frequency type ──────────────────────────────────────────

    public function test_hourly_every_n_hours_crosses_midnight(): void
    {
        $this->assertSame(
            ['2026-10-05 06:00', '2026-10-05 14:00', '2026-10-05 22:00', '2026-10-06 06:00', '2026-10-06 14:00'],
            $this->first(PmFrequency::Hourly, 8, '2026-10-05 06:00', 5)
        );
        $this->assertSame(
            ['2026-12-31 22:00', '2026-12-31 23:00', '2027-01-01 00:00'],
            $this->first(PmFrequency::Hourly, 1, '2026-12-31 22:00', 3),
            'every hour, across the year boundary'
        );
    }

    public function test_daily_keeps_the_time_of_day_and_ignores_the_interval(): void
    {
        $expected = ['2026-02-27 07:30', '2026-02-28 07:30', '2026-03-01 07:30', '2026-03-02 07:30'];

        $this->assertSame($expected, $this->first(PmFrequency::Daily, 1, '2026-02-27 07:30', 4));
        $this->assertSame($expected, $this->first(PmFrequency::Daily, 5, '2026-02-27 07:30', 4), 'daily is always every 1 day');
    }

    public function test_every_n_days(): void
    {
        $this->assertSame(
            ['2026-01-25 08:00', '2026-02-04 08:00', '2026-02-14 08:00', '2026-02-24 08:00', '2026-03-06 08:00'],
            $this->first(PmFrequency::EveryNDays, 10, '2026-01-25 08:00', 5)
        );
        $this->assertSame(
            ['2028-02-27 08:00', '2028-02-29 08:00', '2028-03-02 08:00'],
            $this->first(PmFrequency::EveryNDays, 2, '2028-02-27 08:00', 3),
            'leap day is a normal day'
        );
    }

    public function test_weekly_stays_on_the_same_weekday(): void
    {
        $weekly = $this->first(PmFrequency::Weekly, 1, '2026-10-05 09:00', 4); // a Monday
        $this->assertSame(['2026-10-05 09:00', '2026-10-12 09:00', '2026-10-19 09:00', '2026-10-26 09:00'], $weekly);
        foreach ($weekly as $date) {
            $this->assertSame('Monday', $this->moment($date)->englishDayOfWeek);
        }

        $this->assertSame(
            ['2026-12-21 09:00', '2027-01-04 09:00', '2027-01-18 09:00'],
            $this->first(PmFrequency::Weekly, 2, '2026-12-21 09:00', 3),
            'every 2 weeks across the year boundary'
        );
    }

    public function test_monthly_on_a_normal_day_and_across_the_year(): void
    {
        $this->assertSame(
            ['2026-11-15 08:00', '2026-12-15 08:00', '2027-01-15 08:00', '2027-02-15 08:00'],
            $this->first(PmFrequency::Monthly, 1, '2026-11-15 08:00', 4)
        );
    }

    public function test_monthly_on_the_31st_clamps_to_month_end_without_drifting(): void
    {
        $this->assertSame(
            ['2026-01-31 08:00', '2026-02-28 08:00', '2026-03-31 08:00', '2026-04-30 08:00', '2026-05-31 08:00'],
            $this->first(PmFrequency::Monthly, 1, '2026-01-31 08:00', 5),
            'after February the schedule returns to the 31st'
        );
        $this->assertSame(
            ['2028-01-31 08:00', '2028-02-29 08:00', '2028-03-31 08:00'],
            $this->first(PmFrequency::Monthly, 1, '2028-01-31 08:00', 3),
            'leap year February'
        );
    }

    public function test_monthly_with_interval_quarterly_and_semiannual(): void
    {
        $this->assertSame(
            ['2026-11-30 08:00', '2027-02-28 08:00', '2027-05-30 08:00', '2027-08-30 08:00'],
            $this->first(PmFrequency::Monthly, 3, '2026-11-30 08:00', 4)
        );
        $this->assertSame(
            ['2026-08-31 08:00', '2027-02-28 08:00', '2027-08-31 08:00'],
            $this->first(PmFrequency::Monthly, 6, '2026-08-31 08:00', 3)
        );
    }

    public function test_yearly_including_leap_day(): void
    {
        $this->assertSame(
            ['2026-10-05 08:00', '2027-10-05 08:00', '2028-10-05 08:00'],
            $this->first(PmFrequency::Yearly, 1, '2026-10-05 08:00', 3)
        );
        $this->assertSame(
            ['2028-02-29 08:00', '2029-02-28 08:00', '2030-02-28 08:00', '2031-02-28 08:00', '2032-02-29 08:00'],
            $this->first(PmFrequency::Yearly, 1, '2028-02-29 08:00', 5),
            '29 Feb falls back to 28 Feb and returns in the next leap year'
        );
        $this->assertSame(
            ['2026-06-01 08:00', '2028-06-01 08:00', '2030-06-01 08:00'],
            $this->first(PmFrequency::Yearly, 2, '2026-06-01 08:00', 3)
        );
    }

    // ── occurrence() by index ────────────────────────────────────────────────

    /** @dataProvider occurrenceProvider */
    public function test_occurrence_by_index(PmFrequency $type, int $interval, string $start, int $index, string $expected): void
    {
        $this->assertSame(
            $expected,
            $this->calculator->occurrence($type, $interval, $this->moment($start), $index)->format('Y-m-d H:i')
        );
    }

    public function occurrenceProvider(): array
    {
        return [
            'index 0 is the start' => [PmFrequency::Monthly, 1, '2026-01-31 08:00', 0, '2026-01-31 08:00'],
            'hourly 6h × 5' => [PmFrequency::Hourly, 6, '2026-10-05 00:00', 5, '2026-10-06 06:00'],
            'daily × 30' => [PmFrequency::Daily, 1, '2026-10-05 08:00', 30, '2026-11-04 08:00'],
            'every 7 days × 3' => [PmFrequency::EveryNDays, 7, '2026-10-05 08:00', 3, '2026-10-26 08:00'],
            'weekly × 52' => [PmFrequency::Weekly, 1, '2026-10-05 08:00', 52, '2027-10-04 08:00'],
            'monthly 31st × 13 (Feb next year)' => [PmFrequency::Monthly, 1, '2026-01-31 08:00', 13, '2027-02-28 08:00'],
            'monthly 30th × 4 (Feb leap year)' => [PmFrequency::Monthly, 1, '2027-10-30 08:00', 4, '2028-02-29 08:00'],
            'yearly × 10' => [PmFrequency::Yearly, 1, '2026-03-15 08:00', 10, '2036-03-15 08:00'],
            'negative index is clamped to the start' => [PmFrequency::Weekly, 1, '2026-10-05 08:00', -3, '2026-10-05 08:00'],
        ];
    }

    // ── Range queries used by the generator and the calendar ─────────────────

    public function test_between_is_inclusive_and_starts_at_the_schedule_start(): void
    {
        $dates = $this->calculator->between(
            PmFrequency::Weekly, 1, $this->moment('2026-10-05 09:00'), null,
            $this->moment('2026-09-01 00:00'), $this->moment('2026-10-19 09:00')
        );

        $this->assertSame(['2026-10-05 09:00', '2026-10-12 09:00', '2026-10-19 09:00'], $this->format($dates));
    }

    public function test_between_from_the_middle_of_an_interval(): void
    {
        $dates = $this->calculator->between(
            PmFrequency::Monthly, 1, $this->moment('2026-01-31 08:00'), null,
            $this->moment('2026-02-28 08:01'), $this->moment('2026-06-30 07:59')
        );

        $this->assertSame(
            ['2026-03-31 08:00', '2026-04-30 08:00', '2026-05-31 08:00'],
            $this->format($dates),
            'starts after the February occurrence and stops one minute before the June one'
        );
    }

    public function test_between_respects_the_schedule_end(): void
    {
        $dates = $this->calculator->between(
            PmFrequency::Daily, 1, $this->moment('2026-10-05 08:00'), $this->moment('2026-10-07 08:00'),
            $this->moment('2026-10-01 00:00'), $this->moment('2026-10-31 00:00')
        );
        $this->assertSame(['2026-10-05 08:00', '2026-10-06 08:00', '2026-10-07 08:00'], $this->format($dates));

        $this->assertSame([], $this->calculator->between(
            PmFrequency::Daily, 1, $this->moment('2026-10-05 08:00'), $this->moment('2026-10-07 08:00'),
            $this->moment('2026-10-08 00:00'), $this->moment('2026-10-31 00:00')
        ), 'nothing after the end');
    }

    public function test_between_is_capped_by_the_limit(): void
    {
        $dates = $this->calculator->between(
            PmFrequency::Hourly, 1, $this->moment('2026-01-01 00:00'), null,
            $this->moment('2026-01-01 00:00'), $this->moment('2030-01-01 00:00'), 100
        );

        $this->assertCount(100, $dates);
    }

    /** @dataProvider firstIndexProvider */
    public function test_first_index_on_or_after(PmFrequency $type, int $interval, string $start, string $from, int $expected): void
    {
        $this->assertSame($expected, $this->calculator->firstIndexOnOrAfter($type, $interval, $this->moment($start), $this->moment($from)));
    }

    public function firstIndexProvider(): array
    {
        return [
            'before the start' => [PmFrequency::Weekly, 1, '2026-10-05 09:00', '2026-01-01 00:00', 0],
            'exactly the start' => [PmFrequency::Weekly, 1, '2026-10-05 09:00', '2026-10-05 09:00', 0],
            'exactly on an occurrence' => [PmFrequency::Weekly, 1, '2026-10-05 09:00', '2026-10-19 09:00', 2],
            'one second after an occurrence' => [PmFrequency::Weekly, 1, '2026-10-05 09:00', '2026-10-19 09:00:01', 3],
            'hourly, ten years ahead' => [PmFrequency::Hourly, 8, '2026-01-01 00:00', '2036-01-01 00:00', 10956],
            'every 10 days' => [PmFrequency::EveryNDays, 10, '2026-01-25 08:00', '2026-02-05 00:00', 2],
            'monthly on the 31st, short month' => [PmFrequency::Monthly, 1, '2026-01-31 08:00', '2026-02-28 08:00', 1],
            'monthly on the 31st, after short month' => [PmFrequency::Monthly, 1, '2026-01-31 08:00', '2026-02-28 09:00', 2],
            'quarterly, years ahead' => [PmFrequency::Monthly, 3, '2026-01-15 08:00', '2030-01-15 08:00', 16],
            'yearly from leap day' => [PmFrequency::Yearly, 1, '2028-02-29 08:00', '2029-02-28 08:00', 1],
            'every 2 years' => [PmFrequency::Yearly, 2, '2026-06-01 08:00', '2029-01-01 00:00', 2],
        ];
    }

    public function test_next_is_strictly_after_and_stops_at_the_end(): void
    {
        $start = $this->moment('2026-10-05 08:00');

        $this->assertSame(
            ['2026-10-06 08:00', '2026-10-07 08:00'],
            $this->format($this->calculator->next(PmFrequency::Daily, 1, $start, null, $this->moment('2026-10-05 08:00'), 2)),
            'an occurrence equal to "after" is not returned'
        );
        $this->assertSame(
            ['2026-10-05 08:00'],
            $this->format($this->calculator->next(PmFrequency::Daily, 1, $start, null, $this->moment('2026-10-01 00:00'), 1))
        );
        $this->assertSame(
            ['2026-10-06 08:00'],
            $this->format($this->calculator->next(PmFrequency::Daily, 1, $start, $this->moment('2026-10-06 08:00'), $start, 5)),
            'the schedule end cuts the list short'
        );
    }

    public function test_previous_returns_the_current_cycle(): void
    {
        $start = $this->moment('2026-10-05 08:00');

        $this->assertNull($this->calculator->previous(PmFrequency::Hourly, 8, $start, $this->moment('2026-10-05 07:59')), 'not started yet');
        $this->assertSame('2026-10-05 08:00', $this->calculator->previous(PmFrequency::Hourly, 8, $start, $start)->format('Y-m-d H:i'));
        $this->assertSame(
            '2026-10-05 16:00',
            $this->calculator->previous(PmFrequency::Hourly, 8, $start, $this->moment('2026-10-05 23:59'))->format('Y-m-d H:i')
        );
        $this->assertSame(
            '2026-02-28 08:00',
            $this->calculator->previous(PmFrequency::Monthly, 1, $this->moment('2026-01-31 08:00'), $this->moment('2026-03-30 12:00'))->format('Y-m-d H:i')
        );
    }

    // ── Window and tolerance ─────────────────────────────────────────────────

    public function test_due_window_and_overdue_moments(): void
    {
        $due = $this->moment('2026-10-05 08:00');

        $this->assertSame('2026-10-03 08:00', $this->calculator->dueWindowAt($due, 48)->format('Y-m-d H:i'), 'H-2');
        $this->assertSame('2026-10-02 08:00', $this->calculator->dueWindowAt($due, 72)->format('Y-m-d H:i'), 'H-3');
        $this->assertSame('2026-10-05 08:00', $this->calculator->dueWindowAt($due, 0)->format('Y-m-d H:i'));
        $this->assertSame('2026-10-08 08:00', $this->calculator->overdueAt($due, 72)->format('Y-m-d H:i'), 'tolerance 3 days');
        $this->assertSame('2026-10-05 12:00', $this->calculator->overdueAt($due, 4)->format('Y-m-d H:i'), 'tolerance 4 hours');
        $this->assertSame('2026-10-05 08:00', $this->calculator->overdueAt($due, 0)->format('Y-m-d H:i'), 'no tolerance');
    }

    // ── Frequency metadata ───────────────────────────────────────────────────

    public function test_frequency_labels_and_interval_rules(): void
    {
        $this->assertSame('Setiap 8 jam', PmFrequency::Hourly->label(8));
        $this->assertSame('Harian', PmFrequency::Daily->label(3));
        $this->assertSame('Mingguan', PmFrequency::Weekly->label(1));
        $this->assertSame('Setiap 2 minggu', PmFrequency::Weekly->label(2));
        $this->assertSame('Bulanan', PmFrequency::Monthly->label(1));
        $this->assertSame('Setiap 3 bulan', PmFrequency::Monthly->label(3));
        $this->assertSame('Tahunan', PmFrequency::Yearly->label(1));
        $this->assertSame('Setiap 10 hari', PmFrequency::EveryNDays->label(10));

        $this->assertSame(1, PmFrequency::Daily->normalizeInterval(7));
        $this->assertSame([2, 365], PmFrequency::EveryNDays->intervalRange());
        $this->assertSame([1, 168], PmFrequency::Hourly->intervalRange());

        $this->assertSame(8, PmFrequency::Hourly->intervalHours(8));
        $this->assertSame(24, PmFrequency::Daily->intervalHours(1));
        $this->assertSame(240, PmFrequency::EveryNDays->intervalHours(10));
        $this->assertSame(336, PmFrequency::Weekly->intervalHours(2));
        $this->assertSame(672, PmFrequency::Monthly->intervalHours(1));
        $this->assertSame(8760, PmFrequency::Yearly->intervalHours(1));
    }
}
