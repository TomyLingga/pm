<?php

namespace App\Services\Org;

use App\Models\OrgUnit;
use App\Models\User;

/**
 * Who sees what along the Portal organisation tree (used by Program Kerja and Aktivitas Harian).
 *
 *   chain   = my unit + every unit above it + every unit below it (the branch I belong to)
 *   subtree = my unit + every unit below it (what a lead is responsible for)
 *
 * A BOM-2 in a sub bagian therefore sees the programmes of the seksi under it, a BOM-1 those of the
 * whole bagian, and a BOM-4 sees the programmes of its own seksi and of the units above it.
 */
class OrgVisibility
{
    /** @var array<int, int[]> */
    private array $chains = [];

    /** @var array<int, int[]> */
    private array $subtrees = [];

    public function __construct(private ExecutorDirectory $directory)
    {
    }

    /** @return int[] */
    public function chainIds(User $user): array
    {
        if (! $user->org_unit_id) {
            return [];
        }

        return $this->chains[$user->org_unit_id] ??= array_values(array_unique(array_merge(
            OrgUnit::selfAndAncestorIds($user->org_unit_id),
            OrgUnit::selfAndDescendantIds($user->org_unit_id),
        )));
    }

    /** @return int[] */
    public function subtreeIds(User $user): array
    {
        if (! $user->org_unit_id) {
            return [];
        }

        return $this->subtrees[$user->org_unit_id] ??= OrgUnit::selfAndDescendantIds($user->org_unit_id);
    }

    /** Grade above technicians (BOM-3 and up) → leads their unit and everything below it. */
    public function isLead(User $user): bool
    {
        return $user->isAdmin() || $this->directory->hasLeadGrade($user);
    }

    /** May the user manage (create / edit / close) things owned by this org unit? */
    public function canManageUnit(User $user, ?int $orgUnitId): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        return $orgUnitId !== null && $this->isLead($user) && in_array((int) $orgUnitId, $this->subtreeIds($user), true);
    }

    /** May the user see things owned by this org unit? */
    public function canSeeUnit(User $user, ?int $orgUnitId): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        return $orgUnitId !== null && in_array((int) $orgUnitId, $this->chainIds($user), true);
    }
}
