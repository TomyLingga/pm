<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

/**
 * Local copy of a Portal INTES employee. Credentials are never stored here.
 */
class User extends Authenticatable
{
    use HasApiTokens, HasFactory, HasRoles, Notifiable;

    /** The only global role: admin sees and manages everything. Everybody else is a regular user. */
    public const ROLE_ADMIN = 'admin';

    protected $guard_name = 'web';

    protected $fillable = [
        'portal_user_id',
        'portal_employee_id',
        'nrk',
        'name',
        'email',
        'phone',
        'employment_status',
        'position',
        'grade_code',
        'grade_level',
        'org_unit_id',
        'superior_id',
        'preferred_superior_id',
        'photo_url',
        'email_notifications',
        'is_active',
        'last_login_at',
        'profile_synced_at',
    ];

    protected $hidden = [
        'remember_token',
    ];

    protected $casts = [
        'grade_level' => 'integer',
        'is_active' => 'boolean',
        'email_notifications' => 'boolean',
        'last_login_at' => 'datetime',
        'profile_synced_at' => 'datetime',
    ];

    public function orgUnit(): BelongsTo
    {
        return $this->belongsTo(OrgUnit::class);
    }

    /** Superior according to Portal (`atasan_id`). */
    public function superior(): BelongsTo
    {
        return $this->belongsTo(self::class, 'superior_id');
    }

    /** Superior last chosen by the user on a Form Request. */
    public function preferredSuperior(): BelongsTo
    {
        return $this->belongsTo(self::class, 'preferred_superior_id');
    }

    public function pushSubscriptions(): HasMany
    {
        return $this->hasMany(PushSubscription::class);
    }

    public function isAdmin(): bool
    {
        return $this->hasRole(self::ROLE_ADMIN);
    }

    /** Only admins see every document of every unit; regular users see their unit's and their own. */
    public function canSeeEverything(): bool
    {
        return $this->isAdmin();
    }
}
