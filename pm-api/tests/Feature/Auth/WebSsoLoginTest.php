<?php

namespace Tests\Feature\Auth;

use App\Models\OrgUnit;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\Concerns\FakesPortal;
use Tests\TestCase;

class WebSsoLoginTest extends TestCase
{
    use FakesPortal;
    use RefreshDatabase;

    /** Requests from the Next.js origin are stateful (session cookie). */
    private array $spaHeaders = ['Referer' => 'http://pm.test/sso/verify', 'Origin' => 'http://pm.test'];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    public function test_sso_token_is_exchanged_for_a_session_and_profile_is_synced(): void
    {
        $superior = User::factory()->create(['portal_employee_id' => 'cccccccc-0000-0000-0000-000000000001']);
        Http::fake(['portal.test/api/sso/verify' => $this->portalOk($this->portalProfile())]);

        $response = $this->postJson('/api/v1/auth/sso', ['token' => 'one-time-token'], $this->spaHeaders)
            ->assertOk()
            ->assertJsonPath('data.nrk', '119090170')
            ->assertJsonPath('data.name', 'Muhammad Adib Nugraha')
            ->assertJsonPath('data.phone', '085322762975')
            ->assertJsonPath('data.employment_status', 'Karyawan Tetap')
            ->assertJsonPath('data.grade_code', 'BOM-3')
            ->assertJsonPath('data.bagian', 'Keuangan & Pengadaan')
            ->assertJsonPath('data.sub_bagian', 'Pengadaan')
            ->assertJsonPath('data.executor_units', []);

        $user = User::query()->where('portal_user_id', $this->portalUserId)->firstOrFail();
        $this->assertAuthenticatedAs($user, 'web');
        $this->assertSame($superior->id, $user->superior_id, 'Portal atasan_id is mirrored as superior');
        $this->assertNull($user->preferred_superior_id, 'own choice stays empty until the user picks one');
        $this->assertNotNull($user->last_login_at);
        $this->assertSame(OrgUnit::query()->where('portal_unit_id', '0a000000-0000-0000-0000-00000000000a')->value('id'), $user->orgUnit->parent_id);
        $this->assertArrayNotHasKey('password', $user->getAttributes());

        Http::assertSent(fn (Request $r) => $r->url() === 'http://portal.test/api/sso/verify'
            && $r['token'] === 'one-time-token'
            && $r['app_id'] === '11111111-1111-1111-1111-111111111111');
        $response->assertCookie('pm_app_session');
    }

    public function test_profile_is_refreshed_on_every_login(): void
    {
        User::factory()->create(['portal_user_id' => $this->portalUserId, 'name' => 'Nama Lama', 'position' => 'Staf']);
        Http::fake(['portal.test/api/sso/verify' => $this->portalOk($this->portalProfile(['jabatan' => 'Kepala Seksi']))]);

        $this->postJson('/api/v1/auth/sso', ['token' => 't'], $this->spaHeaders)->assertOk();

        $this->assertSame(1, User::query()->count());
        $this->assertSame('Kepala Seksi', User::query()->first()->position);
        $this->assertSame('Muhammad Adib Nugraha', User::query()->first()->name);
    }

    public function test_invalid_or_expired_token_is_rejected(): void
    {
        Http::fake(['portal.test/api/sso/verify' => $this->portalError('Token sudah expired', 400)]);

        $this->postJson('/api/v1/auth/sso', ['token' => 'expired'], $this->spaHeaders)
            ->assertUnauthorized()
            ->assertJsonFragment(['message' => 'Token SSO tidak valid atau sudah kedaluwarsa. Buka kembali PM-App dari Portal INTES.']);
        $this->assertGuest('web');
        $this->assertSame(0, User::query()->count());
    }

    public function test_portal_account_without_employee_is_rejected(): void
    {
        Http::fake(['portal.test/api/sso/verify' => $this->portalOk(array_merge($this->portalProfile(), ['employee' => null]))]);

        $this->postJson('/api/v1/auth/sso', ['token' => 't'], $this->spaHeaders)
            ->assertUnauthorized()
            ->assertJsonFragment(['message' => 'Akun Portal Anda belum terhubung ke data karyawan. Hubungi administrator Portal.']);
    }

    public function test_portal_down_returns_503(): void
    {
        Http::fake(['portal.test/*' => Http::response('oops', 500)]);

        $this->postJson('/api/v1/auth/sso', ['token' => 't'], $this->spaHeaders)->assertStatus(503);
    }

    public function test_logout_ends_the_web_session(): void
    {
        Http::fake(['portal.test/api/sso/verify' => $this->portalOk($this->portalProfile())]);
        $this->postJson('/api/v1/auth/sso', ['token' => 't'], $this->spaHeaders)->assertOk();

        $this->postJson('/api/v1/auth/logout', [], $this->spaHeaders)->assertNoContent();
        $this->assertGuest('web');
        Http::assertNotSent(fn (Request $r) => str_contains($r->url(), '/api/auth/logout'));
    }
}
