<?php

namespace App\Services\ServiceRequests;

use App\Enums\ApprovalStepStatus;
use App\Enums\ServiceRequestStatus;
use App\Exceptions\InvalidTransitionException;
use App\Models\ApprovalStep;
use App\Models\ExecutorUnit;
use App\Models\OrgUnit;
use App\Models\ServiceRequest;
use App\Models\User;
use App\Services\Approvals\ApprovalEngine;
use App\Services\Approvals\StepDefinition;
use App\Services\Audit\StatusLogger;
use App\Services\Documents\SignatureService;
use App\Services\Org\ExecutorDirectory;
use App\Services\Support\NumberSequenceService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Form Request (INLHO/BSIS-ITC/F-004) rules: draft → Atasan YBS → Mgr/Spv Divisi → Foreman Divisi.
 * The approval chain itself is handled by the generic ApprovalEngine.
 * Who may act → ServiceRequestPolicy / ApprovalEngine::canAct (403); when → this class (409).
 */
class ServiceRequestService
{
    public const STEP_SUBMISSION = 'submission';
    public const STEP_SUPERIOR = 'superior';
    public const STEP_EXECUTOR_LEAD = 'executor_lead';
    public const STEP_EXECUTOR = 'executor';

    /** Rows of the "PENGESAHAN" block, in order. */
    public const STEPS = [
        self::STEP_SUBMISSION => ['label' => 'Yang Bersangkutan', 'verb' => 'Diminta oleh'],
        self::STEP_SUPERIOR => ['label' => 'Atasan YBS', 'verb' => 'Disetujui oleh'],
        self::STEP_EXECUTOR_LEAD => ['label' => 'Mgr/Spv Divisi', 'verb' => 'Disetujui oleh'],
        self::STEP_EXECUTOR => ['label' => 'Foreman Divisi', 'verb' => 'Diselesaikan oleh'],
    ];

    private const ALLOWED = [
        'update' => [ServiceRequestStatus::Draft],
        'delete' => [ServiceRequestStatus::Draft],
        'submit' => [ServiceRequestStatus::Draft],
        'cancel' => [ServiceRequestStatus::Draft, ServiceRequestStatus::WaitingSuperior, ServiceRequestStatus::WaitingExecutor],
        'change_superior' => [ServiceRequestStatus::WaitingSuperior],
        'approve' => [ServiceRequestStatus::WaitingSuperior, ServiceRequestStatus::WaitingExecutor],
        'reject' => [ServiceRequestStatus::WaitingSuperior, ServiceRequestStatus::WaitingExecutor],
        'request_revision' => [ServiceRequestStatus::WaitingSuperior, ServiceRequestStatus::WaitingExecutor],
        'complete' => [ServiceRequestStatus::InProgress],
        'convert' => [ServiceRequestStatus::WaitingExecutor],
        'upload' => [ServiceRequestStatus::Draft, ServiceRequestStatus::WaitingSuperior, ServiceRequestStatus::WaitingExecutor, ServiceRequestStatus::InProgress],
    ];

    public function __construct(
        private ApprovalEngine $engine,
        private ExecutorDirectory $directory,
        private NumberSequenceService $numbers,
        private StatusLogger $logger,
        private SignatureService $signatures,
        private ServiceRequestNotifier $notifier,
    ) {
    }

    public static function statusAllows(ServiceRequest $request, string $action): bool
    {
        return in_array($request->status, self::ALLOWED[$action] ?? [], true);
    }

    public function createDraft(User $requester, array $data, array $extra = []): ServiceRequest
    {
        return DB::transaction(function () use ($requester, $data, $extra) {
            $request = new ServiceRequest();
            $request->fill($this->documentFields($data) + $extra);
            $request->fill([
                'requester_id' => $requester->id,
                'requester_org_unit_id' => $requester->org_unit_id,
                'status' => ServiceRequestStatus::Draft,
                'superior_id' => $data['superior_id'] ?? $this->defaultSuperior($requester)?->id,
            ]);
            $request->save();
            $this->logger->log($request, 'create', null, $request->status, $requester);

            return $request;
        });
    }

    public function updateDraft(ServiceRequest $request, User $user, array $data): ServiceRequest
    {
        return DB::transaction(function () use ($request, $user, $data) {
            $request = $this->lock($request, 'update');
            $request->fill($this->documentFields($data));
            if (array_key_exists('superior_id', $data)) {
                $request->superior_id = $data['superior_id'];
            }
            $request->save();
            $this->logger->log($request, 'update', $request->status, $request->status, $user);

            return $request;
        });
    }

    public function deleteDraft(ServiceRequest $request): void
    {
        DB::transaction(function () use ($request) {
            $request = $this->lock($request, 'delete');
            if ($request->request_number) {
                throw new InvalidTransitionException('Request yang sudah pernah diajukan tidak dapat dihapus; gunakan Batalkan.');
            }
            $request->delete();
        });
    }

    /** Draft → approval chain. Takes the identity snapshot and issues the number on the first submit. */
    public function submit(ServiceRequest $request, User $requester, ?int $superiorId = null): ServiceRequest
    {
        $request = DB::transaction(function () use ($request, $requester, $superiorId) {
            $request = $this->lock($request, 'submit');
            $this->assertComplete($request);

            $superior = $this->resolveSuperior($requester, $superiorId ?? $request->superior_id);
            $executor = ExecutorUnit::withTrashed()->findOrFail($request->executor_unit_id);
            $from = $request->status;

            $request->fill($this->identitySnapshot($requester) + [
                'superior_id' => $superior?->id,
                'superior_name' => $superior?->name,
                'rules_snapshot' => $executor->request_rules,
                'contact_footer_snapshot' => $executor->contact_footer,
                'submitted_at' => now(),
                'assigned_executor_id' => null,
                'executor_notes' => null,
            ]);
            $request->request_number ??= $this->nextNumber($executor);
            $request->status = $superior ? ServiceRequestStatus::WaitingSuperior : ServiceRequestStatus::WaitingExecutor;
            $request->save();

            if ($superior) {
                $requester->forceFill(['preferred_superior_id' => $superior->id])->save();
            }

            $this->engine->start($request, $request->revision_no, $this->stepDefinitions($request, $superior), $requester);
            $this->logger->log($request, 'submit', $from, $request->status, $requester, null, [
                'round' => $request->revision_no,
                'superior_id' => $superior?->id,
            ]);
            $this->sign($request, self::STEP_SUBMISSION, $requester);

            return $request;
        });

        $this->notifier->stepPending($request, $this->engine->current($request), 'service_request.submitted');

        return $request;
    }

    /** Substitute for delegation (Q-17): the requester picks another superior while waiting for one. */
    public function changeSuperior(ServiceRequest $request, User $requester, int $superiorId, ?string $reason = null): ServiceRequest
    {
        $step = null;
        $request = DB::transaction(function () use ($request, $requester, $superiorId, $reason, &$step) {
            $request = $this->lock($request, 'change_superior');
            $superior = $this->resolveSuperior($requester, $superiorId);
            $step = $this->pendingStep($request);
            $previous = $request->superior_name;

            $this->engine->assignUser($step, $superior);
            $request->fill(['superior_id' => $superior->id, 'superior_name' => $superior->name])->save();
            $requester->forceFill(['preferred_superior_id' => $superior->id])->save();
            $this->logger->log($request, 'change_superior', $request->status, $request->status, $requester, $reason, [
                'from' => $previous, 'to' => $superior->name,
            ]);

            return $request;
        });

        $this->notifier->stepPending($request, $step->fresh(), 'service_request.submitted');

        return $request;
    }

    public function approve(ServiceRequest $request, User $approver, ?string $notes = null, ?int $assignedExecutorId = null): ServiceRequest
    {
        $next = null;
        $request = DB::transaction(function () use ($request, $approver, $notes, $assignedExecutorId, &$next) {
            $request = $this->lock($request, 'approve');
            $step = $this->pendingStep($request);
            $from = $request->status;

            $assignee = null;
            if ($assignedExecutorId !== null) {
                if ($step->step_key !== self::STEP_EXECUTOR_LEAD) {
                    throw ValidationException::withMessages(['assigned_executor_id' => ['Pelaksana hanya dapat ditunjuk oleh pimpinan unit pelaksana.']]);
                }
                $assignee = $this->directory->staffQuery(ExecutorUnit::withTrashed()->findOrFail($request->executor_unit_id))
                    ->whereKey($assignedExecutorId)->first();
                if (! $assignee || (int) $assignee->id === (int) $request->requester_id) {
                    throw ValidationException::withMessages(['assigned_executor_id' => ['Pelaksana harus anggota unit pelaksana dan bukan pemohon.']]);
                }
                if (! $this->directory->canDelegateTo($approver, $assignee)) {
                    throw ValidationException::withMessages(['assigned_executor_id' => ['Pelaksana hanya boleh grade di bawah Anda.']]);
                }
            }

            $next = $this->engine->decide($step, $approver, ApprovalStepStatus::Approved, $notes);
            if ($next && $assignee) {
                $this->engine->assignUser($next, $assignee);
                $request->assigned_executor_id = $assignee->id;
            }

            $request->status = $step->step_key === self::STEP_SUPERIOR
                ? ServiceRequestStatus::WaitingExecutor
                : ServiceRequestStatus::InProgress;
            $request->save();

            $this->logger->log($request, 'approve', $from, $request->status, $approver, $notes, ['step' => $step->step_key]);
            $this->sign($request, $step->step_key, $approver);

            return $request;
        });

        $request->status === ServiceRequestStatus::InProgress
            ? $this->notifier->approved($request, $approver, $next?->fresh())
            : $this->notifier->stepPending($request, $next?->fresh(), 'service_request.step_pending');

        return $request;
    }

    public function reject(ServiceRequest $request, User $approver, string $notes): ServiceRequest
    {
        $request = DB::transaction(function () use ($request, $approver, $notes) {
            $request = $this->lock($request, 'reject');
            $step = $this->pendingStep($request);
            $from = $request->status;

            $this->engine->decide($step, $approver, ApprovalStepStatus::Rejected, $notes);
            $request->fill(['status' => ServiceRequestStatus::Rejected, 'rejected_at' => now()])->save();
            $this->logger->log($request, 'reject', $from, $request->status, $approver, $notes, ['step' => $step->step_key]);

            return $request;
        });

        $this->notifier->rejected($request, $approver, $notes);

        return $request;
    }

    /** Back to the requester; the next submit starts a new approval round and new signatures. */
    public function requestRevision(ServiceRequest $request, User $approver, string $notes): ServiceRequest
    {
        $request = DB::transaction(function () use ($request, $approver, $notes) {
            $request = $this->lock($request, 'request_revision');
            $step = $this->pendingStep($request);
            $from = $request->status;

            $this->engine->decide($step, $approver, ApprovalStepStatus::RevisionRequested, $notes);
            foreach (array_keys(self::STEPS) as $roleKey) {
                $this->signatures->revoke($request, $roleKey);
            }
            $request->status = ServiceRequestStatus::Draft;
            $request->revision_no++;
            $request->save();
            $this->logger->log($request, 'request_revision', $from, $request->status, $approver, $notes, ['step' => $step->step_key]);

            return $request;
        });

        $this->notifier->revisionRequested($request, $approver, $notes);

        return $request;
    }

    public function complete(ServiceRequest $request, User $executor, string $executorNotes): ServiceRequest
    {
        $request = DB::transaction(function () use ($request, $executor, $executorNotes) {
            $request = $this->lock($request, 'complete');
            $step = $this->pendingStep($request);
            $from = $request->status;

            $this->engine->decide($step, $executor, ApprovalStepStatus::Completed, $executorNotes);
            $request->fill([
                'status' => ServiceRequestStatus::Completed,
                'executor_notes' => $executorNotes,
                'completed_at' => now(),
            ])->save();
            $this->logger->log($request, 'complete', $from, $request->status, $executor, $executorNotes);
            $this->sign($request, self::STEP_EXECUTOR, $executor);

            return $request;
        });

        $this->notifier->completed($request, $executor);

        return $request;
    }

    public function cancel(ServiceRequest $request, User $requester, string $reason): ServiceRequest
    {
        return DB::transaction(function () use ($request, $requester, $reason) {
            $request = $this->lock($request, 'cancel');
            $from = $request->status;

            $this->engine->cancelOpen($request);
            $request->fill([
                'status' => ServiceRequestStatus::Cancelled,
                'cancel_reason' => $reason,
                'cancelled_at' => now(),
            ])->save();
            $this->logger->log($request, 'cancel', $from, $request->status, $requester, $reason);

            return $request;
        });
    }

    /** Default "Atasan YBS": the requester's own last choice, otherwise Portal's atasan_id. */
    public function defaultSuperior(User $requester): ?User
    {
        foreach ([$requester->preferred_superior_id, $requester->superior_id] as $candidateId) {
            $candidate = $candidateId ? User::query()->find($candidateId) : null;
            if ($candidate && $this->isEligibleSuperior($requester, $candidate)) {
                return $candidate;
            }
        }

        return null;
    }

    /** Active users with a higher Portal grade than the requester (dropdown "Atasan YBS"). */
    public function superiorCandidates(User $requester, ?string $term = null): Builder
    {
        $like = '%'.mb_strtolower(trim((string) $term)).'%';

        return User::query()
            ->where('is_active', true)
            ->where('id', '!=', $requester->id)
            ->where('grade_level', '>', (int) ($requester->grade_level ?? 0))
            ->when(filled($term), fn (Builder $q) => $q->where(fn (Builder $w) => $w
                ->whereRaw('LOWER(name) LIKE ?', [$like])->orWhereRaw('LOWER(nrk) LIKE ?', [$like])))
            ->orderBy('grade_level')->orderBy('name');
    }

    /** Portal atasan is always accepted; any other pick needs a higher grade. */
    public function isEligibleSuperior(User $requester, User $candidate): bool
    {
        if (! $candidate->is_active || (int) $candidate->id === (int) $requester->id) {
            return false;
        }
        if ((int) $requester->superior_id === (int) $candidate->id) {
            return true;
        }

        return (int) $candidate->grade_level > (int) ($requester->grade_level ?? 0);
    }

    /** @return StepDefinition[] */
    private function stepDefinitions(ServiceRequest $request, ?User $superior): array
    {
        $unitId = (int) $request->executor_unit_id;

        return [
            new StepDefinition(self::STEP_SUBMISSION, self::STEPS[self::STEP_SUBMISSION]['label'], ApprovalStep::KIND_SUBMISSION,
                ApprovalStep::ASSIGNEE_USER, (int) $request->requester_id),
            new StepDefinition(self::STEP_SUPERIOR, self::STEPS[self::STEP_SUPERIOR]['label'], ApprovalStep::KIND_APPROVAL,
                ApprovalStep::ASSIGNEE_USER, $superior?->id, null,
                skip: $superior === null, skipNote: 'Pemohon tidak memiliki atasan dengan grade lebih tinggi.'),
            new StepDefinition(self::STEP_EXECUTOR_LEAD, self::STEPS[self::STEP_EXECUTOR_LEAD]['label'], ApprovalStep::KIND_APPROVAL,
                ApprovalStep::ASSIGNEE_EXECUTOR_LEAD, null, $unitId),
            new StepDefinition(self::STEP_EXECUTOR, self::STEPS[self::STEP_EXECUTOR]['label'], ApprovalStep::KIND_COMPLETION,
                ApprovalStep::ASSIGNEE_EXECUTOR_STAFF, null, $unitId),
        ];
    }

    private function resolveSuperior(User $requester, ?int $superiorId): ?User
    {
        if ($superiorId) {
            $superior = User::query()->find($superiorId);
            if (! $superior || ! $this->isEligibleSuperior($requester, $superior)) {
                throw ValidationException::withMessages([
                    'superior_id' => ['Atasan harus karyawan aktif dengan grade lebih tinggi dari pemohon.'],
                ]);
            }

            return $superior;
        }

        if ($default = $this->defaultSuperior($requester)) {
            return $default;
        }
        if ($this->superiorCandidates($requester)->exists()) {
            throw ValidationException::withMessages(['superior_id' => ['Pilih atasan yang akan menyetujui request ini.']]);
        }

        return null; // top of the hierarchy: the superior step is skipped
    }

    private function pendingStep(ServiceRequest $request): ApprovalStep
    {
        $step = $this->engine->current($request);
        if (! $step) {
            throw new InvalidTransitionException('Tidak ada langkah persetujuan yang sedang berjalan.');
        }

        return $step;
    }

    private function assertComplete(ServiceRequest $request): void
    {
        $missing = [];
        foreach (['office_id' => 'Office', 'service_category_id' => 'Jenis permintaan', 'purpose' => 'Keperluan'] as $field => $label) {
            if (blank($request->{$field})) {
                $missing[$field] = ["{$label} wajib diisi sebelum diajukan."];
            }
        }
        if ($missing) {
            throw ValidationException::withMessages($missing);
        }
    }

    private function lock(ServiceRequest $request, string $action): ServiceRequest
    {
        $locked = ServiceRequest::query()->lockForUpdate()->findOrFail($request->id);
        if (! self::statusAllows($locked, $action)) {
            throw new InvalidTransitionException(
                "Request {$locked->displayNumber()} berstatus {$locked->status->label()}; aksi ini tidak dapat dilakukan."
            );
        }

        return $locked;
    }

    private function nextNumber(ExecutorUnit $executor): string
    {
        $now = now();
        $sequence = $this->numbers->next('service_request', $executor->code, $now->year);

        return sprintf('REQ%04d/%s/%s/%d', $sequence, $executor->code, NumberSequenceService::romanMonth($now->month), $now->year);
    }

    private function documentFields(array $data): array
    {
        return array_intersect_key($data, array_flip([
            'executor_unit_id', 'service_category_id', 'office_id', 'purpose', 'priority', 'estimated_cost',
        ]));
    }

    private function identitySnapshot(User $requester): array
    {
        /** @var OrgUnit|null $unit */
        $unit = $requester->orgUnit;

        return [
            'requester_org_unit_id' => $unit?->id,
            'requester_name' => $requester->name,
            'requester_nrk' => $requester->nrk,
            'requester_position' => $requester->position,
            'requester_employment_status' => $requester->employment_status,
            'requester_bagian_name' => $unit?->ancestorOfType(OrgUnit::TYPE_BAGIAN)?->name,
            'requester_sub_bagian_name' => $unit?->ancestorOfType(OrgUnit::TYPE_SUB_BAGIAN)?->name,
            'requester_email' => $requester->email,
            'requester_phone' => $requester->phone,
        ];
    }

    private function sign(ServiceRequest $request, string $stepKey, User $signer): void
    {
        $step = self::STEPS[$stepKey];
        $this->signatures->sign($request, $request->request_number, $stepKey, "{$step['verb']} ({$step['label']})", $signer);
    }
}
