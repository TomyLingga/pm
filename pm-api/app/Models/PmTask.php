<?php

namespace App\Models;

use App\Enums\ChecklistResult;
use App\Enums\PmTaskStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;

/**
 * One PM job: a schedule occurrence for a single equipment. Transitions live in PmTaskService
 * (user actions) and PmStatusRefresher (time based).
 *
 * @property PmTaskStatus $status
 */
class PmTask extends Model
{
    use HasFactory;

    public const MORPH_ALIAS = 'pm_task';

    protected $guarded = ['id'];

    protected $casts = [
        'due_at' => 'datetime',
        'due_window_at' => 'datetime',
        'overdue_at' => 'datetime',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
        'skipped_at' => 'datetime',
        'skip_proposed_at' => 'datetime',
        'reminder_upcoming_sent_at' => 'datetime',
        'reminder_due_sent_at' => 'datetime',
        'last_overdue_reminder_at' => 'datetime',
        'duration_minutes' => 'integer',
        'is_late' => 'boolean',
    ];

    public function getStatusAttribute(?string $value): ?PmTaskStatus
    {
        return $value === null ? null : PmTaskStatus::from($value);
    }

    public function setStatusAttribute(PmTaskStatus|string $value): void
    {
        $this->attributes['status'] = $value instanceof PmTaskStatus ? $value->value : PmTaskStatus::from($value)->value;
    }

    public function getNumberAttribute(): string
    {
        return sprintf('PM-%06d', $this->id);
    }

    public function schedule(): BelongsTo
    {
        return $this->belongsTo(PmSchedule::class, 'pm_schedule_id')->withTrashed();
    }

    public function equipment(): BelongsTo
    {
        return $this->belongsTo(Equipment::class)->withTrashed();
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

    public function startedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'started_by_id');
    }

    public function completedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'completed_by_id');
    }

    public function skippedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'skipped_by_id');
    }

    public function skipProposedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'skip_proposed_by_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(PmTaskItem::class)->orderBy('sort_order')->orderBy('id');
    }

    /** Items answered "Tidak OK". */
    public function findings(): HasMany
    {
        return $this->hasMany(PmTaskItem::class)->where('result', ChecklistResult::NotOk->value);
    }

    public function materials(): HasMany
    {
        return $this->hasMany(PmTaskMaterial::class)->orderBy('id');
    }

    /** General photos of the task (per-item photos hang on PmTaskItem). */
    public function attachments(): MorphMany
    {
        return $this->morphMany(Attachment::class, 'attachable')->orderBy('id');
    }

    public function statusLogs(): MorphMany
    {
        return $this->morphMany(StatusLog::class, 'loggable')->orderBy('id');
    }

    public function workOrders(): HasMany
    {
        return $this->hasMany(WorkOrder::class);
    }

    public function hasStatus(PmTaskStatus ...$statuses): bool
    {
        return in_array($this->status, $statuses, true);
    }
}
