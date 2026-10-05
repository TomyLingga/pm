<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Category managed per executor unit, used by work orders and form requests.
 */
class ServiceCategory extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'executor_unit_id',
        'name',
        'for_work_order',
        'for_request',
        'requires_note',
        'sort_order',
        'is_active',
    ];

    protected $casts = [
        'for_work_order' => 'boolean',
        'for_request' => 'boolean',
        'requires_note' => 'boolean',
        'is_active' => 'boolean',
    ];

    public function executorUnit(): BelongsTo
    {
        return $this->belongsTo(ExecutorUnit::class);
    }
}
