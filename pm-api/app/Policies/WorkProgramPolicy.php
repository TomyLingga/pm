<?php

namespace App\Policies;

use App\Models\User;
use App\Models\WorkProgram;
use App\Models\WorkProgramActivity;
use App\Services\Org\OrgVisibility;

/**
 * Who = org tree: everyone in the programme's branch sees it (staff see their seksi's and the units above,
 * a Kasubag/Kabag sees everything below); leads of the owning unit or above manage it; PICs update their rows.
 */
class WorkProgramPolicy
{
    public function __construct(private OrgVisibility $visibility)
    {
    }

    public function view(User $user, WorkProgram $program): bool
    {
        return $this->visibility->canSeeUnit($user, $program->org_unit_id) || $this->isPicAnywhere($user, $program);
    }

    /** Create a programme for an org unit (lead of that unit or of a unit above it). */
    public function createFor(User $user, int $orgUnitId): bool
    {
        return $this->visibility->canManageUnit($user, $orgUnitId);
    }

    public function manage(User $user, WorkProgram $program): bool
    {
        return $this->visibility->canManageUnit($user, $program->org_unit_id);
    }

    /** Status / progress / remarks of one activity: managers of the programme or its PICs. */
    public function updateActivity(User $user, WorkProgramActivity $activity): bool
    {
        $program = $activity->item->program;

        return $this->manage($user, $program) || $activity->isPic($user);
    }

    private function isPicAnywhere(User $user, WorkProgram $program): bool
    {
        return WorkProgramActivity::query()
            ->whereHas('item', fn ($q) => $q->where('work_program_id', $program->id))
            ->whereHas('pics', fn ($q) => $q->where('users.id', $user->id))
            ->exists();
    }
}
