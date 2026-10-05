<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Laravel\Sanctum\PersonalAccessToken;

/**
 * Mobile tokens never expire, so a user deactivated in Portal (via sync) loses access here.
 */
class EnsureUserIsActive
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        if ($user && ! $user->is_active) {
            $token = $user->currentAccessToken();
            if ($token instanceof PersonalAccessToken) {
                $user->tokens()->delete();
            } else {
                Auth::guard('web')->logout();
            }

            return response()->json(['message' => 'Akun Anda tidak aktif. Hubungi administrator.'], 401);
        }

        return $next($request);
    }
}
