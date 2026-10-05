<?php

namespace App\Services\Auth;

use App\Exceptions\PortalException;
use App\Models\OrgUnit;
use App\Models\User;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

/**
 * Upserts the local user (and its org-unit chain) from a Portal `/api/sso/verify` payload.
 */
class PortalUserSync
{
    public function syncFromVerifyPayload(array $data): User
    {
        $employee = $data['employee'] ?? null;

        if (! $employee) {
            throw new PortalException('Akun Portal Anda belum terhubung ke data karyawan. Hubungi administrator Portal.', 403);
        }
        if (! ($data['isActive'] ?? true) || ! ($employee['isActive'] ?? true)) {
            throw new PortalException('Akun Anda tidak aktif di Portal.', 403);
        }

        return DB::transaction(function () use ($data, $employee) {
            $orgUnit = $this->syncHierarchy(Arr::get($employee, 'unit.hierarchy', []));

            $user = self::findExisting($data['id'], $employee['id'] ?? null, $employee['nrk'] ?? null) ?? new User();

            $user->fill([
                'portal_user_id' => $data['id'],
                'portal_employee_id' => $employee['id'] ?? null,
                'nrk' => $employee['nrk'] ?? $user->nrk,
                'name' => $employee['namaLengkap'] ?? $employee['nama'] ?? $data['email'],
                'email' => $data['email'] ?? $user->email,
                'phone' => $employee['nomorHp'] ?? $user->phone,
                'employment_status' => Arr::get($employee, 'statusKaryawan.label', $user->employment_status),
                'position' => $employee['jabatan'] ?? null,
                'grade_code' => Arr::get($employee, 'grade.kode'),
                'grade_level' => Arr::get($employee, 'grade.level'),
                'org_unit_id' => $orgUnit?->id,
                'photo_url' => $employee['fotoProfil'] ?? null,
                'is_active' => true,
                'profile_synced_at' => now(),
            ]);

            // Portal's atasan_id (default "Atasan YBS"); the requester may still pick another superior per document.
            $superiorEmployeeId = Arr::get($employee, 'atasan.id');
            $user->superior_id = $superiorEmployeeId
                ? User::query()->where('portal_employee_id', $superiorEmployeeId)->value('id')
                : null;

            $user->save();

            return $user;
        });
    }

    /**
     * Match a local user by Portal user ID, then employee ID, then NRK
     * (a Portal account may be recreated for the same employee).
     */
    public static function findExisting(?string $portalUserId, ?string $portalEmployeeId, ?string $nrk): ?User
    {
        foreach (['portal_user_id' => $portalUserId, 'portal_employee_id' => $portalEmployeeId, 'nrk' => $nrk] as $column => $value) {
            if ($value && ($user = User::query()->where($column, $value)->first())) {
                return $user;
            }
        }

        return null;
    }

    /**
     * Upsert the unit chain sent by Portal (root first) and return the deepest unit.
     *
     * @param  array<int, array{id: string, kode?: string, nama?: string, tipe?: string, parentId?: ?string}>  $hierarchy
     */
    public function syncHierarchy(array $hierarchy): ?OrgUnit
    {
        $parent = null;
        $unit = null;

        foreach ($hierarchy as $node) {
            if (empty($node['id'])) {
                continue;
            }

            $unit = OrgUnit::query()->updateOrCreate(
                ['portal_unit_id' => $node['id']],
                [
                    'code' => $node['kode'] ?? '',
                    'name' => $node['nama'] ?? '',
                    'type' => $node['tipe'] ?? '',
                    'parent_id' => $parent?->id,
                    'is_active' => true,
                    'synced_at' => now(),
                ]
            );
            $parent = $unit;
        }

        return $unit;
    }
}
