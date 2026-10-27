<?php

namespace App\Notifications;

use App\Models\User;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** Test e-mail from Pengaturan > Email Notifikasi; sent right away (not queued) so SMTP errors reach the admin. */
class MailSettingsTestNotification extends Notification
{
    public function __construct(private User $sentBy)
    {
    }

    public function via($notifiable): array
    {
        return ['mail'];
    }

    public function toMail($notifiable): MailMessage
    {
        return (new MailMessage())
            ->subject('['.config('app.name').'] Email uji notifikasi')
            ->greeting('Halo,')
            ->line('Ini email uji dari Pengaturan > Email Notifikasi, dikirim oleh '.$this->sentBy->name.'.')
            ->line('Bila email ini sampai, pengaturan SMTP '.config('app.name').' sudah benar.')
            ->salutation('Salam,'.PHP_EOL.config('app.name'));
    }
}
