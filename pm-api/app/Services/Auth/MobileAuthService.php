<?php

namespace App\Services\Auth;

use App\Exceptions\PortalException;
use App\Models\User;
use App\Services\Portal\PortalClient;
use Illuminate\Validation\ValidationException;

/**
 * Login for the Android app: credentials are checked by Portal, PM-App issues its own
 * non-expiring Sanctum token per device. Passwords are never stored.
 */
class MobileAuthService
{
    public function __construct(
        private PortalClient $portal,
        private PortalUserSync $userSync,
    ) {
    }

    /**
     * @return array{requires_totp: true, totp_token: string}|array{token: string, user: User}
     */
    public function login(string $login, string $password, string $deviceName): array
    {
        $email = $this->resolveEmail($login);

        try {
            $result = $this->portal->login($email, $password);
        } catch (PortalException $e) {
            throw $this->credentialError($e);
        }

        if (! empty($result['requiresTotp'])) {
            return ['requires_totp' => true, 'totp_token' => (string) $result['totpToken']];
        }

        return $this->issueToken((string) ($result['accessToken'] ?? ''), $deviceName);
    }

    /** @return array{token: string, user: User} */
    public function verifyTotp(string $totpToken, string $code, string $deviceName): array
    {
        try {
            $result = $this->portal->verifyTotp($totpToken, $code);
        } catch (PortalException $e) {
            if (! $e->isClientError()) {
                throw $e;
            }
            throw ValidationException::withMessages(['code' => [$e->getMessage()]]);
        }

        return $this->issueToken((string) ($result['accessToken'] ?? ''), $deviceName);
    }

    /** @return array{token: string, user: User} */
    private function issueToken(string $portalAccessToken, string $deviceName): array
    {
        // The Portal access token is used once to obtain an SSO ticket and then discarded.
        // Never call Portal logout here: it would end every Portal session of the user.
        $ssoToken = $this->portal->issueSsoToken($portalAccessToken);
        $user = $this->userSync->syncFromVerifyPayload($this->portal->verifySsoToken($ssoToken));
        $user->forceFill(['last_login_at' => now()])->save();

        $token = $user->createToken($deviceName, ['mobile'])->plainTextToken;

        return ['token' => $token, 'user' => $user];
    }

    /** Portal only accepts email; NRK is mapped through the local directory. */
    private function resolveEmail(string $login): string
    {
        $login = trim($login);
        if (str_contains($login, '@')) {
            return $login;
        }

        $email = User::query()->where('nrk', $login)->whereNotNull('email')->value('email');
        if (! $email) {
            throw ValidationException::withMessages([
                'login' => ['NRK tidak dikenal. Gunakan email Portal Anda.'],
            ]);
        }

        return $email;
    }

    private function credentialError(PortalException $e): \Throwable
    {
        if (! $e->isClientError()) {
            return $e;
        }

        return ValidationException::withMessages(['login' => [$e->getMessage()]]);
    }
}
