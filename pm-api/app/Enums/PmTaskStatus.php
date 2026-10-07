<?php

namespace App\Enums;

enum PmTaskStatus: string
{
    case Scheduled = 'scheduled';
    case Due = 'due';
    case InProgress = 'in_progress';
    case Completed = 'completed';
    case Overdue = 'overdue';
    case Skipped = 'skipped';

    public function label(): string
    {
        return match ($this) {
            self::Scheduled => 'TERJADWAL',
            self::Due => 'JATUH_TEMPO',
            self::InProgress => 'DIKERJAKAN',
            self::Completed => 'SELESAI',
            self::Overdue => 'TERLAMBAT',
            self::Skipped => 'DILEWATI',
        };
    }

    public function isFinal(): bool
    {
        return in_array($this, [self::Completed, self::Skipped], true);
    }

    /** Waiting to be worked on (not started, not finished). */
    public function isOpen(): bool
    {
        return in_array($this, [self::Scheduled, self::Due, self::Overdue], true);
    }

    /** @return string[] */
    public static function values(): array
    {
        return array_map(fn (self $s) => $s->value, self::cases());
    }
}
