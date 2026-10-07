<?php

namespace App\Services\WorkOrders;

use App\Enums\Priority;
use App\Enums\WorkOrderStatus;
use App\Exceptions\InvalidTransitionException;
use App\Models\Equipment;
use App\Models\ExecutorUnit;
use App\Models\Material;
use App\Models\OrgUnit;
use App\Models\User;
use App\Models\WorkOrder;
use App\Services\Activities\DailyActivityService;
use App\Services\Audit\StatusLogger;
use App\Services\Documents\SignatureService;
use App\Services\Org\ExecutorDirectory;
use App\Services\Support\NumberSequenceService;
use App\Services\Support\WorkingDayCalculator;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * All Work Order business rules and status transitions (docs/STATE_MACHINES.md §1).
 * Authorization (who) is checked by WorkOrderPolicy; this class checks state (when) → 409.
 */
class WorkOrderService
{
    public const SIGN_REQUESTED = 'requested';
    public const SIGN_RECEIVED = 'received';
    public const SIGN_COMPLETED = 'completed';
    public const SIGN_ACCEPTED = 'accepted';

    public const SIGNATURE_LABELS = [
        self::SIGN_REQUESTED => 'Diminta Oleh',
        self::SIGN_RECEIVED => 'Diterima Oleh',
        self::SIGN_COMPLETED => 'Pekerjaan Diselesaikan Oleh',
        self::SIGN_ACCEPTED => 'Pekerjaan Diterima Oleh',
    ];

    /** Statuses from which each action may run. */
    private const ALLOWED = [
        'update' => [WorkOrderStatus::Submitted],
        'cancel' => [WorkOrderStatus::Submitted],
        'pick' => [WorkOrderStatus::Submitted],
        'receive' => [WorkOrderStatus::Submitted],
        'reassign' => [WorkOrderStatus::Received, WorkOrderStatus::InProgress],
        'start' => [WorkOrderStatus::Received],
        'work' => [WorkOrderStatus::InProgress],
        'complete' => [WorkOrderStatus::InProgress],
        'accept' => [WorkOrderStatus::Completed],
        'upload' => [WorkOrderStatus::Submitted, WorkOrderStatus::Received, WorkOrderStatus::InProgress, WorkOrderStatus::Completed],
        'convert' => [WorkOrderStatus::Submitted, WorkOrderStatus::Received],
    ];

    public function __construct(
        private ExecutorDirectory $directory,
        private NumberSequenceService $numbers,
        private StatusLogger $logger,
        private SignatureService $signatures,
        private WorkingDayCalculator $calendar,
        private WorkOrderNotifier $notifier,
        private DailyActivityService $activities,
    ) {
    }

    public static function statusAllows(WorkOrder $workOrder, string $action): bool
    {
        return in_array($workOrder->status, self::ALLOWED[$action] ?? [], true);
    }

    /**
     * @param  array  $extra  additional columns, e.g. `source_service_request_id` for a converted request
     * @param  bool  $notify  false when the caller is still inside its own transaction (call notifyCreated() after commit)
     */
    public function create(User $requester, array $data, array $extra = [], bool $notify = true): WorkOrder
    {
        $workOrder = DB::transaction(function () use ($requester, $data, $extra) {
            $executor = ExecutorUnit::query()->findOrFail($data['executor_unit_id']);
            $issuedAt = now();

            $workOrder = new WorkOrder();
            $workOrder->fill($this->documentFields($data) + $extra);
            $workOrder->fill($this->requesterSnapshot($requester));
            $workOrder->fill([
                'wo_number' => $this->nextNumber($executor, $issuedAt),
                'issued_at' => $issuedAt,
                'requester_id' => $requester->id,
                'status' => WorkOrderStatus::Submitted,
            ]);
            $workOrder->save();

            foreach (config('pm.work_order.clearance_items') as $no => $label) {
                $workOrder->clearances()->create(['item_no' => $no, 'item_label' => $label]);
            }

            $this->logger->log($workOrder, 'create', null, WorkOrderStatus::Submitted, $requester, null,
                array_filter(['source_service_request_id' => $extra['source_service_request_id'] ?? null]));
            $this->sign($workOrder, self::SIGN_REQUESTED, $requester);

            return $workOrder;
        });

        if ($notify) {
            $this->notifyCreated($workOrder);
        }

        return $workOrder;
    }

    public function notifyCreated(WorkOrder $workOrder): void
    {
        $this->notifier->created($workOrder);
    }

    public function update(WorkOrder $workOrder, User $user, array $data): WorkOrder
    {
        return DB::transaction(function () use ($workOrder, $user, $data) {
            $workOrder = $this->lock($workOrder, 'update');
            if ((int) $data['executor_unit_id'] !== (int) $workOrder->executor_unit_id) {
                throw ValidationException::withMessages([
                    'executor_unit_id' => ['Unit pelaksana tidak dapat diubah karena menentukan nomor WO. Batalkan dan buat WO baru.'],
                ]);
            }

            $workOrder->fill($this->documentFields($data))->save();
            $this->logger->log($workOrder, 'update', $workOrder->status, $workOrder->status, $user);

            return $workOrder;
        });
    }

    public function cancel(WorkOrder $workOrder, User $user, string $reason): WorkOrder
    {
        return DB::transaction(function () use ($workOrder, $user, $reason) {
            $workOrder = $this->lock($workOrder, 'cancel');
            $from = $workOrder->status;
            $workOrder->fill([
                'status' => WorkOrderStatus::Cancelled,
                'cancel_reason' => $reason,
                'cancelled_at' => now(),
            ])->save();
            $this->logger->log($workOrder, 'cancel', $from, $workOrder->status, $user, $reason);

            return $workOrder;
        });
    }

    /** A technician takes an unassigned WO from the pool and starts working right away. */
    public function pick(WorkOrder $workOrder, User $technician): WorkOrder
    {
        $workOrder = DB::transaction(function () use ($workOrder, $technician) {
            $workOrder = $this->lock($workOrder, 'pick');
            $from = $workOrder->status;
            $now = now();

            $this->syncAssignees($workOrder, [$technician->id], $technician->id, $technician);
            $workOrder->fill([
                'status' => WorkOrderStatus::InProgress,
                'received_by_id' => $technician->id,
                'received_at' => $now,
                'picked_by_id' => $technician->id,
                'picked_at' => $now,
            ])->save();

            $this->logger->log($workOrder, 'pick', $from, $workOrder->status, $technician);
            $this->sign($workOrder, self::SIGN_RECEIVED, $technician);

            return $workOrder;
        });

        $this->notifier->picked($workOrder, $technician);

        return $workOrder;
    }

    /** An executor lead receives the WO and assigns technicians. */
    public function receive(WorkOrder $workOrder, User $lead, array $assigneeIds, int $leadId, ?string $priority = null): WorkOrder
    {
        $added = [];
        $workOrder = DB::transaction(function () use ($workOrder, $lead, $assigneeIds, $leadId, $priority, &$added) {
            $workOrder = $this->lock($workOrder, 'receive');
            $from = $workOrder->status;
            $meta = [];

            if ($priority && $priority !== $workOrder->priority->value) {
                $meta['priority'] = ['from' => $workOrder->priority->value, 'to' => $priority];
                $workOrder->priority = Priority::from($priority);
            }

            $added = $this->syncAssignees($workOrder, $assigneeIds, $leadId, $lead);
            $workOrder->fill([
                'status' => WorkOrderStatus::Received,
                'received_by_id' => $lead->id,
                'received_at' => now(),
            ])->save();

            $this->logger->log($workOrder, 'receive', $from, $workOrder->status, $lead, null, $meta + ['assignee_ids' => array_values($assigneeIds)]);
            $this->sign($workOrder, self::SIGN_RECEIVED, $lead);

            return $workOrder;
        });

        $this->notifier->assigned($workOrder, $added, $lead);
        $this->notifier->received($workOrder, $lead);

        return $workOrder;
    }

    public function reassign(WorkOrder $workOrder, User $lead, array $assigneeIds, int $leadId): WorkOrder
    {
        $added = [];
        $workOrder = DB::transaction(function () use ($workOrder, $lead, $assigneeIds, $leadId, &$added) {
            $workOrder = $this->lock($workOrder, 'reassign');
            $added = $this->syncAssignees($workOrder, $assigneeIds, $leadId, $lead);
            $this->logger->log($workOrder, 'reassign', $workOrder->status, $workOrder->status, $lead, null, [
                'assignee_ids' => array_values($assigneeIds),
                'lead_id' => $leadId,
            ]);

            return $workOrder;
        });

        $this->notifier->assigned($workOrder, $added, $lead);

        return $workOrder;
    }

    public function start(WorkOrder $workOrder, User $technician): WorkOrder
    {
        return DB::transaction(function () use ($workOrder, $technician) {
            $workOrder = $this->lock($workOrder, 'start');
            $from = $workOrder->status;
            $workOrder->status = WorkOrderStatus::InProgress;
            $workOrder->picked_at ??= now();
            $workOrder->picked_by_id ??= $technician->id;
            $workOrder->save();
            $this->logger->log($workOrder, 'start', $from, $workOrder->status, $technician);

            return $workOrder;
        });
    }

    public function saveMaterials(WorkOrder $workOrder, User $technician, array $materials): WorkOrder
    {
        return DB::transaction(function () use ($workOrder, $technician, $materials) {
            $workOrder = $this->lock($workOrder, 'work');
            $this->replaceMaterials($workOrder, $materials);
            $this->logger->log($workOrder, 'update_materials', $workOrder->status, $workOrder->status, $technician);

            return $workOrder;
        });
    }

    public function saveLabours(WorkOrder $workOrder, User $technician, array $labours): WorkOrder
    {
        return DB::transaction(function () use ($workOrder, $technician, $labours) {
            $workOrder = $this->lock($workOrder, 'work');
            $this->replaceLabours($workOrder, $labours);
            $this->logger->log($workOrder, 'update_labours', $workOrder->status, $workOrder->status, $technician);

            return $workOrder;
        });
    }

    /** MTC In Charge finishes the job and confirms the clearance checklist. */
    public function complete(WorkOrder $workOrder, User $technician, array $data): WorkOrder
    {
        $workOrder = DB::transaction(function () use ($workOrder, $technician, $data) {
            $workOrder = $this->lock($workOrder, 'complete');
            $from = $workOrder->status;

            if (array_key_exists('materials', $data)) {
                $this->replaceMaterials($workOrder, $data['materials'] ?? []);
            }
            if (array_key_exists('labours', $data)) {
                $this->replaceLabours($workOrder, $data['labours'] ?? []);
            }
            if (! $workOrder->labours()->exists()) {
                throw ValidationException::withMessages(['labours' => ['Isi minimal satu pekerja beserta jam mulai dan selesai.']]);
            }

            $now = now();
            foreach ($data['clearance'] as $item) {
                $workOrder->clearances()->where('item_no', $item['item_no'])->update([
                    'mtc_result' => $item['result'],
                    'mtc_confirmed_by_id' => $technician->id,
                    'mtc_confirmed_at' => $now,
                ]);
            }

            $workOrder->fill([
                'status' => WorkOrderStatus::Completed,
                'work_done' => $data['work_done'],
                'completed_by_id' => $technician->id,
                'completed_at' => $now,
                'acceptance_due_at' => $this->calendar->addWorkingDays($now, config('pm.work_order.auto_accept_working_days')),
            ]);
            if (array_key_exists('remarks', $data)) {
                $workOrder->remarks = $data['remarks'];
            }
            $workOrder->save();

            $this->logger->log($workOrder, 'complete', $from, $workOrder->status, $technician);
            $this->sign($workOrder, self::SIGN_COMPLETED, $technician);
            // The finished job is also the technicians' daily report for that day.
            $this->activities->createFromWorkOrder($workOrder, $technician);

            return $workOrder;
        });

        $this->notifier->completed($workOrder, $technician);

        return $workOrder;
    }

    /** User In Charge accepts (→ closed) or rejects (→ back to in progress) the result. */
    public function accept(WorkOrder $workOrder, User $user, array $data): WorkOrder
    {
        $accepted = $data['acceptance'] === 'yes';

        $workOrder = DB::transaction(function () use ($workOrder, $user, $data, $accepted) {
            $workOrder = $this->lock($workOrder, 'accept');
            $from = $workOrder->status;
            $now = now();

            if ($accepted) {
                foreach ($data['clearance'] as $item) {
                    $workOrder->clearances()->where('item_no', $item['item_no'])->update([
                        'user_result' => $item['result'],
                        'user_confirmed_by_id' => $user->id,
                        'user_confirmed_at' => $now,
                    ]);
                }
                $workOrder->fill([
                    'status' => WorkOrderStatus::Closed,
                    'accepted_by_id' => $user->id,
                    'accepted_at' => $now,
                    'closed_at' => $now,
                    'acceptance_due_at' => null,
                    'total_breakdown_hours' => $data['total_breakdown_hours'] ?? null,
                ]);
                if (! empty($data['remarks'])) {
                    $workOrder->remarks = $data['remarks'];
                }
                $workOrder->save();

                $this->logger->log($workOrder, 'accept', $from, $workOrder->status, $user, $data['remarks'] ?? null);
                $this->sign($workOrder, self::SIGN_ACCEPTED, $user);

                return $workOrder;
            }

            // Rejected: the job goes back to the technicians and the checklist must be redone.
            $workOrder->clearances()->update([
                'mtc_result' => null, 'mtc_confirmed_by_id' => null, 'mtc_confirmed_at' => null,
                'user_result' => null, 'user_confirmed_by_id' => null, 'user_confirmed_at' => null,
            ]);
            $workOrder->fill([
                'status' => WorkOrderStatus::InProgress,
                'acceptance_due_at' => null,
                'rework_count' => $workOrder->rework_count + 1,
            ])->save();
            $this->signatures->revoke($workOrder, self::SIGN_COMPLETED);
            $this->logger->log($workOrder, 'reject', $from, $workOrder->status, $user, $data['reason']);

            return $workOrder;
        });

        $accepted
            ? $this->notifier->closed($workOrder)
            : $this->notifier->rejected($workOrder, $user, $data['reason']);

        return $workOrder;
    }

    /** Close a completed WO whose acceptance window (working days) has passed. */
    public function autoAccept(WorkOrder $workOrder): bool
    {
        $closed = DB::transaction(function () use ($workOrder) {
            $workOrder = WorkOrder::query()->lockForUpdate()->findOrFail($workOrder->id);
            if ($workOrder->status !== WorkOrderStatus::Completed || ! $workOrder->acceptance_due_at?->lte(now())) {
                return null;
            }

            $from = $workOrder->status;
            $now = now();
            $workOrder->fill([
                'status' => WorkOrderStatus::Closed,
                'auto_accepted' => true,
                'accepted_at' => $now,
                'closed_at' => $now,
                'acceptance_due_at' => null,
            ])->save();
            $days = config('pm.work_order.auto_accept_working_days');
            $this->logger->log($workOrder, 'auto_accept', $from, $workOrder->status, null,
                "Diterima otomatis oleh sistem setelah {$days} hari kerja tanpa konfirmasi user.");

            return $workOrder;
        });

        if ($closed) {
            $this->notifier->closed($closed);
        }

        return (bool) $closed;
    }

    /** Lock the row and check that the action is allowed from the current status. */
    private function lock(WorkOrder $workOrder, string $action): WorkOrder
    {
        $locked = WorkOrder::query()->lockForUpdate()->findOrFail($workOrder->id);
        if (! self::statusAllows($locked, $action)) {
            throw new InvalidTransitionException(
                "WO {$locked->wo_number} berstatus {$locked->status->label()}; aksi ini tidak dapat dilakukan."
            );
        }

        return $locked;
    }

    private function nextNumber(ExecutorUnit $executor, Carbon $issuedAt): string
    {
        $sequence = $this->numbers->next('work_order', $executor->code, $issuedAt->year);

        return sprintf('WO/%s/%s/%d/%04d', $executor->code, NumberSequenceService::romanMonth($issuedAt->month), $issuedAt->year, $sequence);
    }

    private function documentFields(array $data): array
    {
        $equipment = ! empty($data['equipment_id']) ? Equipment::query()->find($data['equipment_id']) : null;

        return [
            'executor_unit_id' => $data['executor_unit_id'],
            'service_category_id' => $data['service_category_id'],
            'category_note' => $data['category_note'] ?? null,
            'equipment_id' => $equipment?->id,
            'equipment_code' => $equipment?->code ?? ($data['equipment_code'] ?? null),
            'equipment_name' => $equipment?->name ?? ($data['equipment_name'] ?? null),
            'location_id' => $data['location_id'] ?? $equipment?->location_id,
            'location_note' => $data['location_note'] ?? null,
            'request_description' => $data['request_description'],
            'priority' => $data['priority'],
        ];
    }

    private function requesterSnapshot(User $requester): array
    {
        /** @var OrgUnit|null $unit */
        $unit = $requester->orgUnit;

        return [
            'requester_org_unit_id' => $unit?->id,
            'requester_org_unit_name' => $unit?->name,
            'requester_bagian_name' => $unit?->ancestorOfType(OrgUnit::TYPE_BAGIAN)?->name,
            'requester_sub_bagian_name' => $unit?->ancestorOfType(OrgUnit::TYPE_SUB_BAGIAN)?->name,
        ];
    }

    /**
     * Replace the active assignee set. Returns the user IDs that were newly added.
     *
     * @return int[]
     */
    private function syncAssignees(WorkOrder $workOrder, array $userIds, int $leadId, User $by): array
    {
        $userIds = array_values(array_unique(array_map('intval', $userIds)));
        if (! in_array($leadId, $userIds, true)) {
            throw ValidationException::withMessages(['lead_id' => ['Ketua tim harus salah satu teknisi yang ditugaskan.']]);
        }

        $executor = ExecutorUnit::query()->findOrFail($workOrder->executor_unit_id);
        $staff = $this->directory->staffQuery($executor)->whereIn('id', $userIds)->get()->keyBy('id');
        if (array_diff($userIds, $staff->keys()->map(fn ($id) => (int) $id)->all())) {
            throw ValidationException::withMessages(['assignee_ids' => ['Teknisi harus anggota unit pelaksana '.$executor->display_name.'.']]);
        }
        $above = $staff->reject(fn (User $u) => $this->directory->canDelegateTo($by, $u))->pluck('name');
        if ($above->isNotEmpty()) {
            throw ValidationException::withMessages(['assignee_ids' => ['Penugasan hanya ke grade di bawah Anda. Tidak dapat menugaskan: '.$above->implode(', ').'.']]);
        }

        $now = now();
        $current = $workOrder->assignments()->whereNull('unassigned_at')->get()->keyBy('user_id');

        foreach ($current as $userId => $assignment) {
            if (! in_array((int) $userId, $userIds, true)) {
                $assignment->update(['unassigned_at' => $now]);
            } elseif ($assignment->is_lead !== ((int) $userId === $leadId)) {
                $assignment->update(['is_lead' => (int) $userId === $leadId]);
            }
        }

        $added = [];
        foreach ($userIds as $userId) {
            if (! $current->has($userId)) {
                $workOrder->assignments()->create([
                    'user_id' => $userId,
                    'is_lead' => $userId === $leadId,
                    'assigned_by_id' => $by->id,
                    'assigned_at' => $now,
                ]);
                $added[] = $userId;
            }
        }

        $workOrder->unsetRelation('activeAssignments');

        return $added;
    }

    private function replaceMaterials(WorkOrder $workOrder, array $rows): void
    {
        $workOrder->materials()->delete();
        $masters = Material::query()->whereIn('id', array_filter(array_column($rows, 'material_id')))->get()->keyBy('id');

        foreach ($rows as $row) {
            $master = isset($row['material_id']) ? $masters->get($row['material_id']) : null;
            $workOrder->materials()->create([
                'material_id' => $master?->id,
                'material_name' => ($row['material_name'] ?? null) ?: $master?->name,
                'quantity' => $row['quantity'],
                'unit' => ($row['unit'] ?? null) ?: $master?->unit,
            ]);
        }
    }

    private function replaceLabours(WorkOrder $workOrder, array $rows): void
    {
        $workOrder->labours()->delete();
        $users = User::query()->whereIn('id', array_filter(array_column($rows, 'user_id')))->get()->keyBy('id');

        foreach (array_values($rows) as $i => $row) {
            $start = Carbon::parse($row['started_at'])->timezone(config('app.timezone'));
            $finish = Carbon::parse($row['finished_at'])->timezone(config('app.timezone'));
            if ($finish->lte($start)) {
                throw ValidationException::withMessages(["labours.{$i}.finished_at" => ['Jam selesai harus setelah jam mulai.']]);
            }

            $user = isset($row['user_id']) ? $users->get($row['user_id']) : null;
            $workOrder->labours()->create([
                'user_id' => $user?->id,
                'worker_name' => ($row['worker_name'] ?? null) ?: $user?->name,
                'started_at' => $start,
                'finished_at' => $finish,
                'duration_minutes' => $start->diffInMinutes($finish),
            ]);
        }
    }

    private function sign(WorkOrder $workOrder, string $roleKey, User $signer): void
    {
        $this->signatures->sign($workOrder, $workOrder->wo_number, $roleKey, self::SIGNATURE_LABELS[$roleKey], $signer);
    }
}
