<?php

namespace App\Enums;

enum ChecklistInputType: string
{
    case OkNokNa = 'ok_nok_na';
    case Number = 'number';
    case Text = 'text';

    /** @return string[] */
    public static function values(): array
    {
        return array_map(fn (self $t) => $t->value, self::cases());
    }
}
