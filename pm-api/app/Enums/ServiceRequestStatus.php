<?php

namespace App\Enums;

enum ServiceRequestStatus: string
{
    case Draft = 'draft';
    case WaitingSuperior = 'waiting_superior';
    case WaitingExecutor = 'waiting_executor';
    case InProgress = 'in_progress';
    case Completed = 'completed';
    case Rejected = 'rejected';
    case Cancelled = 'cancelled';
    case Converted = 'converted';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'DRAFT',
            self::WaitingSuperior => 'MENUNGGU_ATASAN',
            self::WaitingExecutor => 'MENUNGGU_DIVISI',
            self::InProgress => 'DIPROSES',
            self::Completed => 'SELESAI',
            self::Rejected => 'DITOLAK',
            self::Cancelled => 'DIBATALKAN',
            self::Converted => 'DIALIHKAN KE WO',
        };
    }

    public function isFinal(): bool
    {
        return in_array($this, [self::Completed, self::Rejected, self::Cancelled, self::Converted], true);
    }
}
