<?php

namespace App\Http\Resources;

use App\Models\DocumentSignature;
use App\Models\StatusLog;
use App\Models\WorkOrderClearance;
use App\Models\WorkOrderLabour;
use App\Models\WorkOrderMaterial;
use App\Services\WorkOrders\WorkOrderService;
use Illuminate\Support\Facades\Gate;

/** @mixin \App\Models\WorkOrder */
class WorkOrderResource extends WorkOrderListResource
{
    public const RELATIONS = [
        'executorUnit',
        'serviceCategory',
        'location',
        'equipment',
        'requester',
        'activeAssignments.user',
        'receivedBy',
        'pickedBy',
        'completedBy',
        'acceptedBy',
        'materials',
        'labours',
        'clearances.mtcConfirmedBy',
        'clearances.userConfirmedBy',
        'attachments.uploadedBy',
        'signatures',
        'statusLogs.user',
        'sourceServiceRequest',
        'convertedServiceRequest',
    ];

    public const ACTION_LABELS = [
        'convert' => 'Dialihkan ke Form Request',
        'create' => 'WO diajukan',
        'update' => 'WO diubah',
        'cancel' => 'WO dibatalkan',
        'pick' => 'WO diambil teknisi',
        'receive' => 'WO diterima & ditugaskan',
        'reassign' => 'Teknisi diubah',
        'start' => 'Pekerjaan dimulai',
        'update_materials' => 'Material diperbarui',
        'update_labours' => 'Pekerja diperbarui',
        'complete' => 'Pekerjaan selesai',
        'accept' => 'Hasil diterima user',
        'reject' => 'Hasil ditolak user',
        'auto_accept' => 'Diterima otomatis',
    ];

    public function toArray($request): array
    {
        $user = $request->user();
        $gate = Gate::forUser($user);
        $can = fn (string $ability, ?string $statusAction = null) => $user
            && $gate->allows($ability, $this->resource)
            && WorkOrderService::statusAllows($this->resource, $statusAction ?? $ability);

        return array_merge(parent::toArray($request), [
            'requester_org_unit_name' => $this->requester_org_unit_name,
            'requester_bagian_name' => $this->requester_bagian_name,
            'equipment' => $this->equipment ? [
                'id' => $this->equipment->id,
                'code' => $this->equipment->code,
                'name' => $this->equipment->name,
            ] : null,
            'location' => $this->location ? [
                'id' => $this->location->id,
                'code' => $this->location->code,
                'name' => $this->location->name,
            ] : null,
            'location_note' => $this->location_note,
            'received_by' => $this->brief($this->receivedBy),
            'received_at' => $this->received_at?->toIso8601String(),
            'picked_by' => $this->brief($this->pickedBy),
            'completed_by' => $this->brief($this->completedBy),
            'work_done' => $this->work_done,
            'accepted_by' => $this->brief($this->acceptedBy),
            'accepted_at' => $this->accepted_at?->toIso8601String(),
            'auto_accepted' => $this->auto_accepted,
            'acceptance_due_at' => $this->acceptance_due_at?->toIso8601String(),
            'total_breakdown_hours' => $this->total_breakdown_hours,
            'remarks' => $this->remarks,
            'rework_count' => $this->rework_count,
            'cancel_reason' => $this->cancel_reason,
            'cancelled_at' => $this->cancelled_at?->toIso8601String(),
            'sla_minutes' => $this->slaMinutes(),
            'conversion_reason' => $this->conversion_reason,
            'converted_at' => $this->converted_at?->toIso8601String(),
            'source_service_request' => $this->sourceServiceRequest
                ? ['id' => $this->sourceServiceRequest->id, 'request_number' => $this->sourceServiceRequest->request_number] : null,
            'converted_service_request' => $this->convertedServiceRequest
                ? ['id' => $this->convertedServiceRequest->id, 'request_number' => $this->convertedServiceRequest->request_number] : null,
            'materials' => $this->materials->map(fn (WorkOrderMaterial $m) => [
                'id' => $m->id,
                'material_id' => $m->material_id,
                'material_name' => $m->material_name,
                'quantity' => $m->quantity,
                'unit' => $m->unit,
            ])->values(),
            'labours' => $this->labours->map(fn (WorkOrderLabour $l) => [
                'id' => $l->id,
                'user_id' => $l->user_id,
                'worker_name' => $l->worker_name,
                'started_at' => $l->started_at->toIso8601String(),
                'finished_at' => $l->finished_at->toIso8601String(),
                'duration_minutes' => $l->duration_minutes,
            ])->values(),
            'total_labour_minutes' => (int) $this->labours->sum('duration_minutes'),
            'clearances' => $this->clearances->map(fn (WorkOrderClearance $c) => [
                'item_no' => $c->item_no,
                'item_label' => $c->item_label,
                'mtc_result' => $c->mtc_result,
                'mtc_confirmed_by' => $this->brief($c->mtcConfirmedBy),
                'mtc_confirmed_at' => $c->mtc_confirmed_at?->toIso8601String(),
                'user_result' => $c->user_result,
                'user_confirmed_by' => $this->brief($c->userConfirmedBy),
                'user_confirmed_at' => $c->user_confirmed_at?->toIso8601String(),
            ])->values(),
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
                'user' => $this->brief($log->user),
                'created_at' => $log->created_at?->toIso8601String(),
            ])->values(),
            'permissions' => [
                'can_update' => $can('update'),
                'can_cancel' => $can('cancel'),
                'can_pick' => $can('pick'),
                'can_receive' => $can('receive'),
                'can_reassign' => $can('reassign'),
                'can_start' => $can('start'),
                'can_work' => $can('work'),
                'can_complete' => $can('complete'),
                'can_accept' => $can('accept'),
                'can_upload' => $can('upload'),
                'can_convert' => $can('convert'),
            ],
        ]);
    }

    private function brief($user): ?array
    {
        return $user ? (new UserBriefResource($user))->toArray(request()) : null;
    }
}
