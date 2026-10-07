<?php

namespace App\Policies;

use App\Models\DailyActivity;
use App\Models\User;
use App\Services\Org\OrgVisibility;

/** Own reports always; leads see and manage the reports of everyone in their subtree; admins everything. */
class DailyActivityPolicy
{
    public function __construct(private OrgVisibility $visibility)
    {
    }

    public function view(User $user, DailyActivity $activity): bool
    {
        return (int) $activity->user_id === (int) $user->id || $this->visibility->canManageUnit($user, $activity->org_unit_id);
    }

    public function update(User $user, DailyActivity $activity): bool
    {
        return $this->view($user, $activity);
    }

    public function delete(User $user, DailyActivity $activity): bool
    {
        return $this->view($user, $activity);
    }

    /** Report on behalf of someone else: only for people in my subtree (leads) or admins. */
    public function reportFor(User $user, User $pic): bool
    {
        return (int) $pic->id === (int) $user->id || $this->visibility->canManageUnit($user, $pic->org_unit_id);
    }
}
