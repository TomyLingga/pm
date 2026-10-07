<?php

namespace App\Services\Org;

use App\Models\ExecutorUnit;
use App\Models\ExecutorUnitMember;
use App\Models\OrgUnit;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * Who belongs to which executor unit (seksi pelaksana) and who leads it.
 *
 * An executor unit is always a Portal *seksi*. Its superiors stay in the org chain above it:
 * Staff = active users in the seksi's org subtree
 *       + users with a lead grade in the sub bagian / bagian above the seksi (Kasubag, Kabag, ...)
 *       + `include` members, minus `exclude` members.
 * Lead  = staff whose Portal grade is in `pm.lead_grade_codes` (grade above technicians), or admin.
 */
class ExecutorDirectory
{
    /** Org levels above a seksi whose lead-grade users also lead it. */
    public const SUPERIOR_LEVELS = [OrgUnit::TYPE_SUB_BAGIAN, OrgUnit::TYPE_BAGIAN];

    /** @var array<int, Collection<int, ExecutorUnit>> */
    private array $unitsByUser = [];

    /** @return Collection<int, ExecutorUnit> */
    public function unitsFor(User $user): Collection
    {
        return $this->unitsByUser[$user->id] ??= $this->resolveUnits($user);
    }

    public function isStaff(User $user, ExecutorUnit|int $unit): bool
    {
        $unitId = $unit instanceof ExecutorUnit ? $unit->id : $unit;

        return $this->unitsFor($user)->contains('id', $unitId);
    }

    public function isLead(User $user, ExecutorUnit|int $unit): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        return $this->isStaff($user, $unit) && $this->hasLeadGrade($user);
    }

    public function hasLeadGrade(User $user): bool
    {
        return in_array($user->grade_code, config('pm.lead_grade_codes'), true);
    }

    /**
     * Delegation only goes downwards: a lead may assign work to staff whose Portal grade is below their own
     * (BOM-3 → BOM-4, BOM-2 → BOM-3/BOM-4), or to themselves. Admins may assign to anyone.
     */
    public function canDelegateTo(User $from, User $to): bool
    {
        if ($from->isAdmin() || (int) $from->id === (int) $to->id) {
            return true;
        }
        if ($from->grade_level === null) {
            return false;
        }

        return (int) ($to->grade_level ?? 0) < (int) $from->grade_level;
    }

    /** Lead of at least one executor unit (or admin). */
    public function isLeadAnywhere(User $user): bool
    {
        return $user->isAdmin() || ($this->hasLeadGrade($user) && $this->unitsFor($user)->isNotEmpty());
    }

    /** Staff of at least one executor unit. */
    public function isStaffAnywhere(User $user): bool
    {
        return $this->unitsFor($user)->isNotEmpty();
    }

    /** @return int[] ids of the executor units the user belongs to */
    public function unitIdsFor(User $user): array
    {
        return $this->unitsFor($user)->pluck('id')->map(fn ($id) => (int) $id)->all();
    }

    /** Active staff of an executor unit. */
    public function staffQuery(ExecutorUnit $unit): Builder
    {
        $members = ExecutorUnitMember::query()->where('executor_unit_id', $unit->id)->get();
        $included = $members->where('membership', ExecutorUnitMember::INCLUDE)->pluck('user_id')->all();
        $excluded = $members->where('membership', ExecutorUnitMember::EXCLUDE)->pluck('user_id')->all();
        $orgUnitIds = OrgUnit::selfAndDescendantIds($unit->org_unit_id);
        $superiorUnitIds = $this->superiorUnitIds($unit->org_unit_id);

        return User::query()
            ->where('is_active', true)
            ->where(fn (Builder $q) => $q
                ->whereIn('org_unit_id', $orgUnitIds)
                ->orWhere(fn (Builder $s) => $s
                    ->whereIn('org_unit_id', $superiorUnitIds ?: [0])
                    ->whereIn('grade_code', config('pm.lead_grade_codes')))
                ->orWhereIn('id', $included ?: [0]))
            ->when($excluded, fn (Builder $q) => $q->whereNotIn('id', $excluded));
    }

    /** @return int[] the sub bagian / bagian units above a seksi */
    private function superiorUnitIds(int $orgUnitId): array
    {
        $chain = OrgUnit::selfAndAncestorIds($orgUnitId);
        array_shift($chain); // the seksi itself

        return OrgUnit::query()->whereIn('id', $chain ?: [0])->whereIn('type', self::SUPERIOR_LEVELS)
            ->pluck('id')->map(fn ($id) => (int) $id)->all();
    }

    /** @return Collection<int, ExecutorUnit> */
    private function resolveUnits(User $user): Collection
    {
        $orgChain = $user->org_unit_id ? OrgUnit::selfAndAncestorIds($user->org_unit_id) : [];
        $memberships = ExecutorUnitMember::query()->where('user_id', $user->id)->get();
        $included = $memberships->where('membership', ExecutorUnitMember::INCLUDE)->pluck('executor_unit_id')->all();
        $excluded = $memberships->where('membership', ExecutorUnitMember::EXCLUDE)->pluck('executor_unit_id')->all();

        // A Kasubag / Kabag (lead grade in a sub bagian or bagian) leads every seksi below that unit.
        $ledSubtree = [];
        if ($user->org_unit_id && $this->hasLeadGrade($user)) {
            $own = OrgUnit::query()->find($user->org_unit_id);
            if ($own && in_array($own->type, self::SUPERIOR_LEVELS, true)) {
                $ledSubtree = OrgUnit::selfAndDescendantIds($own->id);
            }
        }

        return ExecutorUnit::query()
            ->where('is_active', true)
            ->where(fn (Builder $q) => $q
                ->whereIn('org_unit_id', $orgChain ?: [0])
                ->orWhereIn('org_unit_id', $ledSubtree ?: [0])
                ->orWhereIn('id', $included ?: [0]))
            ->when($excluded, fn (Builder $q) => $q->whereNotIn('id', $excluded))
            ->orderBy('display_name')
            ->get();
    }
}
