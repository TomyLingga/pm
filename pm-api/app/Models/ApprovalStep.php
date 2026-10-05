<?php

namespace App\Models;

use App\Enums\ApprovalStepStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * One step of a generic approval chain (see App\Services\Approvals\ApprovalEngine).
 *
 * @property ApprovalStepStatus $status
 */
class ApprovalStep extends Model
{
    public const KIND_SUBMISSION = 'submission';
    public const KIND_APPROVAL = 'approval';
    public const KIND_COMPLETION = 'completion';

    public const ASSIGNEE_USER = 'user';
    public const ASSIGNEE_EXECUTOR_LEAD = 'executor_lead';
    public const ASSIGNEE_EXECUTOR_STAFF = 'executor_staff';

    protected $guarded = ['id'];

    protected $casts = [
        'round' => 'integer',
        'step_order' => 'integer',
        'activated_at' => 'datetime',
        'acted_at' => 'datetime',
        'last_reminded_at' => 'datetime',
    ];

    public function getStatusAttribute(?string $value): ?ApprovalStepStatus
    {
        return $value === null ? null : ApprovalStepStatus::from($value);
    }

    public function setStatusAttribute(ApprovalStepStatus|string $value): void
    {
        $this->attributes['status'] = $value instanceof ApprovalStepStatus ? $value->value : ApprovalStepStatus::from($value)->value;
    }

    public function approvable(): MorphTo
    {
        return $this->morphTo();
    }

    public function assigneeUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assignee_user_id');
    }

    public function executorUnit(): BelongsTo
    {
        return $this->belongsTo(ExecutorUnit::class)->withTrashed();
    }

    public function actedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'acted_by_id');
    }

    public function isPending(): bool
    {
        return $this->status === ApprovalStepStatus::Pending;
    }

    /** Human readable "who should act", e.g. "Indra Sakti Lubis" or "Pimpinan Sistem dan IT". */
    public function assigneeLabel(): string
    {
        return match ($this->assignee_type) {
            self::ASSIGNEE_USER => $this->assigneeUser?->name ?? '-',
            self::ASSIGNEE_EXECUTOR_LEAD => 'Pimpinan '.($this->executorUnit?->display_name ?? 'unit pelaksana'),
            default => 'Tim '.($this->executorUnit?->display_name ?? 'unit pelaksana'),
        };
    }
}
