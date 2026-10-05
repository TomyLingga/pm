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
 * Staff = active users in the unit's org subtree, plus `include` members, minus `exclude` members.
 * Lead  = staff whose Portal grade is in `pm.lead_grade_codes` (grade above technicians), or admin.
 */
class ExecutorDirectory
{
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

    /** Active staff of an executor unit. */
    public function staffQuery(ExecutorUnit $unit): Builder
    {
        $members = ExecutorUnitMember::query()->where('executor_unit_id', $unit->id)->get();
        $included = $members->where('membership', ExecutorUnitMember::INCLUDE)->pluck('user_id')->all();
        $excluded = $members->where('membership', ExecutorUnitMember::EXCLUDE)->pluck('user_id')->all();
        $orgUnitIds = OrgUnit::selfAndDescendantIds($unit->org_unit_id);

        return User::query()
            ->where('is_active', true)
            ->where(fn (Builder $q) => $q->whereIn('org_unit_id', $orgUnitIds)->orWhereIn('id', $included ?: [0]))
            ->when($excluded, fn (Builder $q) => $q->whereNotIn('id', $excluded));
    }

    /** @return Collection<int, ExecutorUnit> */
    private function resolveUnits(User $user): Collection
    {
        $orgChain = $user->org_unit_id ? OrgUnit::selfAndAncestorIds($user->org_unit_id) : [];
        $memberships = ExecutorUnitMember::query()->where('user_id', $user->id)->get();
        $included = $memberships->where('membership', ExecutorUnitMember::INCLUDE)->pluck('executor_unit_id')->all();
        $excluded = $memberships->where('membership', ExecutorUnitMember::EXCLUDE)->pluck('executor_unit_id')->all();

        return ExecutorUnit::query()
            ->where('is_active', true)
            ->where(fn (Builder $q) => $q->whereIn('org_unit_id', $orgChain ?: [0])->orWhereIn('id', $included ?: [0]))
            ->when($excluded, fn (Builder $q) => $q->whereNotIn('id', $excluded))
            ->orderBy('display_name')
            ->get();
    }
}
