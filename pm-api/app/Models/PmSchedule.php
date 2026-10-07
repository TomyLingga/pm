<?php

namespace App\Models;

use App\Enums\PmFrequency;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Recurring PM plan: which equipment, which checklist, how often, who is responsible.
 * One task per equipment is generated for every occurrence (see PmTaskGenerator).
 *
 * @property PmFrequency $frequency_type
 */
class PmSchedule extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'executor_unit_id',
        'checklist_template_id',
        'frequency_type',
        'frequency_interval',
        'start_at',
        'end_at',
        'tolerance_hours',
        'due_window_hours',
        'estimated_minutes',
        'pic_user_id',
        'generated_until',
        'is_active',
        'created_by_id',
    ];

    protected $casts = [
        'frequency_interval' => 'integer',
        'start_at' => 'datetime',
        'end_at' => 'datetime',
        'tolerance_hours' => 'integer',
        'due_window_hours' => 'integer',
        'estimated_minutes' => 'integer',
        'generated_until' => 'datetime',
        'is_active' => 'boolean',
    ];

    public function getFrequencyTypeAttribute(?string $value): ?PmFrequency
    {
        return $value === null ? null : PmFrequency::from($value);
    }

    public function setFrequencyTypeAttribute(PmFrequency|string $value): void
    {
        $this->attributes['frequency_type'] = $value instanceof PmFrequency ? $value->value : PmFrequency::from($value)->value;
    }

    public function executorUnit(): BelongsTo
    {
        return $this->belongsTo(ExecutorUnit::class)->withTrashed();
    }

    public function checklistTemplate(): BelongsTo
    {
        return $this->belongsTo(ChecklistTemplate::class)->withTrashed();
    }

    public function pic(): BelongsTo
    {
        return $this->belongsTo(User::class, 'pic_user_id');
    }

    public function equipment(): BelongsToMany
    {
        return $this->belongsToMany(Equipment::class, 'pm_schedule_equipment')->orderBy('equipment.code');
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(PmTask::class);
    }

    public function frequencyLabel(): string
    {
        return $this->frequency_type->label($this->frequency_interval);
    }

    /** Shortest distance between two occurrences, in hours. */
    public function intervalHours(): int
    {
        return $this->frequency_type->intervalHours($this->frequency_interval);
    }

    public function configuredWindowHours(): int
    {
        return $this->due_window_hours ?? (int) config('pm.preventive.due_window_hours');
    }

    /**
     * Lead time before due_at at which a task becomes JATUH_TEMPO (and may be started).
     * Only schedules whose occurrences are further apart than the window get one; for tight schedules
     * (per N hours, daily) a task opens exactly at its due time, so the next occurrence is never
     * open while the current one is still waiting.
     */
    public function windowHours(): int
    {
        return $this->sendsUpcomingReminder() ? $this->configuredWindowHours() : 0;
    }

    /** The early (H-n) reminder only makes sense when occurrences are further apart than the window. */
    public function sendsUpcomingReminder(): bool
    {
        return $this->configuredWindowHours() < $this->intervalHours();
    }

    public function horizonDays(): int
    {
        return (int) config($this->frequency_type === PmFrequency::Hourly
            ? 'pm.preventive.horizon_days_hourly'
            : 'pm.preventive.horizon_days');
    }
}
