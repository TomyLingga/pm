<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\PushSubscription;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Http\Response;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Validation\Rule;

class NotificationController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $page = $request->user()->notifications()
            ->when($request->boolean('unread'), fn ($q) => $q->whereNull('read_at'))
            ->paginate(min((int) ($request->query('per_page') ?: 20), 50));

        $page->getCollection()->transform(function (DatabaseNotification $n) {
            $workOrderId = $n->data['work_order_id'] ?? null;
            $requestId = $n->data['service_request_id'] ?? null;

            return [
                'id' => $n->id,
                'event' => $n->data['event'] ?? null,
                'title' => $n->data['title'] ?? '',
                'body' => $n->data['body'] ?? '',
                'document_type' => $n->data['document_type'] ?? ($workOrderId ? 'work_order' : null),
                'document_id' => $n->data['document_id'] ?? $workOrderId,
                'work_order_id' => $workOrderId,
                'service_request_id' => $requestId,
                'pm_task_id' => $n->data['pm_task_id'] ?? null,
                'alarm' => (bool) ($n->data['alarm'] ?? false),
                'read_at' => $n->read_at?->toIso8601String(),
                'created_at' => $n->created_at?->toIso8601String(),
            ];
        });

        return JsonResource::collection($page);
    }

    public function unreadCount(Request $request): JsonResponse
    {
        return response()->json(['data' => ['count' => $request->user()->unreadNotifications()->count()]]);
    }

    public function read(Request $request, string $id): Response
    {
        $request->user()->notifications()->whereKey($id)->firstOrFail()->markAsRead();

        return response()->noContent();
    }

    public function readAll(Request $request): Response
    {
        $request->user()->unreadNotifications()->update(['read_at' => now()]);

        return response()->noContent();
    }

    public function preferences(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->preferencePayload($request->user())]);
    }

    public function updatePreferences(Request $request): JsonResponse
    {
        $data = $request->validate(['email' => ['required', 'boolean']]);
        $request->user()->forceFill(['email_notifications' => $data['email']])->save();

        return response()->json(['data' => $this->preferencePayload($request->user()->fresh())]);
    }

    private function preferencePayload($user): array
    {
        return [
            'email' => (bool) ($user->email_notifications ?? true),
            'email_available' => (bool) config('pm.notifications.mail') && filled($user->email),
        ];
    }

    public function subscribe(Request $request): JsonResponse
    {
        $data = $request->validate([
            'channel' => ['required', Rule::in([PushSubscription::CHANNEL_EXPO])],
            'token' => ['required', 'string', 'max:500'],
            'device_name' => ['nullable', 'string', 'max:150'],
        ]);
        $accessToken = $request->user()->currentAccessToken();

        $subscription = PushSubscription::query()->updateOrCreate(
            ['channel' => $data['channel'], 'token' => $data['token']],
            [
                'user_id' => $request->user()->id,
                'device_name' => $data['device_name'] ?? null,
                'personal_access_token_id' => $accessToken->id ?? null,
                'last_used_at' => now(),
            ]
        );

        return response()->json(['data' => ['id' => $subscription->id]], 201);
    }

    public function unsubscribe(Request $request): Response
    {
        $data = $request->validate(['token' => ['required', 'string', 'max:500']]);
        $request->user()->pushSubscriptions()->where('token', $data['token'])->delete();

        return response()->noContent();
    }
}
