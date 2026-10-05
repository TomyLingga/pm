<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * A Portal section (seksi) acting as executor of work orders, e.g. "IT" or "MTC".
 */
class ExecutorUnit extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'org_unit_id',
        'code',
        'display_name',
        'accepts_work_orders',
        'accepts_requests',
        'has_pm',
        'request_rules',
        'contact_footer',
        'is_active',
    ];

    protected $casts = [
        'accepts_work_orders' => 'boolean',
        'accepts_requests' => 'boolean',
        'has_pm' => 'boolean',
        'is_active' => 'boolean',
    ];

    public function orgUnit(): BelongsTo
    {
        return $this->belongsTo(OrgUnit::class);
    }

    public function categories(): HasMany
    {
        return $this->hasMany(ServiceCategory::class)->orderBy('sort_order')->orderBy('name');
    }

    public function members(): HasMany
    {
        return $this->hasMany(ExecutorUnitMember::class);
    }
}
