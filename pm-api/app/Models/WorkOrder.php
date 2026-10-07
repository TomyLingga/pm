<?php

namespace App\Models;

use App\Enums\Priority;
use App\Enums\WorkOrderStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Collection;

/**
 * Digital version of form FM-BOPS-10/05. Status transitions live in WorkOrderService.
 *
 * @property WorkOrderStatus $status
 * @property Priority $priority
 */
class WorkOrder extends Model
{
    use HasFactory, SoftDeletes;

    public const MORPH_ALIAS = 'work_order';

    protected $guarded = ['id'];

    protected $casts = [
        'issued_at' => 'datetime',
        'received_at' => 'datetime',
        'picked_at' => 'datetime',
        'completed_at' => 'datetime',
        'accepted_at' => 'datetime',
        'acceptance_due_at' => 'datetime',
        'cancelled_at' => 'datetime',
        'closed_at' => 'datetime',
        'converted_at' => 'datetime',
        'auto_accepted' => 'boolean',
        'total_breakdown_hours' => 'float',
        'rework_count' => 'integer',
    ];

    // Laravel 8 has no native enum casts, so enums are exposed through accessors.
    public function getStatusAttribute(?string $value): ?WorkOrderStatus
    {
        return $value === null ? null : WorkOrderStatus::from($value);
    }

    public function setStatusAttribute(WorkOrderStatus|string $value): void
    {
        $this->attributes['status'] = $value instanceof WorkOrderStatus ? $value->value : WorkOrderStatus::from($value)->value;
    }

    public function getPriorityAttribute(?string $value): ?Priority
    {
        return $value === null ? null : Priority::from($value);
    }

    public function setPriorityAttribute(Priority|string $value): void
    {
        $this->attributes['priority'] = $value instanceof Priority ? $value->value : Priority::from($value)->value;
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requester_id');
    }

    public function requesterOrgUnit(): BelongsTo
    {
        return $this->belongsTo(OrgUnit::class, 'requester_org_unit_id');
    }

    public function executorUnit(): BelongsTo
    {
        return $this->belongsTo(ExecutorUnit::class)->withTrashed();
    }

    public function serviceCategory(): BelongsTo
    {
        return $this->belongsTo(ServiceCategory::class)->withTrashed();
    }

    public function equipment(): BelongsTo
    {
        return $this->belongsTo(Equipment::class)->withTrashed();
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class)->withTrashed();
    }

    public function receivedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by_id');
    }

    public function pickedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'picked_by_id');
    }

    public function completedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'completed_by_id');
    }

    public function acceptedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'accepted_by_id');
    }

    /** All assignment rows, including historical ones. */
    public function assignments(): HasMany
    {
        return $this->hasMany(WorkOrderAssignee::class);
    }

    /** Currently active assignments. */
    public function activeAssignments(): HasMany
    {
        return $this->hasMany(WorkOrderAssignee::class)->whereNull('unassigned_at')->orderByDesc('is_lead')->orderBy('id');
    }

    public function materials(): HasMany
    {
        return $this->hasMany(WorkOrderMaterial::class)->orderBy('id');
    }

    public function labours(): HasMany
    {
        return $this->hasMany(WorkOrderLabour::class)->orderBy('started_at');
    }

    public function clearances(): HasMany
    {
        return $this->hasMany(WorkOrderClearance::class)->orderBy('item_no');
    }

    public function attachments(): MorphMany
    {
        return $this->morphMany(Attachment::class, 'attachable')->orderBy('id');
    }

    public function statusLogs(): MorphMany
    {
        return $this->morphMany(StatusLog::class, 'loggable')->orderBy('id');
    }

    public function signatures(): MorphMany
    {
        return $this->morphMany(DocumentSignature::class, 'signable')->orderBy('id');
    }

    /** PM task (and checklist item) whose "Tidak OK" finding raised this Work Order. */
    public function pmTask(): BelongsTo
    {
        return $this->belongsTo(PmTask::class);
    }

    public function pmTaskItem(): BelongsTo
    {
        return $this->belongsTo(PmTaskItem::class);
    }

    public function sourceServiceRequest(): BelongsTo
    {
        return $this->belongsTo(ServiceRequest::class, 'source_service_request_id')->withTrashed();
    }

    public function convertedServiceRequest(): BelongsTo
    {
        return $this->belongsTo(ServiceRequest::class, 'converted_service_request_id')->withTrashed();
    }

    public function hasStatus(WorkOrderStatus ...$statuses): bool
    {
        return in_array($this->status, $statuses, true);
    }

    public function isAssignee(User $user): bool
    {
        return $this->activeAssignments->contains('user_id', $user->id);
    }

    /** @return Collection<int, User> */
    public function assigneeUsers(): Collection
    {
        return $this->activeAssignments->map->user->filter()->values();
    }

    /** Minutes from the technician picking the job to the (last) completion. */
    public function slaMinutes(): ?int
    {
        if (! $this->picked_at || ! $this->completed_at) {
            return null;
        }

        return (int) $this->picked_at->diffInMinutes($this->completed_at);
    }
}
