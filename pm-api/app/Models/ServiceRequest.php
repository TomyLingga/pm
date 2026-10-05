<?php

namespace App\Models;

use App\Enums\ApprovalStepStatus;
use App\Enums\Priority;
use App\Enums\ServiceRequestStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\Relations\MorphOne;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Digital version of form INLHO/BSIS-ITC/F-004. Transitions live in ServiceRequestService.
 *
 * @property ServiceRequestStatus $status
 * @property Priority $priority
 */
class ServiceRequest extends Model
{
    use HasFactory, SoftDeletes;

    public const MORPH_ALIAS = 'service_request';

    protected $guarded = ['id'];

    protected $casts = [
        'estimated_cost' => 'float',
        'revision_no' => 'integer',
        'submitted_at' => 'datetime',
        'completed_at' => 'datetime',
        'rejected_at' => 'datetime',
        'cancelled_at' => 'datetime',
        'converted_at' => 'datetime',
    ];

    public function getStatusAttribute(?string $value): ?ServiceRequestStatus
    {
        return $value === null ? null : ServiceRequestStatus::from($value);
    }

    public function setStatusAttribute(ServiceRequestStatus|string $value): void
    {
        $this->attributes['status'] = $value instanceof ServiceRequestStatus ? $value->value : ServiceRequestStatus::from($value)->value;
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

    public function office(): BelongsTo
    {
        return $this->belongsTo(Office::class)->withTrashed();
    }

    public function superior(): BelongsTo
    {
        return $this->belongsTo(User::class, 'superior_id');
    }

    public function assignedExecutor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_executor_id');
    }

    public function sourceWorkOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class, 'source_work_order_id')->withTrashed();
    }

    public function convertedWorkOrder(): BelongsTo
    {
        return $this->belongsTo(WorkOrder::class, 'converted_work_order_id')->withTrashed();
    }

    public function approvalSteps(): MorphMany
    {
        return $this->morphMany(ApprovalStep::class, 'approvable')->orderBy('round')->orderBy('step_order');
    }

    /** The step currently waiting for a decision. */
    public function pendingStep(): MorphOne
    {
        return $this->morphOne(ApprovalStep::class, 'approvable')->where('status', ApprovalStepStatus::Pending->value);
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

    public function hasStatus(ServiceRequestStatus ...$statuses): bool
    {
        return in_array($this->status, $statuses, true);
    }

    /** Number or "DRAFT" for display. */
    public function displayNumber(): string
    {
        return $this->request_number ?? 'DRAFT';
    }
}
