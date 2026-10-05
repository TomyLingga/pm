<?php

namespace App\Notifications\Channels;

use App\Models\PushSubscription;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Sends notifications to the Android app through the Expo Push API.
 */
class ExpoPushChannel
{
    public function send($notifiable, Notification $notification): void
    {
        if (! method_exists($notification, 'toExpoPush') || ! method_exists($notifiable, 'pushSubscriptions')) {
            return;
        }

        $tokens = $notifiable->pushSubscriptions()->where('channel', PushSubscription::CHANNEL_EXPO)->pluck('token')->all();
        if (! $tokens) {
            return;
        }

        $payload = $notification->toExpoPush($notifiable);
        $messages = array_map(fn (string $token) => ['to' => $token] + $payload, $tokens);

        $request = Http::acceptJson()->timeout(10);
        if ($accessToken = config('pm.push.expo_access_token')) {
            $request = $request->withToken($accessToken);
        }

        try {
            $response = $request->post(config('pm.push.expo_url'), $messages);
        } catch (Throwable $e) {
            Log::warning('Expo push failed', ['error' => $e->getMessage()]);

            return;
        }

        // Forget devices that uninstalled the app or revoked permission.
        foreach ((array) $response->json('data', []) as $i => $ticket) {
            if (($ticket['details']['error'] ?? null) === 'DeviceNotRegistered' && isset($tokens[$i])) {
                PushSubscription::query()->where('channel', PushSubscription::CHANNEL_EXPO)->where('token', $tokens[$i])->delete();
            }
        }
    }
}
