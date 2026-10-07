<?php

namespace App\Notifications\Concerns;

use App\Models\PmTask;
use App\Models\ServiceRequest;
use App\Models\WorkOrder;
use Illuminate\Notifications\Messages\MailMessage;

/**
 * Optional e-mail channel for document notifications (PRD §7). Off by default (Q-26: push + alarm);
 * enabled with PM_MAIL_NOTIFICATIONS=true and honouring the user's `email_notifications` preference.
 *
 * Expects the using class to expose public `$title`, `$body` and `documentUrl()`.
 */
trait NotifiesByMail
{
    /** @return string[] `['mail']` when the e-mail channel applies to this recipient */
    protected function mailChannels($notifiable): array
    {
        $wanted = config('pm.notifications.mail')
            && filled($notifiable->email ?? null)
            && ($notifiable->email_notifications ?? true);

        return $wanted ? ['mail'] : [];
    }

    public function toMail($notifiable): MailMessage
    {
        return (new MailMessage())
            ->subject('['.config('app.name').'] '.$this->title)
            ->greeting('Halo '.($notifiable->name ?? '').',')
            ->line($this->body)
            ->action('Buka di '.config('app.name'), $this->documentUrl())
            ->line('Notifikasi ini dikirim otomatis oleh '.config('app.name').' PT Industri Nabati Lestari.')
            ->salutation('Salam,'.PHP_EOL.config('app.name'));
    }

    /** Web page of the document this notification is about. */
    protected function documentPath(string $documentType, int $documentId): string
    {
        $segment = match ($documentType) {
            WorkOrder::MORPH_ALIAS => 'work-orders',
            ServiceRequest::MORPH_ALIAS => 'requests',
            PmTask::MORPH_ALIAS => 'pm/tasks',
            default => 'notifications',
        };

        return rtrim(config('pm.web_url'), '/')."/{$segment}/{$documentId}";
    }
}
