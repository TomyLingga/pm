<?php

namespace App\Enums;

enum WorkOrderStatus: string
{
    case Submitted = 'submitted';
    case Received = 'received';
    case InProgress = 'in_progress';
    case Completed = 'completed';
    case Closed = 'closed';
    case Cancelled = 'cancelled';
    case Converted = 'converted';

    public function label(): string
    {
        return match ($this) {
            self::Submitted => 'DIAJUKAN',
            self::Received => 'DITERIMA',
            self::InProgress => 'DIKERJAKAN',
            self::Completed => 'SELESAI',
            self::Closed => 'CLOSED',
            self::Cancelled => 'DIBATALKAN',
            self::Converted => 'DIALIHKAN KE FORM REQUEST',
        };
    }

    public function isFinal(): bool
    {
        return in_array($this, [self::Closed, self::Cancelled, self::Converted], true);
    }

    /** @return array<string, string> value => label */
    public static function options(): array
    {
        $options = [];
        foreach (self::cases() as $case) {
            $options[$case->value] = $case->label();
        }

        return $options;
    }
}
