<?php

namespace Tests\Feature;

use App\Models\AppSetting;
use App\Models\User;
use App\Notifications\MailSettingsTestNotification;
use App\Notifications\WorkOrderNotification;
use App\Services\Settings\MailSettingsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\Events\NotificationSending;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\ServiceRequestFixtures;
use Tests\TestCase;

/** Pengaturan > Email Notifikasi: admin-only SMTP settings of the e-mail channel. */
class MailSettingsTest extends TestCase
{
    use RefreshDatabase;
    use ServiceRequestFixtures;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpServiceRequests();
        $this->admin = User::factory()->create(['name' => 'Admin', 'email' => 'admin@inl.test']);
        $this->admin->assignRole(User::ROLE_ADMIN);
        // What the .env would say
        config([
            'mail.mailers.smtp.host' => 'mailhog', 'mail.mailers.smtp.port' => 1025, 'mail.mailers.smtp.encryption' => null,
            'mail.mailers.smtp.username' => null, 'mail.mailers.smtp.password' => null,
            'mail.from.address' => 'noreply@inl.test', 'mail.from.name' => 'PrevenTech',
        ]);
    }

    private function settings(array $overrides = []): array
    {
        return array_merge([
            'enabled' => true, 'host' => 'smtp.inl.co.id', 'port' => 587, 'encryption' => 'tls',
            'username' => 'notif@inl.co.id', 'password' => 'Rahasia#123',
            'from_address' => 'notif@inl.co.id', 'from_name' => 'PrevenTech INL',
        ], $overrides);
    }

    private function save(array $overrides = [])
    {
        return $this->actingAsUser($this->admin)->putJson('/api/v1/settings/mail', $this->settings($overrides));
    }

    private function mailChannelFor(User $user): bool
    {
        $sent = Notification::sent($user, WorkOrderNotification::class);
        $this->assertCount(1, $sent);

        return in_array('mail', $sent->first()->via($user), true);
    }

    public function test_only_admins_can_see_or_change_the_mail_settings(): void
    {
        $this->actingAsUser($this->tech1)->getJson('/api/v1/settings/mail')->assertForbidden();
        $this->actingAsUser($this->tech1)->putJson('/api/v1/settings/mail', $this->settings())->assertForbidden()
            ->assertJsonPath('message', 'Hanya admin yang dapat mengatur email notifikasi.');
        $this->actingAsUser($this->tech1)->postJson('/api/v1/settings/mail/test', ['to' => 'x@inl.test'])->assertForbidden();

        $this->assertDatabaseMissing('app_settings', ['key' => AppSetting::KEY_MAIL]);
    }

    public function test_the_env_values_apply_until_an_admin_saves(): void
    {
        $this->actingAsUser($this->admin)->getJson('/api/v1/settings/mail')->assertOk()
            ->assertJsonPath('data.source', 'env')->assertJsonPath('data.enabled', false)
            ->assertJsonPath('data.host', 'mailhog')->assertJsonPath('data.port', 1025)
            ->assertJsonPath('data.from_address', 'noreply@inl.test')->assertJsonPath('data.password_set', false)
            ->assertJsonPath('data.updated_by', null);
    }

    public function test_validation(): void
    {
        $this->actingAsUser($this->admin)->putJson('/api/v1/settings/mail', ['enabled' => true])
            ->assertStatus(422)->assertJsonValidationErrors(['host', 'port', 'from_address']);
        $this->save(['host' => 'smtp://smtp.inl.co.id', 'port' => 70000, 'encryption' => 'starttls', 'from_address' => 'bukan email'])
            ->assertStatus(422)->assertJsonValidationErrors(['host', 'port', 'encryption', 'from_address']);

        // Switched off, the server details may stay empty
        $this->actingAsUser($this->admin)->putJson('/api/v1/settings/mail', ['enabled' => false])->assertOk()
            ->assertJsonPath('data.source', 'database')->assertJsonPath('data.enabled', false)->assertJsonPath('data.host', null);
    }

    public function test_admin_saves_the_settings_and_the_password_stays_secret(): void
    {
        $response = $this->save()->assertOk()
            ->assertJsonPath('data.source', 'database')->assertJsonPath('data.enabled', true)
            ->assertJsonPath('data.host', 'smtp.inl.co.id')->assertJsonPath('data.port', 587)->assertJsonPath('data.encryption', 'tls')
            ->assertJsonPath('data.username', 'notif@inl.co.id')->assertJsonPath('data.password_set', true)
            ->assertJsonPath('data.from_name', 'PrevenTech INL')->assertJsonPath('data.updated_by.name', 'Admin');
        $this->assertArrayNotHasKey('password', $response->json('data'));
        $this->assertStringNotContainsString('Rahasia#123', $response->getContent());
        $this->assertStringNotContainsString('Rahasia#123', (string) DB::table('app_settings')->where('key', AppSetting::KEY_MAIL)->value('value'));

        // Saving without a password keeps it …
        $this->save(['password' => null, 'port' => 465, 'encryption' => 'ssl'])->assertOk()
            ->assertJsonPath('data.password_set', true)->assertJsonPath('data.port', 465)->assertJsonPath('data.encryption', 'ssl');
        $this->assertSame('Rahasia#123', app(MailSettingsService::class)->current()['password']);

        // … and an empty username means no SMTP login at all
        $this->save(['username' => '', 'password' => null])->assertOk()
            ->assertJsonPath('data.username', null)->assertJsonPath('data.password_set', false);
    }

    public function test_the_admin_switch_drives_the_mail_channel_and_the_saved_smtp_is_used(): void
    {
        config(['pm.notifications.mail' => true]); // the .env says on …
        $this->save(['enabled' => false])->assertOk();
        Notification::fake();
        $this->createWorkOrder();
        $this->assertFalse($this->mailChannelFor($this->tech1), '… but the admin switched e-mail off');
        $this->actingAsUser($this->tech1)->getJson('/api/v1/notifications/preferences')->assertJsonPath('data.email_available', false);

        $this->save()->assertOk();
        $this->actingAsUser($this->tech1)->getJson('/api/v1/notifications/preferences')->assertJsonPath('data.email_available', true);
        Notification::fake();
        $this->createWorkOrder();
        $this->assertTrue($this->mailChannelFor($this->tech1));

        // Right before an e-mail goes out the saved SMTP settings replace the .env ones, even in a running worker
        $this->assertSame('mailhog', app('mail.manager')->mailer('smtp')->getSwiftMailer()->getTransport()->getHost());
        event(new NotificationSending($this->tech1, new MailSettingsTestNotification($this->admin), 'mail'));
        $this->assertSame('smtp', config('mail.default'));
        $this->assertSame(['address' => 'notif@inl.co.id', 'name' => 'PrevenTech INL'], config('mail.from'));
        $transport = app('mail.manager')->mailer('smtp')->getSwiftMailer()->getTransport();
        $this->assertSame('smtp.inl.co.id', $transport->getHost());
        $this->assertSame(587, $transport->getPort());
        $this->assertSame('tls', $transport->getEncryption());
        $this->assertSame('notif@inl.co.id', $transport->getUsername());
        $this->assertSame('Rahasia#123', $transport->getPassword());
    }

    public function test_admin_sends_a_test_email(): void
    {
        Notification::fake();
        $this->actingAsUser($this->admin)->putJson('/api/v1/settings/mail', ['enabled' => false])->assertOk();
        $this->actingAsUser($this->admin)->postJson('/api/v1/settings/mail/test', ['to' => 'tomy@inl.co.id'])
            ->assertStatus(422)->assertJsonValidationErrors('smtp'); // no host / sender yet

        $this->save(['enabled' => false])->assertOk(); // can be tested before switching it on
        $this->actingAsUser($this->admin)->postJson('/api/v1/settings/mail/test', ['to' => 'bukan email'])
            ->assertStatus(422)->assertJsonValidationErrors('to');
        $this->actingAsUser($this->admin)->postJson('/api/v1/settings/mail/test', ['to' => 'tomy@inl.co.id'])->assertOk()
            ->assertJsonPath('message', 'Email uji dikirim ke tomy@inl.co.id.');

        Notification::assertSentOnDemand(MailSettingsTestNotification::class, function ($notification, $channels, $notifiable) {
            $mail = $notification->toMail($notifiable);

            return $notifiable->routes['mail'] === 'tomy@inl.co.id'
                && $mail->subject === '[PrevenTech] Email uji notifikasi'
                && str_contains($mail->introLines[0], 'dikirim oleh Admin');
        });
    }

    public function test_a_failed_test_email_is_reported_to_the_admin(): void
    {
        // Real SMTP attempt to a closed local port: refused right away
        $this->save(['host' => '127.0.0.1', 'port' => 1, 'encryption' => null, 'username' => null])->assertOk();

        $response = $this->actingAsUser($this->admin)->postJson('/api/v1/settings/mail/test', ['to' => 'tomy@inl.co.id'])
            ->assertStatus(422)->assertJsonValidationErrors('smtp');
        $this->assertStringStartsWith('Email uji gagal dikirim: ', $response->json('errors.smtp.0'));
    }
}
