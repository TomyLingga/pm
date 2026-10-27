<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\UpdateMailSettingsRequest;
use App\Http\Resources\UserBriefResource;
use App\Models\AppSetting;
use App\Services\Settings\MailSettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** SMTP settings of the e-mail notification channel (Pengaturan > Email Notifikasi). Admin only. */
class MailSettingsController extends Controller
{
    public function __construct(private MailSettingsService $settings)
    {
    }

    public function show(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        return $this->payload();
    }

    public function update(UpdateMailSettingsRequest $request): JsonResponse
    {
        $this->settings->update($request->user(), $request->validated());

        return $this->payload();
    }

    public function test(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);
        $data = $request->validate(['to' => ['required', 'email', 'max:255']], [], ['to' => 'alamat tujuan']);

        $this->settings->sendTest($request->user(), $data['to']);

        return response()->json(['message' => "Email uji dikirim ke {$data['to']}."]);
    }

    private function authorizeAdmin(Request $request): void
    {
        abort_unless($request->user()->isAdmin(), 403, 'Hanya admin yang dapat mengatur email notifikasi.');
    }

    private function payload(): JsonResponse
    {
        $current = $this->settings->current();
        $setting = AppSetting::query()->with('updatedBy')->find(AppSetting::KEY_MAIL);

        return response()->json(['data' => [
            'enabled' => $current['enabled'],
            'host' => $current['host'],
            'port' => $current['port'],
            'encryption' => $current['encryption'],
            'username' => $current['username'],
            'password_set' => filled($current['password']),
            'from_address' => $current['from_address'],
            'from_name' => $current['from_name'],
            'source' => $current['source'],
            'updated_at' => $setting?->updated_at?->toIso8601String(),
            'updated_by' => $setting?->updatedBy ? new UserBriefResource($setting->updatedBy) : null,
        ]]);
    }
}
