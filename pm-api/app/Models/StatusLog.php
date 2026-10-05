<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/** Audit trail entry for a status change or business action. */
class StatusLog extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['action', 'from_status', 'to_status', 'notes', 'meta', 'user_id'];

    protected $casts = ['meta' => 'array'];

    public function loggable(): MorphTo
    {
        return $this->morphTo();
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
