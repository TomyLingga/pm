<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\PortalException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\MobileLoginRequest;
use App\Http\Requests\Auth\MobileTotpRequest;
use App\Http\Resources\MeResource;
use App\Models\PushSubscription;
use App\Services\Auth\MobileAuthService;
use App\Services\Auth\PortalUserSync;
use App\Services\Portal\PortalClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Laravel\Sanctum\PersonalAccessToken;

class AuthController extends Controller
{
    /** Web: exchange the one-time Portal SSO token for a session cookie (same pattern as IDAS). */
    public function sso(Request $request, PortalClient $portal, PortalUserSync $sync): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'max:200'],
            'app_id' => ['nullable', 'uuid'],
        ]);

        try {
            $payload = $portal->verifySsoToken($data['token'], $data['app_id'] ?? null);
        } catch (PortalException $e) {
            if (! $e->isClientError()) {
                throw $e;
            }

            return response()->json([
                'message' => 'Token SSO tidak valid atau sudah kedaluwarsa. Buka kembali PrevenTech dari Portal INTES.',
            ], 401);
        }

        $user = $sync->syncFromVerifyPayload($payload);
        $user->forceFill(['last_login_at' => now()])->save();

        Auth::guard('web')->login($user);
        if ($request->hasSession()) {
            $request->session()->regenerate();
        }

        // 200 even for a first login (the resource would otherwise answer 201 for a new model).
        return (new MeResource($user->load('orgUnit')))->response()->setStatusCode(200);
    }

    /** Mobile: credentials are checked by Portal; returns a non-expiring device token. */
    public function mobileLogin(MobileLoginRequest $request, MobileAuthService $auth): JsonResponse
    {
        $result = $auth->login($request->input('login'), $request->input('password'), $request->input('device_name'));

        return $this->mobileResponse($result);
    }

    public function mobileTotp(MobileTotpRequest $request, MobileAuthService $auth): JsonResponse
    {
        $result = $auth->verifyTotp($request->input('totp_token'), $request->input('code'), $request->input('device_name'));

        return $this->mobileResponse($result);
    }

    public function logout(Request $request): Response
    {
        $token = $request->user()->currentAccessToken();

        if ($token instanceof PersonalAccessToken) {
            PushSubscription::query()->where('personal_access_token_id', $token->id)->delete();
            $token->delete();
        } else {
            Auth::guard('web')->logout();
            if ($request->hasSession()) {
                $request->session()->invalidate();
                $request->session()->regenerateToken();
            }
        }

        return response()->noContent();
    }

    public function me(Request $request): MeResource
    {
        return new MeResource($request->user()->load('orgUnit'));
    }

    private function mobileResponse(array $result): JsonResponse
    {
        if (! empty($result['requires_totp'])) {
            return response()->json(['data' => $result]);
        }

        return response()->json(['data' => [
            'token' => $result['token'],
            'user' => new MeResource($result['user']->load('orgUnit')),
        ]]);
    }
}
