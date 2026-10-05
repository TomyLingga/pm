<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

/** API is JSON-only: make errors (401/403/422…) render as JSON even without an Accept header. */
class ForceJsonResponse
{
    public function handle(Request $request, Closure $next)
    {
        $request->headers->set('Accept', 'application/json');

        return $next($request);
    }
}
