<?php

namespace App\Enums;

enum Priority: string
{
    case High = 'high';
    case Medium = 'medium';
    case Low = 'low';

    public function label(): string
    {
        return match ($this) {
            self::High => 'Tinggi',
            self::Medium => 'Menengah',
            self::Low => 'Rendah',
        };
    }

    /** Form Request uses "Sedang" instead of "Menengah" (INLHO/BSIS-ITC/F-004). */
    public function requestLabel(): string
    {
        return $this === self::Medium ? 'Sedang' : $this->label();
    }

    /** Lower weight sorts first (high priority on top). */
    public function weight(): int
    {
        return match ($this) {
            self::High => 1,
            self::Medium => 2,
            self::Low => 3,
        };
    }

    /** @return string[] */
    public static function values(): array
    {
        return array_map(fn (self $p) => $p->value, self::cases());
    }
}
