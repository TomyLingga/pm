<?php

namespace App\Services\Portal;

use App\Exceptions\PortalException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

/**
 * HTTP client for Portal INTES (`/api/auth/*` and `/api/sso/*`). See docs/SSO.md.
 */
class PortalClient
{
    /** Exchange a one-time SSO token for the user's profile. */
    public function verifySsoToken(string $token, ?string $appId = null): array
    {
        return $this->send(fn () => $this->http()->post('/api/sso/verify', [
            'token' => $token,
            'app_id' => $appId ?: config('portal.app_id'),
        ]));
    }

    /**
     * Check email + password at Portal.
     *
     * @return array{accessToken?: string, requiresTotp?: bool, totpToken?: string}
     */
    public function login(string $email, string $password): array
    {
        return $this->send(fn () => $this->http()->post('/api/auth/login', [
            'email' => $email,
            'password' => $password,
        ]));
    }

    /** @return array{accessToken: string} */
    public function verifyTotp(string $totpToken, string $code): array
    {
        return $this->send(fn () => $this->http()->post('/api/auth/login/totp-verify', [
            'totpToken' => $totpToken,
            'code' => $code,
        ]));
    }

    /** Ask Portal for an SSO token for PM-App on behalf of a logged-in Portal user (checks app access rules). */
    public function issueSsoToken(string $portalAccessToken, ?string $appId = null): string
    {
        $data = $this->send(fn () => $this->http()
            ->withToken($portalAccessToken)
            ->get('/api/sso/token', ['app_id' => $appId ?: config('portal.app_id')]));

        if (empty($data['token'])) {
            throw new PortalException('Portal tidak mengembalikan token SSO.', 502);
        }

        return $data['token'];
    }

    /** Active employees that have a Portal account (max 500 rows, Portal limit). */
    public function employees(): array
    {
        return $this->send(fn () => $this->internal()->get('/api/sso/employees'));
    }

    public function organizationUnits(): array
    {
        return $this->send(fn () => $this->internal()->get('/api/sso/organization-units'));
    }

    private function http(): PendingRequest
    {
        return Http::baseUrl(config('portal.api_url'))
            ->acceptJson()
            ->timeout(config('portal.timeout'))
            ->withOptions(['verify' => config('portal.verify_tls')]);
    }

    private function internal(): PendingRequest
    {
        return $this->http()->withHeaders(['x-internal' => (string) config('portal.internal_token')]);
    }

    private function send(callable $request): array
    {
        try {
            /** @var Response $response */
            $response = $request();
        } catch (ConnectionException) {
            throw PortalException::unreachable();
        }

        if (! $response->successful() || $response->json('success') === false) {
            throw PortalException::fromResponse($response);
        }

        return (array) ($response->json('data') ?? []);
    }
}
