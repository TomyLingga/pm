<?php

namespace App\Enums;

enum ApprovalStepStatus: string
{
    case Waiting = 'waiting';
    case Pending = 'pending';
    case Approved = 'approved';
    case Completed = 'completed';
    case Rejected = 'rejected';
    case RevisionRequested = 'revision_requested';
    case Skipped = 'skipped';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::Waiting => 'Belum giliran',
            self::Pending => 'Menunggu',
            self::Approved => 'Disetujui',
            self::Completed => 'Selesai',
            self::Rejected => 'Ditolak',
            self::RevisionRequested => 'Minta revisi',
            self::Skipped => 'Dilewati',
            self::Cancelled => 'Dibatalkan',
        };
    }

    /** The step has been signed off positively. */
    public function isPositive(): bool
    {
        return in_array($this, [self::Approved, self::Completed], true);
    }
}
