<?php

namespace App\Enums;

enum WorkProgramActivityStatus: string
{
    case Open = 'open';
    case OnProgress = 'on_progress';
    case Closed = 'closed';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::Open => 'OPEN',
            self::OnProgress => 'ON PROGRESS',
            self::Closed => 'CLOSED',
            self::Cancelled => 'DIBATALKAN',
        };
    }

    public function isFinal(): bool
    {
        return in_array($this, [self::Closed, self::Cancelled], true);
    }

    /** @return string[] */
    public static function values(): array
    {
        return array_map(fn (self $s) => $s->value, self::cases());
    }
}
