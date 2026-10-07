<?php

namespace App\Enums;

enum PmFrequency: string
{
    case Hourly = 'hourly';
    case Daily = 'daily';
    case Weekly = 'weekly';
    case Monthly = 'monthly';
    case Yearly = 'yearly';
    case EveryNDays = 'every_n_days';

    /** Allowed [min, max] of `frequency_interval` per type. */
    public function intervalRange(): array
    {
        return match ($this) {
            self::Hourly => [1, 168],
            self::Daily => [1, 1],
            self::Weekly => [1, 52],
            self::Monthly => [1, 24],
            self::Yearly => [1, 10],
            self::EveryNDays => [2, 365],
        };
    }

    /** Interval actually used for the recurrence (daily is always 1). */
    public function normalizeInterval(int $interval): int
    {
        return $this === self::Daily ? 1 : max(1, $interval);
    }

    /** Shortest possible distance between two occurrences, in hours. */
    public function intervalHours(int $interval): int
    {
        $n = $this->normalizeInterval($interval);

        return match ($this) {
            self::Hourly => $n,
            self::Daily => 24,
            self::EveryNDays => 24 * $n,
            self::Weekly => 168 * $n,
            self::Monthly => 28 * 24 * $n,
            self::Yearly => 365 * 24 * $n,
        };
    }

    public function label(int $interval = 1): string
    {
        $n = $this->normalizeInterval($interval);

        return match ($this) {
            self::Hourly => "Setiap {$n} jam",
            self::Daily => 'Harian',
            self::Weekly => $n === 1 ? 'Mingguan' : "Setiap {$n} minggu",
            self::Monthly => $n === 1 ? 'Bulanan' : "Setiap {$n} bulan",
            self::Yearly => $n === 1 ? 'Tahunan' : "Setiap {$n} tahun",
            self::EveryNDays => "Setiap {$n} hari",
        };
    }

    /** @return string[] */
    public static function values(): array
    {
        return array_map(fn (self $f) => $f->value, self::cases());
    }
}
