<?php

namespace App\Http\Middleware;

use Illuminate\Http\Middleware\TrustProxies as Middleware;
use Illuminate\Http\Request;

class TrustProxies extends Middleware
{
    /**
     * The trusted proxies for this application (null = `trustedproxy.proxies`, i.e. TRUSTED_PROXIES).
     *
     * @var array<int, string>|string|null
     */
    protected $proxies;

    /**
     * The headers that should be used to detect proxies.
     *
     * Not X-Forwarded-Port: along the reverse proxy → pm-web (Next.js) → pm-api chain it can carry an internal
     * port such as 8099, which would end up in generated URLs; the port follows the scheme instead.
     *
     * @var int
     */
    protected $headers =
        Request::HEADER_X_FORWARDED_FOR |
        Request::HEADER_X_FORWARDED_HOST |
        Request::HEADER_X_FORWARDED_PROTO;

    /** Laravel 8 only recognises single constants here and trusts every header for a combined bit field. */
    protected function getTrustedHeaderNames()
    {
        return $this->headers;
    }
}
