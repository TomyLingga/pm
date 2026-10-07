<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

/**
 * Sanctum only treats a request as "from the SPA" (session cookie honoured) when its Referer/Origin host is in
 * SANCTUM_STATEFUL_DOMAINS. A PDF or attachment opened from a pasted URL, a bookmark, or a link with `noreferrer`
 * carries the session cookie but no Referer and would answer "Unauthenticated". For read-only requests that carry
 * the session cookie we fill the Referer with the web URL so EnsureFrontendRequestsAreStateful accepts them.
 * CSRF is not a concern here: GET/HEAD never change state.
 */
class StatefulWithoutReferer
{
    public function handle(Request $request, Closure $next)
    {
        if ($request->isMethodSafe()
            && ! $request->headers->has('referer')
            && ! $request->headers->has('origin')
            && $request->cookies->has(config('session.cookie'))) {
            $request->headers->set('referer', config('pm.web_url'));
        }

        return $next($request);
    }
}
