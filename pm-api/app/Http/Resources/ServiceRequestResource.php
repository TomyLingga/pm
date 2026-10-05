<?php

namespace App\Http\Resources;

use App\Models\ApprovalStep;
use App\Models\DocumentSignature;
use App\Models\OrgUnit;
use App\Models\StatusLog;
use App\Services\ServiceRequests\ServiceRequestService;
use Illuminate\Support\Facades\Gate;

/** @mixin \App\Models\ServiceRequest */
class ServiceRequestResource extends ServiceRequestListResource
{
    public const RELATIONS = [
        'executorUnit',
        'serviceCategory',
        'office',
        'requester.orgUnit',
        'superior',
        'assignedExecutor',
        'sourceWorkOrder',
        'convertedWorkOrder',
        'pendingStep.assigneeUser',
        'pendingStep.executorUnit',
        'approvalSteps.assigneeUser',
        'approvalSteps.executorUnit',
        'approvalSteps.actedBy',
        'attachments.uploadedBy',
        'signatures',
        'statusLogs.user',
    ];

    public const ACTION_LABELS = [
        'create' => 'Draft dibuat',
        'update' => 'Draft diubah',
        'submit' => 'Diajukan',
        'change_superior' => 'Atasan diganti',
        'approve' => 'Disetujui',
        'reject' => 'Ditolak',
        'request_revision' => 'Diminta revisi',
        'complete' => 'Diselesaikan',
        'cancel' => 'Dibatalkan',
        'convert' => 'Dialihkan ke Work Order',
    ];

    public function toArray($request): array
    {
        $user = $request->user();
        $gate = Gate::forUser($user);
        $can = fn (string $ability, string $statusAction) => $user
            && $gate->allows($ability, $this->resource)
            && ServiceRequestService::statusAllows($this->resource, $statusAction);
        $steps = $this->approvalSteps;

        return array_merge(parent::toArray($request), [
            'estimated_cost' => $this->estimated_cost,
            'identity' => $this->identity(),
            'superior' => $this->superior ? array_merge(
                (new UserBriefResource($this->superior))->toArray($request),
                ['grade_code' => $this->superior->grade_code],
            ) : null,
            'assigned_executor' => $this->assignedExecutor ? (new UserBriefResource($this->assignedExecutor))->toArray($request) : null,
            'executor_notes' => $this->executor_notes,
            'rules' => $this->submitted_at ? $this->rules_snapshot : $this->executorUnit->request_rules,
            'contact_footer' => $this->submitted_at ? $this->contact_footer_snapshot : $this->executorUnit->contact_footer,
            'cancel_reason' => $this->cancel_reason,
            'cancelled_at' => $this->cancelled_at?->toIso8601String(),
            'rejected_at' => $this->rejected_at?->toIso8601String(),
            'conversion_reason' => $this->conversion_reason,
            'converted_at' => $this->converted_at?->toIso8601String(),
            'source_work_order' => $this->sourceWorkOrder
                ? ['id' => $this->sourceWorkOrder->id, 'wo_number' => $this->sourceWorkOrder->wo_number] : null,
            'converted_work_order' => $this->convertedWorkOrder
                ? ['id' => $this->convertedWorkOrder->id, 'wo_number' => $this->convertedWorkOrder->wo_number] : null,
            'approval_steps' => ApprovalStepResource::collection(
                $steps->filter(fn (ApprovalStep $s) => $s->round === $this->revision_no)->values()
            ),
            'approval_history' => ApprovalStepResource::collection($steps->values()),
            'attachments' => AttachmentResource::collection($this->attachments),
            'signatures' => $this->signatures->filter(fn (DocumentSignature $s) => $s->isValid())
                ->map(fn (DocumentSignature $s) => [
                    'role_key' => $s->role_key,
                    'role_label' => $s->role_label,
                    'signer_name' => $s->signer_name,
                    'signed_at' => $s->signed_at->toIso8601String(),
                    'verify_url' => $s->verifyUrl(),
                ])->values(),
            'logs' => $this->statusLogs->map(fn (StatusLog $log) => [
                'id' => $log->id,
                'action' => $log->action,
                'action_label' => self::ACTION_LABELS[$log->action] ?? $log->action,
                'from_status' => $log->from_status,
                'to_status' => $log->to_status,
                'notes' => $log->notes,
                'user' => $log->user ? (new UserBriefResource($log->user))->toArray($request) : null,
                'created_at' => $log->created_at?->toIso8601String(),
            ])->values(),
            'permissions' => [
                'can_update' => $can('update', 'update'),
                'can_delete' => $can('delete', 'delete') && $this->request_number === null,
                'can_submit' => $can('submit', 'submit'),
                'can_cancel' => $can('cancel', 'cancel'),
                'can_change_superior' => $can('changeSuperior', 'change_superior'),
                'can_approve' => $can('decide', 'approve'),
                'can_reject' => $can('decide', 'reject'),
                'can_request_revision' => $can('decide', 'request_revision'),
                'can_complete' => $can('complete', 'complete'),
                'can_convert' => $can('convert', 'convert'),
                'can_upload' => $can('upload', 'upload'),
            ],
        ]);
    }

    /** "IDENTITAS KARYAWAN": snapshot once submitted, live profile while still a fresh draft. */
    private function identity(): array
    {
        if ($this->submitted_at) {
            return [
                'name' => $this->requester_name,
                'employment_status' => $this->requester_employment_status,
                'nrk' => $this->requester_nrk,
                'position' => $this->requester_position,
                'superior_name' => $this->superior_name,
                'bagian' => $this->requester_bagian_name,
                'sub_bagian' => $this->requester_sub_bagian_name,
                'email' => $this->requester_email,
                'phone' => $this->requester_phone,
            ];
        }

        $requester = $this->requester;
        /** @var OrgUnit|null $unit */
        $unit = $requester->orgUnit;

        return [
            'name' => $requester->name,
            'employment_status' => $requester->employment_status,
            'nrk' => $requester->nrk,
            'position' => $requester->position,
            'superior_name' => $this->superior?->name,
            'bagian' => $unit?->ancestorOfType(OrgUnit::TYPE_BAGIAN)?->name,
            'sub_bagian' => $unit?->ancestorOfType(OrgUnit::TYPE_SUB_BAGIAN)?->name,
            'email' => $requester->email,
            'phone' => $requester->phone,
        ];
    }
}
