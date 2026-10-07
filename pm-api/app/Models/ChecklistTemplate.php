<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/** PM checklist owned by an executor unit; copied into a task when the task is started. */
class ChecklistTemplate extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = ['executor_unit_id', 'name', 'description', 'is_active'];

    protected $casts = ['is_active' => 'boolean'];

    public function executorUnit(): BelongsTo
    {
        return $this->belongsTo(ExecutorUnit::class)->withTrashed();
    }

    public function items(): HasMany
    {
        return $this->hasMany(ChecklistTemplateItem::class)->orderBy('sort_order')->orderBy('id');
    }

    public function schedules(): HasMany
    {
        return $this->hasMany(PmSchedule::class);
    }
}
