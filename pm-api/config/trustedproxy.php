<?php

return [
    /*
    | Proxies whose X-Forwarded-For / -Host / -Proto headers are trusted (App\Http\Middleware\TrustProxies).
    |
    | In Docker every request reaches pm-api through the pm-web container (Next.js rewrites /api and /sanctum),
    | usually behind the server's reverse proxy. Without trusting them every user would share one IP, so the
    | per-IP login throttles would hit the whole company at once, and generated URLs would point at
    | http://pm-api:8080. Comma-separated IPs/CIDRs (default: loopback + private networks), or "*" for the caller.
    */
    'proxies' => env('TRUSTED_PROXIES', '127.0.0.1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16'),
];
