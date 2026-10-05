<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Manual staff override for an executor unit (on top of org-unit membership). */
class ExecutorUnitMember extends Model
{
    public const INCLUDE = 'include';
    public const EXCLUDE = 'exclude';

    protected $fillable = ['executor_unit_id', 'user_id', 'membership', 'note'];

    public function executorUnit(): BelongsTo
    {
        return $this->belongsTo(ExecutorUnit::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
