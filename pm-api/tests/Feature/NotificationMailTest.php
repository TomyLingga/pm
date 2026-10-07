<?php

namespace Tests\Feature;

use App\Notifications\DocumentNotification;
use App\Notifications\WorkOrderNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\ServiceRequestFixtures;
use Tests\TestCase;

/** Optional e-mail channel (PRD §7) and the per-user preference. */
class NotificationMailTest extends TestCase
{
    use RefreshDatabase;
    use ServiceRequestFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpServiceRequests();
        Notification::fake();
    }

    private function channelsFor($user, string $class): array
    {
        $sent = Notification::sent($user, $class);
        $this->assertCount(1, $sent, 'exactly one notification expected');
        $notification = $sent->first();

        return $notification->via($user);
    }

    public function test_mail_is_off_by_default(): void
    {
        $this->createWorkOrder();

        $this->assertSame(['database', \App\Notifications\Channels\ExpoPushChannel::class], $this->channelsFor($this->tech1, WorkOrderNotification::class));
        $this->actingAsUser($this->tech1)->getJson('/api/v1/notifications/preferences')->assertOk()
            ->assertJsonPath('data.email', true)->assertJsonPath('data.email_available', false);
    }

    public function test_mail_channel_follows_the_server_switch_and_the_user_preference(): void
    {
        config(['pm.notifications.mail' => true]);
        $this->tech2->update(['email_notifications' => false]);
        $this->itLead->update(['email' => null]);

        $wo = $this->createWorkOrder();

        $this->assertContains('mail', $this->channelsFor($this->tech1, WorkOrderNotification::class));
        $this->assertNotContains('mail', $this->channelsFor($this->tech2, WorkOrderNotification::class), 'opted out');
        $this->assertNotContains('mail', $this->channelsFor($this->itLead, WorkOrderNotification::class), 'no e-mail address');

        $mail = Notification::sent($this->tech1, WorkOrderNotification::class)->first()->toMail($this->tech1);
        $this->assertSame('[PrevenTech] WO PRIORITAS TINGGI: '.$wo['wo_number'], $mail->subject);
        $this->assertSame('Halo '.$this->tech1->name.',', $mail->greeting);
        $this->assertSame('Buka di PrevenTech', $mail->actionText);
        $this->assertSame("http://pm.test/work-orders/{$wo['id']}", $mail->actionUrl);
        $this->assertStringContainsString('Scanner sering gagal', $mail->introLines[0]);
        $this->assertSame('Salam,'.PHP_EOL.'PrevenTech', $mail->salutation);

        // Form Request notifications link to the request page
        $sr = $this->submittedRequest();
        $mail = Notification::sent($this->superior, DocumentNotification::class)->first()->toMail($this->superior);
        $this->assertSame("http://pm.test/requests/{$sr['id']}", $mail->actionUrl);
        $this->assertStringContainsString('menunggu persetujuan Anda', $mail->subject);
    }

    public function test_user_can_change_the_preference(): void
    {
        config(['pm.notifications.mail' => true]);

        $this->actingAsUser($this->tech1)->putJson('/api/v1/notifications/preferences', ['email' => 'maybe'])
            ->assertStatus(422)->assertJsonValidationErrors('email');
        $this->actingAsUser($this->tech1)->putJson('/api/v1/notifications/preferences', ['email' => false])
            ->assertOk()->assertJsonPath('data.email', false)->assertJsonPath('data.email_available', true);
        $this->assertFalse($this->tech1->fresh()->email_notifications);

        $this->createWorkOrder();
        $this->assertNotContains('mail', $this->channelsFor($this->tech1, WorkOrderNotification::class));
    }
}
