<?php

namespace App\Models;

use App\Enums\WorkProgramActivityStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/** One row of the programme table: project/kegiatan, action plan, PICs, target, status, remarks. */
class WorkProgramActivity extends Model
{
    use HasFactory;
    use SoftDeletes;

    public const MORPH_ALIAS = 'work_program_activity';

    public const PIC_UTAMA = 'utama';
    public const PIC_PENDUKUNG = 'pendukung';

    protected $fillable = [
        'work_program_item_id', 'sequence', 'title', 'action_plan', 'target_date', 'closed_date',
        'status', 'progress_pct', 'remarks', 'created_by_id',
    ];

    protected $casts = [
        'target_date' => 'date',
        'closed_date' => 'date',
        'progress_pct' => 'integer',
        'sequence' => 'integer',
    ];

    public function getStatusAttribute(?string $value): ?WorkProgramActivityStatus
    {
        return $value === null ? null : WorkProgramActivityStatus::from($value);
    }

    public function setStatusAttribute(WorkProgramActivityStatus|string $value): void
    {
        $this->attributes['status'] = $value instanceof WorkProgramActivityStatus ? $value->value : WorkProgramActivityStatus::from($value)->value;
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(WorkProgramItem::class, 'work_program_item_id');
    }

    public function pics(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'work_program_activity_pics')->withPivot('role')->withTimestamps()
            ->orderByPivot('role', 'desc')->orderBy('name');
    }

    public function dailyActivities(): HasMany
    {
        return $this->hasMany(DailyActivity::class)->latest('activity_date');
    }

    public function logs(): MorphMany
    {
        return $this->morphMany(StatusLog::class, 'loggable')->latest('id');
    }

    public function isPic(User $user): bool
    {
        return $this->pics->contains('id', $user->id);
    }
}
