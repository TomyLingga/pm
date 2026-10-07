<?php

namespace App\Enums;

enum ChecklistResult: string
{
    case Ok = 'ok';
    case NotOk = 'not_ok';
    case Na = 'na';

    public function label(): string
    {
        return match ($this) {
            self::Ok => 'OK',
            self::NotOk => 'Tidak OK',
            self::Na => 'N/A',
        };
    }

    /** @return string[] */
    public static function values(): array
    {
        return array_map(fn (self $r) => $r->value, self::cases());
    }
}
