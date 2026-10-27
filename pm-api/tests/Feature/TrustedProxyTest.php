<?php

namespace Tests\Feature;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/** Behind pm-web (Next.js rewrites) and the server's reverse proxy, Laravel sees the real client and origin. */
class TrustedProxyTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Route::get('/_test/client', fn (Request $request) => [
            'ip' => $request->ip(),
            'secure' => $request->secure(),
            'url' => url('/x'),
        ]);
    }

    private function viaProxy(string $remoteAddr)
    {
        return $this->withServerVariables(['REMOTE_ADDR' => $remoteAddr])->getJson('/_test/client', [
            'X-Forwarded-For' => '203.0.113.7',
            'X-Forwarded-Host' => 'pm.inl.co.id',
            'X-Forwarded-Proto' => 'https',
            'X-Forwarded-Port' => '8099', // an internal port passed along the proxy chain
        ]);
    }

    public function test_requests_through_the_web_container_keep_the_client_ip_and_origin(): void
    {
        $this->viaProxy('172.18.0.5')->assertOk() // pm-web on the Docker network
            ->assertJsonPath('ip', '203.0.113.7')
            ->assertJsonPath('secure', true)
            ->assertJsonPath('url', 'https://pm.inl.co.id/x');
    }

    public function test_forwarded_headers_from_an_untrusted_address_are_ignored(): void
    {
        $this->viaProxy('198.51.100.9')->assertOk()
            ->assertJsonPath('ip', '198.51.100.9')
            ->assertJsonPath('secure', false);
    }

    public function test_the_trusted_proxies_are_configurable(): void
    {
        config(['trustedproxy.proxies' => '10.20.0.0/16']);

        $this->viaProxy('172.18.0.5')->assertOk()->assertJsonPath('ip', '172.18.0.5');
    }
}
