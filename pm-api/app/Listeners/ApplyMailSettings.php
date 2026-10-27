<?php

namespace App\Listeners;

use App\Services\Settings\MailSettingsService;
use Illuminate\Notifications\Events\NotificationSending;

/** Applies the admin's SMTP settings right before an e-mail notification goes out (also inside the queue worker). */
class ApplyMailSettings
{
    public function __construct(private MailSettingsService $settings)
    {
    }

    public function handle(NotificationSending $event): void
    {
        if ($event->channel === 'mail') {
            $this->settings->apply();
        }
    }
}
