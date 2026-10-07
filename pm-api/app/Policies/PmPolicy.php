<?php

namespace App\Policies;

use App\Models\Attachment;
use App\Models\ChecklistTemplate;
use App\Models\Equipment;
use App\Models\PmSchedule;
use App\Models\PmTask;
use App\Models\User;
use App\Services\Org\ExecutorDirectory;
use Illuminate\Database\Eloquent\Model;

/**
 * Preventive Maintenance permissions, shared by templates, schedules, tasks and equipment:
 * read = staff of the executor unit (plus admin/management), write = its leads,
 * working on a task = its staff. Status rules (when) live in the services and return 409.
 */
class PmPolicy
{
    public function __construct(private ExecutorDirectory $directory)
    {
    }

    /** Templates, schedules and tasks. */
    public function view(User $user, Model $model): bool
    {
        if ($model instanceof Equipment) {
            return true;
        }

        return $user->canSeeEverything() || $this->directory->isStaff($user, (int) $model->executor_unit_id);
    }

    /** Create/update/delete templates and schedules. */
    public function manage(User $user, ChecklistTemplate|PmSchedule $model): bool
    {
        return $this->directory->isLead($user, (int) $model->executor_unit_id);
    }

    // ── Tasks ────────────────────────────────────────────────────────────────

    /** Start, fill in the checklist, add photos/materials, complete, raise a WO from a finding. */
    public function work(User $user, PmTask $task): bool
    {
        return $this->directory->isStaff($user, (int) $task->executor_unit_id);
    }

    public function proposeSkip(User $user, PmTask $task): bool
    {
        return $this->directory->isStaff($user, (int) $task->executor_unit_id);
    }

    /** Only leads (BOM-1/2/3) may skip a task (Q-16). */
    public function skip(User $user, PmTask $task): bool
    {
        return $this->directory->isLead($user, (int) $task->executor_unit_id);
    }

    public function reassign(User $user, PmTask $task): bool
    {
        return $this->directory->isLead($user, (int) $task->executor_unit_id);
    }

    public function upload(User $user, PmTask $task): bool
    {
        return $this->work($user, $task);
    }

    public function deleteAttachment(User $user, PmTask $task, Attachment $attachment): bool
    {
        return (int) $attachment->uploaded_by_id === (int) $user->id;
    }

    // ── Equipment ────────────────────────────────────────────────────────────

    /** Maintenance history lists PM tasks and work orders of the equipment. */
    public function viewHistory(User $user, Equipment $equipment): bool
    {
        return $user->canSeeEverything() || $this->directory->isStaffAnywhere($user);
    }

    public function manageEquipment(User $user, Equipment $equipment): bool
    {
        return $equipment->executor_unit_id
            ? $this->directory->isLead($user, (int) $equipment->executor_unit_id)
            : $this->directory->isLeadAnywhere($user);
    }
}
