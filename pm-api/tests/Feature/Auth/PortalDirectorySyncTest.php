<?php

namespace Tests\Feature\Auth;

use App\Models\Office;
use App\Models\OrgUnit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\FakesPortal;
use Tests\TestCase;

class PortalDirectorySyncTest extends TestCase
{
    use FakesPortal;
    use RefreshDatabase;

    private const HO = 'e39ae5ed-9965-44f4-8d42-3b05682a6f1b';
    private const RO_MEDAN = 'ca59ec54-880a-4e1f-b53b-c07d2ddbca60';

    /** Portal `GET /api/sso/placements` rows; tests change it between syncs. */
    private array $placements = [];

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
            'portal.test/api/sso/placements' => $this->portalOk([$this->placement(self::HO, 'HO_SEIMANGKEI', 'Head Office INL Sei Mangkei')]),
        ]);

        $this->artisan('portal:sync')
            ->expectsOutput('Unit organisasi: 2, penempatan area: 1, karyawan: 1, dinonaktifkan: 1.')
            ->assertExitCode(0);

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
        $office = Office::query()->create(['code' => 'HO', 'name' => 'Head Office']);
        Http::fake([
            'portal.test/api/sso/organization-units' => $this->portalOk([]),
            'portal.test/api/sso/employees' => $this->portalOk([]),
            'portal.test/api/sso/placements' => $this->portalOk([]),
        ]);

        $this->artisan('portal:sync')->assertExitCode(0);
        $this->assertTrue($user->fresh()->is_active);
        $this->assertTrue($office->fresh()->is_active, 'an empty placement list hides no office');
    }

    public function test_portal_placements_become_the_form_request_offices(): void
    {
        $seeded = Office::query()->create(['code' => 'HO_SEIMANGKEI', 'name' => 'Head Office']);
        $legacy = Office::query()->create(['code' => 'PBK', 'name' => 'Pabrik']);
        $this->fakeDirectory();
        $this->placements = [
            $this->placement(self::RO_MEDAN, 'RO_MEDAN', 'Representative Office Medan'),
            $this->placement(self::HO, 'HO_SEIMANGKEI', 'Head Office INL Sei Mangkei'),
        ];

        $this->artisan('portal:sync')
            ->expectsOutput('Unit organisasi: 0, penempatan area: 2, karyawan: 0, dinonaktifkan: 0.')
            ->assertExitCode(0);

        $ho = $seeded->fresh();
        $this->assertSame(self::HO, $ho->portal_area_id, 'an office with the same code is taken over');
        $this->assertSame('Head Office INL Sei Mangkei', $ho->name);
        $this->assertFalse($legacy->fresh()->is_active, 'offices that are not Portal placements are hidden');

        Sanctum::actingAs(User::factory()->create());
        $this->getJson('/api/v1/offices')->assertOk()
            ->assertJsonPath('data.0.id', $ho->id)
            ->assertJsonPath('data.*.name', ['Head Office INL Sei Mangkei', 'Representative Office Medan'])
            ->assertJsonPath('data.*.code', ['HO_SEIMANGKEI', 'RO_MEDAN']);
    }

    public function test_offices_follow_later_changes_in_portal(): void
    {
        $this->fakeDirectory();
        $this->placements = [
            $this->placement(self::HO, 'HO_SEIMANGKEI', 'Head Office INL Sei Mangkei'),
            $this->placement(self::RO_MEDAN, 'RO_MEDAN', 'Representative Office Medan'),
        ];
        $this->artisan('portal:sync')->assertExitCode(0);
        $medan = Office::query()->where('portal_area_id', self::RO_MEDAN)->sole();

        // Renamed (new code and name) and RO Medan removed in Portal
        $this->placements = [$this->placement(self::HO, 'INL_SEIMANGKEI', 'INL Sei Mangkei')];
        $this->artisan('portal:sync')->assertExitCode(0);
        $ho = Office::query()->where('portal_area_id', self::HO)->sole();
        $this->assertSame(['INL_SEIMANGKEI', 'INL Sei Mangkei', true], [$ho->code, $ho->name, $ho->is_active]);
        $this->assertFalse($medan->fresh()->is_active, 'removed from Portal: hidden, not deleted');

        // Back in Portal: the same row is active again
        $this->placements[] = $this->placement(self::RO_MEDAN, 'RO_MEDAN', 'Representative Office Medan');
        $this->artisan('portal:sync')->assertExitCode(0);
        $this->assertTrue($medan->fresh()->is_active);
        $this->assertSame(2, Office::query()->count());
    }

    public function test_employees_get_their_placement_as_office(): void
    {
        $legacy = Office::query()->create(['code' => 'HO', 'name' => 'Head Office INL Sei Mangkei']);
        $employee = fn (string $n, ?string $placement) => [
            'id' => "eeeeeeee-0000-0000-0000-00000000000{$n}", 'employeeId' => "ffffffff-0000-0000-0000-00000000000{$n}",
            'namaLengkap' => "Karyawan {$n}", 'nrk' => "12000000{$n}", 'penempatanNama' => $placement,
        ];
        Http::fake([
            'portal.test/api/sso/organization-units' => $this->portalOk([]),
            'portal.test/api/sso/employees' => $this->portalOk([
                $employee('1', 'Head Office INL Sei Mangkei'),
                $employee('2', ' representative office medan '),
                $employee('3', null),
                $employee('4', 'Area Baru Belum Disinkron'),
            ]),
            'portal.test/api/sso/placements' => $this->portalOk([
                $this->placement(self::HO, 'HO_SEIMANGKEI', 'Head Office INL Sei Mangkei'),
                $this->placement(self::RO_MEDAN, 'RO_MEDAN', 'Representative Office Medan'),
            ]),
        ]);

        $this->artisan('portal:sync')->assertExitCode(0);

        $office = fn (string $nrk) => User::query()->where('nrk', $nrk)->sole()->office?->code;
        $this->assertSame('HO_SEIMANGKEI', $office('120000001'), 'matched by name, the Portal office wins over a legacy one');
        $this->assertSame('RO_MEDAN', $office('120000002'), 'name match ignores case and spaces');
        $this->assertNull($office('120000003'));
        $this->assertNull($office('120000004'));
        $this->assertFalse($legacy->fresh()->is_active);
    }

    public function test_unreadable_placements_keep_the_offices_and_still_sync_employees(): void
    {
        $office = Office::query()->create(['code' => 'HO', 'name' => 'Head Office']);
        Http::fake([
            'portal.test/api/sso/organization-units' => $this->portalOk([]),
            'portal.test/api/sso/employees' => $this->portalOk([[
                'id' => 'eeeeeeee-0000-0000-0000-000000000002', 'employeeId' => 'ffffffff-0000-0000-0000-000000000002',
                'namaLengkap' => 'Aundry Hermawan', 'nrk' => '120050224', 'email' => 'aundry@inl.co.id',
            ]]),
            'portal.test/api/sso/placements' => $this->portalError('Route GET:/api/sso/placements not found', 404),
        ]);

        $this->artisan('portal:sync')
            ->expectsOutput('Unit organisasi: 0, penempatan area: -, karyawan: 1, dinonaktifkan: 0.')
            ->expectsOutput('Penempatan area tidak bisa diambil dari Portal (Route GET:/api/sso/placements not found); daftar office tidak diubah.')
            ->assertExitCode(0);

        $this->assertTrue(User::query()->where('nrk', '120050224')->exists());
        $this->assertTrue($office->fresh()->is_active);
    }

    /** Portal directory with no units/employees; placements come from `$this->placements` at request time. */
    private function fakeDirectory(): void
    {
        Http::fake(function (Request $request) {
            return str_ends_with(parse_url($request->url(), PHP_URL_PATH), '/api/sso/placements')
                ? $this->portalOk($this->placements)
                : $this->portalOk([]);
        });
    }

    private function placement(string $id, string $code, string $name): array
    {
        return ['id' => $id, 'kode' => $code, 'nama' => $name, 'longitude' => '99.342672', 'latitude' => '3.132040'];
    }
}
