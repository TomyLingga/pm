<?php

namespace App\Policies;

use App\Models\Attachment;
use App\Models\User;
use App\Models\WorkOrder;
use App\Services\Org\ExecutorDirectory;

/**
 * Who may do what on a Work Order. Status rules (when) live in WorkOrderService and return 409.
 */
class WorkOrderPolicy
{
    public function __construct(private ExecutorDirectory $directory)
    {
    }

    public function view(User $user, WorkOrder $workOrder): bool
    {
        return $user->canSeeEverything()
            || $this->isRequester($user, $workOrder)
            || $this->sameUnitAsRequester($user, $workOrder)
            || $this->isRequesterSuperior($user, $workOrder)
            || $this->directory->isStaff($user, (int) $workOrder->executor_unit_id);
    }

    public function update(User $user, WorkOrder $workOrder): bool
    {
        return $this->isRequester($user, $workOrder);
    }

    public function cancel(User $user, WorkOrder $workOrder): bool
    {
        return $this->isRequester($user, $workOrder);
    }

    public function pick(User $user, WorkOrder $workOrder): bool
    {
        return $this->directory->isStaff($user, (int) $workOrder->executor_unit_id);
    }

    public function receive(User $user, WorkOrder $workOrder): bool
    {
        return $this->directory->isLead($user, (int) $workOrder->executor_unit_id);
    }

    public function reassign(User $user, WorkOrder $workOrder): bool
    {
        return $this->directory->isLead($user, (int) $workOrder->executor_unit_id);
    }

    /** Executor lead redirects a (costly) job to the Form Request flow (Q-9). */
    public function convert(User $user, WorkOrder $workOrder): bool
    {
        return ! $this->isRequester($user, $workOrder)
            && $this->directory->isLead($user, (int) $workOrder->executor_unit_id);
    }

    public function start(User $user, WorkOrder $workOrder): bool
    {
        return $workOrder->isAssignee($user);
    }

    /** Edit materials / labours while working. */
    public function work(User $user, WorkOrder $workOrder): bool
    {
        return $workOrder->isAssignee($user);
    }

    public function complete(User $user, WorkOrder $workOrder): bool
    {
        return $workOrder->isAssignee($user);
    }

    /** User In Charge: requester, a colleague of the same unit, or the requester's chosen superior. */
    public function accept(User $user, WorkOrder $workOrder): bool
    {
        if ($workOrder->isAssignee($user)) {
            return false;
        }

        return $this->isRequester($user, $workOrder)
            || $this->sameUnitAsRequester($user, $workOrder)
            || $this->isRequesterSuperior($user, $workOrder);
    }

    public function upload(User $user, WorkOrder $workOrder): bool
    {
        return $this->isRequester($user, $workOrder)
            || $this->directory->isStaff($user, (int) $workOrder->executor_unit_id);
    }

    public function deleteAttachment(User $user, WorkOrder $workOrder, Attachment $attachment): bool
    {
        return (int) $attachment->uploaded_by_id === (int) $user->id;
    }

    private function isRequester(User $user, WorkOrder $workOrder): bool
    {
        return (int) $workOrder->requester_id === (int) $user->id;
    }

    private function sameUnitAsRequester(User $user, WorkOrder $workOrder): bool
    {
        return $user->org_unit_id !== null && (int) $workOrder->requester_org_unit_id === (int) $user->org_unit_id;
    }

    /** Requester's superior: Portal atasan or the superior the requester picked. */
    private function isRequesterSuperior(User $user, WorkOrder $workOrder): bool
    {
        $requester = $workOrder->requester;

        return $requester !== null
            && in_array((int) $user->id, array_map('intval', array_filter([$requester->superior_id, $requester->preferred_superior_id])), true);
    }
}
