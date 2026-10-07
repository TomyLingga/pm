<?php

namespace App\Enums;

enum DailyActivityStatus: string
{
    case Open = 'open';
    case OnProgress = 'on_progress';
    case Closed = 'closed';

    public function label(): string
    {
        return match ($this) {
            self::Open => 'OPEN',
            self::OnProgress => 'ON PROGRESS',
            self::Closed => 'CLOSED',
        };
    }

    /** @return string[] */
    public static function values(): array
    {
        return array_map(fn (self $s) => $s->value, self::cases());
    }
}
