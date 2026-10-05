<?php

namespace App\Notifications;

use App\Models\ServiceRequest;
use App\Models\WorkOrder;
use App\Notifications\Channels\ExpoPushChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

/**
 * In-app (database) + Expo push notification about any document (Form Request, approvals, …).
 * `alarm` events use the Android "alarm" channel of the mobile app.
 */
class DocumentNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public string $event,
        public string $documentType,
        public int $documentId,
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
            'alarm' => $this->alarm,
        ] + $this->documentKeys();
    }

    public function toExpoPush($notifiable): array
    {
        return [
            'title' => $this->title,
            'body' => $this->body,
            'data' => ['event' => $this->event] + $this->documentKeys(),
            'channelId' => $this->alarm ? 'alarm' : 'default',
            'priority' => 'high',
            'sound' => 'default',
        ];
    }

    private function documentKeys(): array
    {
        return [
            'document_type' => $this->documentType,
            'document_id' => $this->documentId,
            'work_order_id' => $this->documentType === WorkOrder::MORPH_ALIAS ? $this->documentId : null,
            'service_request_id' => $this->documentType === ServiceRequest::MORPH_ALIAS ? $this->documentId : null,
        ];
    }
}
