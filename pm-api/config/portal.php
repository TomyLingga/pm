<?php

// Integration with Portal INTES (see docs/SSO.md).
return [
    // Base URL of the Portal backend, without the trailing /api.
    'api_url' => rtrim(env('PORTAL_API_URL', 'http://127.0.0.1:3000'), '/'),

    // Base URL of the Portal web app (redirect target after logout / session expiry).
    'web_url' => rtrim(env('PORTAL_WEB_URL', 'http://127.0.0.1:3002'), '/'),

    // UUID of the PM-App row in Portal's `aplikasi` table.
    'app_id' => env('PORTAL_APP_ID'),

    // Shared secret for Portal's internal endpoints (header `x-internal`).
    'internal_token' => env('PORTAL_INTERNAL_TOKEN'),

    'timeout' => (int) env('PORTAL_HTTP_TIMEOUT', 10),

    // Keep TLS verification on; only disable for local self-signed setups.
    'verify_tls' => (bool) env('PORTAL_VERIFY_TLS', true),
];
