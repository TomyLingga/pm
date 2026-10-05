<?php

namespace App\Notifications;

use App\Notifications\Channels\ExpoPushChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

/**
 * In-app (database) + Expo push notification about a Work Order event.
 * `alarm` events use the Android "alarm" channel of the mobile app.
 */
class WorkOrderNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public string $event,
        public int $workOrderId,
        public string $title,
        public string $body,
        public bool $alarm = false,
    ) {
    }

    public function via($notifiable): array
    {
        return ['database', ExpoPushChannel::class];
    }

    public function toArray($notifiable): array
    {
        return [
            'event' => $this->event,
            'title' => $this->title,
            'body' => $this->body,
            'work_order_id' => $this->workOrderId,
            'service_request_id' => null,
            'document_type' => 'work_order',
            'document_id' => $this->workOrderId,
            'alarm' => $this->alarm,
        ];
    }

    public function toExpoPush($notifiable): array
    {
        return [
            'title' => $this->title,
            'body' => $this->body,
            'data' => [
                'event' => $this->event,
                'document_type' => 'work_order',
                'document_id' => $this->workOrderId,
                'work_order_id' => $this->workOrderId,
            ],
            'channelId' => $this->alarm ? 'alarm' : 'default',
            'priority' => 'high',
            'sound' => 'default',
        ];
    }
}
