<?php

namespace App\Models;

use App\Enums\DailyActivityStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/** Laporan aktivitas harian of one person (optionally tied to a programme activity or created from a completed WO). */
class DailyActivity extends Model
{
    use HasFactory;
    use SoftDeletes;

    public const MORPH_ALIAS = 'daily_activity';

    protected $fillable = [
        'user_id', 'org_unit_id', 'work_program_activity_id', 'work_order_id', 'activity_date', 'title', 'description',
        'follow_up', 'obstacles', 'status', 'closed_at', 'created_by_id',
    ];

    protected $casts = [
        'activity_date' => 'date',
        'closed_at' => 'datetime',
    ];

    public function getStatusAttribute(?string $value): ?DailyActivityStatus
    {
        return $value === null ? null : DailyActivityStatus::from($value);
    }

    public function setStatusAttribute(DailyActivityStatus|string $value): void
    {
        $this->attributes['status'] = $value instanceof DailyActivityStatus ? $value->value : DailyActivityStatus::from($value)->value;
    }

    /** Week of the month as used on the report: 1-7 → 1, 8-14 → 2, 15-21 → 3, 22-28 → 4, 29-31 → 5. */
    public function getWeekOfMonthAttribute(): int
    {
        return (int) min(5, intdiv($this->activity_date->day - 1, 7) + 1);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function orgUnit(): BelongsTo
    {
        return $this->belongsTo(OrgUnit::class);
    }

    public function programActivity(): BelongsTo
    {
        return $this->belongsTo(WorkProgramActivity::class, 'work_program_activity_id');
    }

    public function workOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_id');
    }

    public function logs(): MorphMany
    {
        return $this->morphMany(StatusLog::class, 'loggable')->latest('id');
    }
}
