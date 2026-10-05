<?php

namespace App\Enums;

enum ClearanceResult: string
{
    case Ok = 'ok';
    case NotOk = 'not_ok';

    public function label(): string
    {
        return match ($this) {
            self::Ok => 'OK',
            self::NotOk => 'TDK',
        };
    }

    /** @return string[] */
    public static function values(): array
    {
        return array_map(fn (self $r) => $r->value, self::cases());
    }
}
