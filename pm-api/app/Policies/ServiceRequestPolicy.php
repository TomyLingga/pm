<?php

namespace App\Policies;

use App\Models\ApprovalStep;
use App\Models\Attachment;
use App\Models\ServiceRequest;
use App\Models\User;
use App\Services\Approvals\ApprovalEngine;
use App\Services\Org\ExecutorDirectory;

/**
 * Who may do what on a Form Request. Approval rights come from the generic ApprovalEngine;
 * status rules (when) live in ServiceRequestService and return 409.
 */
class ServiceRequestPolicy
{
    public function __construct(
        private ExecutorDirectory $directory,
        private ApprovalEngine $engine,
    ) {
    }

    public function view(User $user, ServiceRequest $request): bool
    {
        if ($user->canSeeEverything() || $this->isRequester($user, $request)) {
            return true;
        }
        if ($user->org_unit_id !== null && (int) $request->requester_org_unit_id === (int) $user->org_unit_id) {
            return true;
        }
        if ($request->submitted_at === null) {
            return false; // other people only see a request once it was submitted
        }

        return (int) $request->superior_id === (int) $user->id
            || $this->directory->isStaff($user, (int) $request->executor_unit_id)
            || ApprovalStep::query()
                ->where('approvable_type', $request->getMorphClass())->where('approvable_id', $request->id)
                ->where(fn ($q) => $q->where('assignee_user_id', $user->id)->orWhere('acted_by_id', $user->id))
                ->exists();
    }

    public function update(User $user, ServiceRequest $request): bool
    {
        return $this->isRequester($user, $request);
    }

    public function delete(User $user, ServiceRequest $request): bool
    {
        return $this->isRequester($user, $request);
    }

    public function submit(User $user, ServiceRequest $request): bool
    {
        return $this->isRequester($user, $request);
    }

    public function cancel(User $user, ServiceRequest $request): bool
    {
        return $this->isRequester($user, $request);
    }

    public function changeSuperior(User $user, ServiceRequest $request): bool
    {
        return $this->isRequester($user, $request);
    }

    /** Approve, reject and request revision on the active approval step. */
    public function decide(User $user, ServiceRequest $request): bool
    {
        $step = $this->engine->current($request);

        return $step?->kind === ApprovalStep::KIND_APPROVAL && $this->engine->canAct($user, $step);
    }

    public function complete(User $user, ServiceRequest $request): bool
    {
        $step = $this->engine->current($request);

        return $step?->kind === ApprovalStep::KIND_COMPLETION && $this->engine->canAct($user, $step);
    }

    /** Executor lead redirects the request to a Work Order (Q-9). */
    public function convert(User $user, ServiceRequest $request): bool
    {
        return ! $this->isRequester($user, $request)
            && $this->directory->isStaff($user, (int) $request->executor_unit_id)
            && $this->directory->hasLeadGrade($user);
    }

    public function upload(User $user, ServiceRequest $request): bool
    {
        return $this->isRequester($user, $request)
            || $this->directory->isStaff($user, (int) $request->executor_unit_id)
            || $this->engine->canAct($user, $this->engine->current($request));
    }

    public function deleteAttachment(User $user, ServiceRequest $request, Attachment $attachment): bool
    {
        return (int) $attachment->uploaded_by_id === (int) $user->id;
    }

    private function isRequester(User $user, ServiceRequest $request): bool
    {
        return (int) $request->requester_id === (int) $user->id;
    }
}
