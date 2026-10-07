<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserBriefResource;
use App\Models\AppSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Download links of the mobile app (Android APK / iPhone build), shown on the dashboard.
 * Everyone logged in can read them; admins set them from Pengaturan > Aplikasi Mobile.
 */
class AppDownloadController extends Controller
{
    private const FIELDS = ['android_url', 'ios_url', 'android_version', 'ios_version', 'notes'];

    public function show(Request $request): JsonResponse
    {
        return $this->payload($request);
    }

    public function update(Request $request): JsonResponse
    {
        abort_unless($request->user()->isAdmin(), 403, 'Hanya admin yang dapat mengatur tautan unduhan aplikasi.');

        $data = $request->validate([
            'android_url' => ['nullable', 'url', 'max:500'],
            'ios_url' => ['nullable', 'url', 'max:500'],
            'android_version' => ['nullable', 'string', 'max:50'],
            'ios_version' => ['nullable', 'string', 'max:50'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);
        $value = [];
        foreach (self::FIELDS as $field) {
            $trimmed = trim((string) ($data[$field] ?? ''));
            $value[$field] = $trimmed === '' ? null : $trimmed;
        }
        AppSetting::put(AppSetting::KEY_APP_DOWNLOADS, $value, $request->user());

        return $this->payload($request);
    }

    private function payload(Request $request): JsonResponse
    {
        $setting = AppSetting::query()->with('updatedBy')->find(AppSetting::KEY_APP_DOWNLOADS);
        $value = AppSetting::value(AppSetting::KEY_APP_DOWNLOADS, array_fill_keys(self::FIELDS, null));

        return response()->json([
            'data' => $value + [
                'updated_at' => $setting?->updated_at?->toIso8601String(),
                'updated_by' => $setting?->updatedBy ? new UserBriefResource($setting->updatedBy) : null,
            ],
            'permissions' => ['can_update' => $request->user()->isAdmin()],
        ]);
    }
}
