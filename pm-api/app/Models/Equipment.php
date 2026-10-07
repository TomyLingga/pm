<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Equipment extends Model
{
    use HasFactory, SoftDeletes;

    public const STATUSES = [
        'active' => 'Aktif',
        'under_repair' => 'Dalam Perbaikan',
        'inactive' => 'Tidak Aktif',
        'disposed' => 'Dihapuskan',
    ];

    protected $table = 'equipment';

    protected $fillable = [
        'code',
        'name',
        'location_id',
        'executor_unit_id',
        'brand',
        'model',
        'serial_number',
        'status',
    ];

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function executorUnit(): BelongsTo
    {
        return $this->belongsTo(ExecutorUnit::class);
    }

    public function pmSchedules(): BelongsToMany
    {
        return $this->belongsToMany(PmSchedule::class, 'pm_schedule_equipment');
    }

    public function pmTasks(): HasMany
    {
        return $this->hasMany(PmTask::class);
    }

    public function workOrders(): HasMany
    {
        return $this->hasMany(WorkOrder::class);
    }

    public function statusLabel(): string
    {
        return self::STATUSES[$this->status] ?? $this->status;
    }
}
