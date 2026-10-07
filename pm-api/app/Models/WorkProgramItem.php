<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/** Sub-item of a work programme ("A.1 - IT Development"). */
class WorkProgramItem extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $fillable = ['work_program_id', 'code', 'title', 'description', 'sort_order'];

    public function program(): BelongsTo
    {
        return $this->belongsTo(WorkProgram::class, 'work_program_id');
    }

    public function activities(): HasMany
    {
        return $this->hasMany(WorkProgramActivity::class)->orderBy('sequence')->orderBy('id');
    }
}
