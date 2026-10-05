<?php

namespace App\Services\Audit;

use App\Models\StatusLog;
use App\Models\User;
use BackedEnum;
use Illuminate\Database\Eloquent\Model;

/**
 * Writes the audit trail required for every WO/Request/PM status change.
 */
class StatusLogger
{
    public function log(
        Model $subject,
        string $action,
        BackedEnum|string|null $from,
        BackedEnum|string|null $to,
        ?User $user,
        ?string $notes = null,
        array $meta = [],
    ): StatusLog {
        $log = new StatusLog([
            'action' => $action,
            'from_status' => $from instanceof BackedEnum ? $from->value : $from,
            'to_status' => $to instanceof BackedEnum ? $to->value : $to,
            'notes' => $notes,
            'meta' => $meta ?: null,
            'user_id' => $user?->id,
        ]);
        $log->loggable()->associate($subject);
        $log->save();

        return $log;
    }
}
