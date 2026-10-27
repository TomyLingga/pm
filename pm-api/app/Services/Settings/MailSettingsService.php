<?php

namespace App\Services\Settings;

use App\Models\AppSetting;
use App\Models\User;
use App\Notifications\MailSettingsTestNotification;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * SMTP settings of the optional e-mail notification channel, set by admins from Pengaturan > Email Notifikasi.
 *
 * Until an admin saves them the .env values apply (MAIL_* and PM_MAIL_NOTIFICATIONS). The password is stored
 * encrypted with APP_KEY and never leaves the server. The settings are applied right before each e-mail is sent
 * (ApplyMailSettings listener), so a long-running queue worker picks up changes without a restart.
 */
class MailSettingsService
{
    public const ENCRYPTIONS = ['tls', 'ssl'];
    public const SOURCE_ENV = 'env';
    public const SOURCE_DATABASE = 'database';

    private const SMTP_TIMEOUT_SECONDS = 15;

    /**
     * Effective settings with the password decrypted (server side only).
     *
     * @return array{enabled: bool, host: ?string, port: ?int, encryption: ?string, username: ?string, password: ?string,
     *     from_address: ?string, from_name: ?string, source: string}
     */
    public function current(): array
    {
        $stored = AppSetting::value(AppSetting::KEY_MAIL);
        if ($stored === []) {
            $smtp = config('mail.mailers.smtp', []);

            return [
                'enabled' => (bool) config('pm.notifications.mail'),
                'host' => $this->clean($smtp['host'] ?? null),
                'port' => filled($smtp['port'] ?? null) ? (int) $smtp['port'] : null,
                'encryption' => in_array($smtp['encryption'] ?? null, self::ENCRYPTIONS, true) ? $smtp['encryption'] : null,
                'username' => $this->clean($smtp['username'] ?? null),
                'password' => filled($smtp['password'] ?? null) ? (string) $smtp['password'] : null,
                'from_address' => $this->clean(config('mail.from.address')),
                'from_name' => $this->clean(config('mail.from.name')),
                'source' => self::SOURCE_ENV,
            ];
        }

        return [
            'enabled' => (bool) ($stored['enabled'] ?? false),
            'host' => $stored['host'] ?? null,
            'port' => isset($stored['port']) ? (int) $stored['port'] : null,
            'encryption' => $stored['encryption'] ?? null,
            'username' => $stored['username'] ?? null,
            'password' => $this->decrypt($stored['password'] ?? null),
            'from_address' => $stored['from_address'] ?? null,
            'from_name' => $stored['from_name'] ?? null,
            'source' => self::SOURCE_DATABASE,
        ];
    }

    /** Whether notifications go out by e-mail at all (each user can still opt out). */
    public function enabled(): bool
    {
        return $this->current()['enabled'];
    }

    /**
     * Saves the settings. An empty `password` keeps the current one; an empty `username` means no SMTP login
     * (the password is dropped).
     */
    public function update(User $by, array $data): array
    {
        $username = $this->clean($data['username'] ?? null);
        $password = filled($data['password'] ?? null) ? (string) $data['password'] : $this->current()['password'];

        AppSetting::put(AppSetting::KEY_MAIL, [
            'enabled' => (bool) $data['enabled'],
            'host' => $this->clean($data['host'] ?? null),
            'port' => filled($data['port'] ?? null) ? (int) $data['port'] : null,
            'encryption' => $data['encryption'] ?? null,
            'username' => $username,
            'password' => $username !== null && $password !== null ? Crypt::encryptString($password) : null,
            'from_address' => $this->clean($data['from_address'] ?? null),
            'from_name' => $this->clean($data['from_name'] ?? null),
        ], $by);

        return $this->current();
    }

    /** Points the default mailer at the admin's SMTP settings; nothing to do while the .env values apply. */
    public function apply(): void
    {
        $settings = $this->current();
        if ($settings['source'] !== self::SOURCE_DATABASE) {
            return;
        }

        $config = [
            'mail.default' => 'smtp',
            'mail.mailers.smtp.transport' => 'smtp',
            'mail.mailers.smtp.host' => $settings['host'],
            'mail.mailers.smtp.port' => $settings['port'],
            'mail.mailers.smtp.encryption' => $settings['encryption'],
            'mail.mailers.smtp.username' => $settings['username'],
            'mail.mailers.smtp.password' => $settings['password'],
            'mail.mailers.smtp.timeout' => self::SMTP_TIMEOUT_SECONDS,
            'mail.from.address' => $settings['from_address'],
            'mail.from.name' => $settings['from_name'] ?? config('app.name'),
        ];
        $changed = collect($config)->contains(fn ($value, string $key) => config($key) !== $value);
        if ($changed) {
            config($config);
            app('mail.manager')->purge('smtp'); // the resolved mailer keeps the old transport and sender
        }
    }

    /** Sends a test e-mail right away with the saved settings; a failure comes back as a 422 for the admin. */
    public function sendTest(User $by, string $to): void
    {
        $settings = $this->current();
        if (! filled($settings['host']) || ! filled($settings['from_address'])) {
            throw ValidationException::withMessages([
                'smtp' => ['Lengkapi host SMTP dan alamat pengirim lalu simpan sebelum mengirim email uji.'],
            ]);
        }

        try {
            Notification::route('mail', $to)->notifyNow(new MailSettingsTestNotification($by));
        } catch (Throwable $e) {
            throw ValidationException::withMessages([
                'smtp' => ['Email uji gagal dikirim: '.Str::limit(trim($e->getMessage()), 300)],
            ]);
        }
    }

    private function clean($value): ?string
    {
        $value = trim((string) $value);

        return $value === '' ? null : $value;
    }

    private function decrypt(?string $value): ?string
    {
        if (! filled($value)) {
            return null;
        }
        try {
            return Crypt::decryptString($value);
        } catch (DecryptException) {
            return null; // APP_KEY changed: the admin has to enter the password again
        }
    }
}
