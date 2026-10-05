<?php

namespace App\Services\Portal;

use App\Models\OrgUnit;
use App\Models\User;
use App\Services\Auth\PortalUserSync;
use Illuminate\Support\Facades\DB;

/**
 * Pulls org units and employees from Portal so that superiors and technicians who never
 * logged in can still be picked and notified.
 */
class PortalDirectorySync
{
    /** Portal caps `/api/sso/employees` at this many rows. */
    private const PORTAL_EMPLOYEE_LIMIT = 500;

    public function __construct(private PortalClient $portal)
    {
    }

    /** @return array{org_units: int, users: int, deactivated: int} */
    public function sync(): array
    {
        $units = $this->portal->organizationUnits();
        $employees = $this->portal->employees();

        return DB::transaction(function () use ($units, $employees) {
            $unitCount = $this->syncOrgUnits($units);
            [$userCount, $deactivated] = $this->syncEmployees($employees);

            return ['org_units' => $unitCount, 'users' => $userCount, 'deactivated' => $deactivated];
        });
    }

    private function syncOrgUnits(array $units): int
    {
        $idMap = [];
        foreach ($units as $row) {
            $unit = OrgUnit::query()->updateOrCreate(
                ['portal_unit_id' => $row['id']],
                [
                    'code' => $row['kode'] ?? '',
                    'name' => $row['nama'] ?? '',
                    'type' => $row['tipe'] ?? '',
                    'is_active' => (bool) ($row['isActive'] ?? true),
                    'synced_at' => now(),
                ]
            );
            $idMap[$row['id']] = $unit->id;
        }

        // Second pass: parents may appear after their children.
        foreach ($units as $row) {
            OrgUnit::query()->where('id', $idMap[$row['id']])
                ->update(['parent_id' => isset($row['parentId']) ? ($idMap[$row['parentId']] ?? null) : null]);
        }

        return count($units);
    }

    /** @return array{0: int, 1: int} */
    private function syncEmployees(array $employees): array
    {
        $unitIds = OrgUnit::query()->pluck('id', 'portal_unit_id');
        $seen = [];

        foreach ($employees as $row) {
            if (empty($row['id'])) {
                continue;
            }

            $user = PortalUserSync::findExisting($row['id'], $row['employeeId'] ?? null, $row['nrk'] ?? null) ?? new User();

            $user->fill(array_filter([
                'portal_user_id' => $row['id'],
                'portal_employee_id' => $row['employeeId'] ?? null,
                'nrk' => $row['nrk'] ?? null,
                'name' => $row['namaLengkap'] ?? null,
                'email' => $row['email'] ?? null,
                'phone' => $row['nomorHp'] ?? null,
                'employment_status' => $row['statusKaryawanLabel'] ?? null,
                'position' => $row['jabatan'] ?? null,
                'grade_code' => $row['gradeKode'] ?? null,
                'grade_level' => $row['gradeLevel'] ?? null,
                'org_unit_id' => isset($row['unitId']) ? ($unitIds[$row['unitId']] ?? null) : null,
            ], fn ($v) => $v !== null));
            $user->is_active = true;
            $user->profile_synced_at = now();
            if (! $user->name) {
                $user->name = $row['email'] ?? 'Karyawan';
            }
            $user->save();
            $seen[] = $user->id;
        }

        // Second pass: Portal atasan_id (employee id) → users.superior_id, now that every user exists.
        $userIdByEmployee = User::query()->whereNotNull('portal_employee_id')->pluck('id', 'portal_employee_id');
        foreach ($employees as $row) {
            if (! empty($row['employeeId']) && isset($userIdByEmployee[$row['employeeId']])) {
                User::query()->whereKey($userIdByEmployee[$row['employeeId']])->update([
                    'superior_id' => isset($row['atasanId']) ? ($userIdByEmployee[$row['atasanId']] ?? null) : null,
                ]);
            }
        }

        // Only deactivate when Portal returned a non-empty, complete list (below its row cap).
        $deactivated = 0;
        if ($seen && count($employees) < self::PORTAL_EMPLOYEE_LIMIT) {
            $deactivated = User::query()->whereNotNull('portal_user_id')->whereNotIn('id', $seen)
                ->where('is_active', true)->update(['is_active' => false]);
        }

        return [count($seen), $deactivated];
    }
}
