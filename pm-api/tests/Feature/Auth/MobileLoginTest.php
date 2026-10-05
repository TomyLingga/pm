<?php

namespace Tests\Feature\Auth;

use App\Models\PushSubscription;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\PersonalAccessToken;
use Tests\Concerns\FakesPortal;
use Tests\TestCase;

class MobileLoginTest extends TestCase
{
    use FakesPortal;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    /** @param \GuzzleHttp\Promise\PromiseInterface|null $loginResponse */
    private function fakePortalLogin($loginResponse = null): void
    {
        Http::fake([
            'portal.test/api/auth/login' => $loginResponse ?? $this->portalOk(['accessToken' => 'portal-jwt', 'refreshToken' => 'r', 'expiresIn' => '8h']),
            'portal.test/api/auth/login/totp-verify' => $this->portalOk(['accessToken' => 'portal-jwt-totp', 'refreshToken' => 'r']),
            'portal.test/api/sso/token*' => $this->portalOk(['token' => 'sso-ticket', 'redirectUrl' => 'http://pm.test']),
            'portal.test/api/sso/verify' => $this->portalOk($this->portalProfile()),
        ]);
    }

    private function login(string $login = 'adib@inl.co.id', string $password = 'Rahasia123')
    {
        return $this->postJson('/api/v1/auth/mobile/login', [
            'login' => $login, 'password' => $password, 'device_name' => 'Samsung A54',
        ]);
    }

    public function test_login_with_email_returns_a_permanent_device_token(): void
    {
        $this->fakePortalLogin();

        $token = $this->login()->assertOk()
            ->assertJsonPath('data.user.nrk', '119090170')
            ->assertJsonPath('data.user.sub_bagian', 'Pengadaan')
            ->json('data.token');

        $this->assertNotEmpty($token);
        $stored = PersonalAccessToken::query()->sole();
        $this->assertSame('Samsung A54', $stored->name);
        $this->assertSame(['mobile'], $stored->abilities);

        // Credentials go to Portal; the Portal token is used for the SSO ticket only.
        Http::assertSent(fn (Request $r) => str_ends_with($r->url(), '/api/auth/login')
            && $r['email'] === 'adib@inl.co.id' && $r['password'] === 'Rahasia123');
        Http::assertSent(fn (Request $r) => str_contains($r->url(), '/api/sso/token')
            && $r->hasHeader('Authorization', 'Bearer portal-jwt')
            && str_contains($r->url(), 'app_id=11111111-1111-1111-1111-111111111111'));
        Http::assertSent(fn (Request $r) => str_ends_with($r->url(), '/api/sso/verify') && $r['token'] === 'sso-ticket');
        Http::assertNotSent(fn (Request $r) => str_contains($r->url(), '/api/auth/logout'));

        // Token keeps working long after (no expiry)
        $this->travelTo(now()->addYear());
        $this->withToken($token)->getJson('/api/v1/auth/me')->assertOk()->assertJsonPath('data.nrk', '119090170');
    }

    public function test_login_with_nrk_maps_to_the_portal_email(): void
    {
        User::factory()->create(['nrk' => '119090170', 'email' => 'adib@inl.co.id']);
        $this->fakePortalLogin();

        $this->login('119090170')->assertOk();
        Http::assertSent(fn (Request $r) => str_ends_with($r->url(), '/api/auth/login') && $r['email'] === 'adib@inl.co.id');
    }

    public function test_unknown_nrk_and_wrong_password_are_validation_errors(): void
    {
        $this->fakePortalLogin($this->portalError('Email atau password salah', 400));

        $this->login('999999')->assertStatus(422)->assertJsonValidationErrors('login');
        $this->login('adib@inl.co.id', 'salah')->assertStatus(422)
            ->assertJsonPath('errors.login.0', 'Email atau password salah');
        $this->assertSame(0, PersonalAccessToken::query()->count());
    }

    public function test_totp_accounts_need_a_second_step(): void
    {
        $this->fakePortalLogin($this->portalOk(['requiresTotp' => true, 'totpToken' => 'totp-ticket']));

        $first = $this->login()->assertOk()
            ->assertJsonPath('data.requires_totp', true)
            ->assertJsonPath('data.totp_token', 'totp-ticket');
        $this->assertArrayNotHasKey('token', $first->json('data'));

        $this->postJson('/api/v1/auth/mobile/totp', ['totp_token' => 'totp-ticket', 'code' => '123456', 'device_name' => 'Samsung A54'])
            ->assertOk()->assertJsonStructure(['data' => ['token', 'user' => ['id', 'nrk']]]);
        Http::assertSent(fn (Request $r) => str_ends_with($r->url(), '/login/totp-verify')
            && $r['totpToken'] === 'totp-ticket' && $r['code'] === '123456');
    }

    public function test_login_is_rate_limited(): void
    {
        $this->fakePortalLogin($this->portalError('Email atau password salah', 400));

        for ($i = 0; $i < 5; $i++) {
            $this->login('adib@inl.co.id', 'salah')->assertStatus(422);
        }
        $this->login('adib@inl.co.id', 'salah')->assertStatus(429);
    }

    public function test_logout_revokes_only_this_device(): void
    {
        $this->fakePortalLogin();
        $phone = $this->login()->json('data.token');
        $tablet = $this->login()->json('data.token');
        $user = User::query()->sole();

        $this->withToken($phone)->postJson('/api/v1/push-subscriptions', [
            'channel' => 'expo', 'token' => 'ExponentPushToken[phone]', 'device_name' => 'Samsung A54',
        ])->assertCreated();
        $this->assertSame(1, $user->pushSubscriptions()->count());

        $this->withToken($phone)->postJson('/api/v1/auth/logout')->assertNoContent();
        app('auth')->forgetGuards();

        $this->assertSame(0, PushSubscription::query()->count(), 'push token of the device is removed');
        $this->withToken($phone)->getJson('/api/v1/auth/me')->assertUnauthorized();
        app('auth')->forgetGuards();
        $this->withToken($tablet)->getJson('/api/v1/auth/me')->assertOk();
    }

    public function test_deactivated_user_loses_mobile_access(): void
    {
        $this->fakePortalLogin();
        $token = $this->login()->json('data.token');
        User::query()->update(['is_active' => false]);

        $this->withToken($token)->getJson('/api/v1/auth/me')->assertUnauthorized();
        $this->assertSame(0, PersonalAccessToken::query()->count());
    }
}
