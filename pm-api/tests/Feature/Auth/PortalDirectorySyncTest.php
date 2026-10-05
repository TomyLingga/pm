<?php

namespace Tests\Feature\Auth;

use App\Models\OrgUnit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\Concerns\FakesPortal;
use Tests\TestCase;

class PortalDirectorySyncTest extends TestCase
{
    use FakesPortal;
    use RefreshDatabase;

    public function test_org_units_and_employees_are_synced_and_missing_users_deactivated(): void
    {
        $leaver = User::factory()->create(['portal_user_id' => 'dddddddd-0000-0000-0000-000000000009']);

        Http::fake([
            'portal.test/api/sso/organization-units' => $this->portalOk([
                // child listed before its parent on purpose
                ['id' => '0c000000-0000-0000-0000-00000000000c', 'kode' => 'IT', 'nama' => 'IT', 'tipe' => 'seksi', 'parentId' => '0d000000-0000-0000-0000-00000000000d', 'isActive' => true],
                ['id' => '0d000000-0000-0000-0000-00000000000d', 'kode' => 'SIT', 'nama' => 'Sistem & IT', 'tipe' => 'sub_bagian', 'parentId' => null, 'isActive' => true],
            ]),
            'portal.test/api/sso/employees' => $this->portalOk([[
                'id' => 'eeeeeeee-0000-0000-0000-000000000001', 'employeeId' => 'ffffffff-0000-0000-0000-000000000001',
                'namaLengkap' => 'Tomy Inri Akbar Lingga', 'jabatan' => 'Foreman IT', 'gradeLevel' => 5, 'gradeKode' => 'BOM-4',
                'unitId' => '0c000000-0000-0000-0000-00000000000c', 'unitKode' => 'IT', 'nrk' => '120010001', 'email' => 'tomy@inl.co.id',
                'nomorHp' => '082178546887', 'statusKaryawanLabel' => 'Karyawan Tetap',
            ]]),
        ]);

        $this->artisan('portal:sync')->assertExitCode(0);

        $it = OrgUnit::query()->where('portal_unit_id', '0c000000-0000-0000-0000-00000000000c')->sole();
        $this->assertSame(OrgUnit::query()->where('portal_unit_id', '0d000000-0000-0000-0000-00000000000d')->value('id'), $it->parent_id);

        $tomy = User::query()->where('nrk', '120010001')->sole();
        $this->assertSame($it->id, $tomy->org_unit_id);
        $this->assertSame('BOM-4', $tomy->grade_code);
        $this->assertSame('082178546887', $tomy->phone);
        $this->assertTrue($tomy->is_active);
        $this->assertFalse($leaver->fresh()->is_active, 'users no longer returned by Portal are deactivated');

        Http::assertSent(fn (Request $r) => $r->hasHeader('x-internal', 'internal-test-token'));
    }

    public function test_empty_portal_response_does_not_deactivate_everybody(): void
    {
        $user = User::factory()->create();
        Http::fake([
            'portal.test/api/sso/organization-units' => $this->portalOk([]),
            'portal.test/api/sso/employees' => $this->portalOk([]),
        ]);

        $this->artisan('portal:sync')->assertExitCode(0);
        $this->assertTrue($user->fresh()->is_active);
    }
}
