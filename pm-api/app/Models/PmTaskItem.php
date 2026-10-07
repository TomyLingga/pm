<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\MorphMany;

/** One checklist line of a PM task, with the technician's answer. */
class PmTaskItem extends Model
{
    public const MORPH_ALIAS = 'pm_task_item';

    protected $guarded = ['id'];

    protected $casts = [
        'sort_order' => 'integer',
        'min_value' => 'float',
        'max_value' => 'float',
        'value_number' => 'float',
        'is_required' => 'boolean',
        'photo_required' => 'boolean',
    ];

    public function task(): BelongsTo
    {
        return $this->belongsTo(PmTask::class, 'pm_task_id');
    }

    public function attachments(): MorphMany
    {
        return $this->morphMany(Attachment::class, 'attachable')->orderBy('id');
    }

    /** Work Order raised from this finding. */
    public function workOrder(): HasOne
    {
        return $this->hasOne(WorkOrder::class)->withTrashed();
    }
}
