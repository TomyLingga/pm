<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ChecklistTemplateItem extends Model
{
    /** Columns copied verbatim into `pm_task_items` when a task starts. */
    public const DEFINITION_COLUMNS = [
        'sort_order', 'section', 'description', 'input_type', 'unit', 'min_value', 'max_value', 'is_required', 'photo_required',
    ];

    protected $fillable = self::DEFINITION_COLUMNS;

    protected $casts = [
        'sort_order' => 'integer',
        'min_value' => 'float',
        'max_value' => 'float',
        'is_required' => 'boolean',
        'photo_required' => 'boolean',
    ];

    public function template(): BelongsTo
    {
        return $this->belongsTo(ChecklistTemplate::class, 'checklist_template_id');
    }
}
