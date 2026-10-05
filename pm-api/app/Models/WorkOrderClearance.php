<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One row of the "Maintenance Clearance Checklist" (MTC and user confirmation). */
class WorkOrderClearance extends Model
{
    protected $fillable = [
        'item_no',
        'item_label',
        'mtc_result',
        'mtc_confirmed_by_id',
        'mtc_confirmed_at',
        'user_result',
        'user_confirmed_by_id',
        'user_confirmed_at',
    ];

    protected $casts = [
        'item_no' => 'integer',
        'mtc_confirmed_at' => 'datetime',
        'user_confirmed_at' => 'datetime',
    ];

    public function mtcConfirmedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'mtc_confirmed_by_id');
    }

    public function userConfirmedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_confirmed_by_id');
    }
}
