<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Program Kerja Tahunan of an org unit ("A - ENABLING DIGITAL AND RELIABLE OPERATION"),
 * made of sub-items (A.1, A.2, ...) that hold the activities.
 */
class WorkProgram extends Model
{
    use HasFactory;
    use SoftDeletes;

    public const MORPH_ALIAS = 'work_program';

    public const STATUS_ACTIVE = 'active';
    public const STATUS_CLOSED = 'closed';

    protected $fillable = ['year', 'code', 'title', 'description', 'org_unit_id', 'status', 'created_by_id'];

    protected $casts = ['year' => 'integer'];

    public function orgUnit(): BelongsTo
    {
        return $this->belongsTo(OrgUnit::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(WorkProgramItem::class)->orderBy('sort_order')->orderBy('id');
    }

    public function activities(): HasManyThrough
    {
        return $this->hasManyThrough(WorkProgramActivity::class, WorkProgramItem::class);
    }

    public function logs(): MorphMany
    {
        return $this->morphMany(StatusLog::class, 'loggable')->latest('id');
    }

    /** Average activity progress (cancelled ones excluded); null when there is nothing to measure. */
    public static function progressOf(iterable $activities): ?int
    {
        $values = [];
        foreach ($activities as $activity) {
            if ($activity->status->value === 'cancelled') {
                continue;
            }
            $values[] = (int) $activity->progress_pct;
        }

        return $values ? (int) round(array_sum($values) / count($values)) : null;
    }
}
