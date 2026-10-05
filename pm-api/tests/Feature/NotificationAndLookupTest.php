<?php

namespace Tests\Feature;

use App\Models\PushSubscription;
use App\Models\ServiceCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\Concerns\WorkOrderFixtures;
use Tests\TestCase;

class NotificationAndLookupTest extends TestCase
{
    use RefreshDatabase;
    use WorkOrderFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpOrganization();
    }

    public function test_in_app_notifications_can_be_listed_and_marked_read(): void
    {
        Http::fake();
        $wo = $this->createWorkOrder();

        $this->actingAsUser($this->tech1)->getJson('/api/v1/notifications/unread-count')->assertJsonPath('data.count', 1);
        $list = $this->actingAsUser($this->tech1)->getJson('/api/v1/notifications?unread=1')->assertOk()->json();
        $this->assertSame('work_order.created', $list['data'][0]['event']);
        $this->assertSame($wo['id'], $list['data'][0]['work_order_id']);
        $this->assertTrue($list['data'][0]['alarm']);
        $this->assertStringContainsString('WO PRIORITAS TINGGI', $list['data'][0]['title']);
        $this->assertSame(1, $list['meta']['total']);

        $this->actingAsUser($this->tech1)->postJson("/api/v1/notifications/{$list['data'][0]['id']}/read")->assertNoContent();
        $this->actingAsUser($this->tech1)->getJson('/api/v1/notifications/unread-count')->assertJsonPath('data.count', 0);

        $this->actingAsUser($this->tech2)->postJson('/api/v1/notifications/read-all')->assertNoContent();
        $this->actingAsUser($this->tech2)->getJson('/api/v1/notifications/unread-count')->assertJsonPath('data.count', 0);
        // Cannot read someone else's notification
        $this->actingAsUser($this->outsider)->postJson("/api/v1/notifications/{$list['data'][0]['id']}/read")->assertNotFound();
    }

    public function test_expo_push_uses_alarm_channel_for_urgent_events_and_forgets_dead_devices(): void
    {
        PushSubscription::query()->create(['user_id' => $this->tech1->id, 'channel' => 'expo', 'token' => 'ExponentPushToken[alive]']);
        PushSubscription::query()->create(['user_id' => $this->tech1->id, 'channel' => 'expo', 'token' => 'ExponentPushToken[dead]']);
        Http::fake(['exp.host/*' => Http::response(['data' => [
            ['status' => 'ok', 'id' => 'r1'],
            ['status' => 'error', 'message' => 'not registered', 'details' => ['error' => 'DeviceNotRegistered']],
        ]])]);

        $this->createWorkOrder(['priority' => 'high']);

        Http::assertSent(function (Request $r) {
            $messages = $r->data();

            return str_contains($r->url(), 'exp.host')
                && count($messages) === 2
                && $messages[0]['to'] === 'ExponentPushToken[alive]'
                && $messages[0]['channelId'] === 'alarm'
                && $messages[0]['priority'] === 'high'
                && $messages[0]['data']['event'] === 'work_order.created';
        });
        $this->assertSame(['ExponentPushToken[alive]'], PushSubscription::query()->pluck('token')->all());
    }

    public function test_normal_priority_uses_default_channel(): void
    {
        PushSubscription::query()->create(['user_id' => $this->tech1->id, 'channel' => 'expo', 'token' => 'ExponentPushToken[alive]']);
        Http::fake(['exp.host/*' => Http::response(['data' => [['status' => 'ok']]])]);

        $this->createWorkOrder(['priority' => 'low']);

        Http::assertSent(fn (Request $r) => $r->data()[0]['channelId'] === 'default');
    }

    public function test_push_subscription_is_validated_and_removable(): void
    {
        $this->actingAsUser($this->tech1)->postJson('/api/v1/push-subscriptions', ['channel' => 'sms', 'token' => 'x'])
            ->assertStatus(422)->assertJsonValidationErrors('channel');
        $this->actingAsUser($this->tech1)->postJson('/api/v1/push-subscriptions', ['channel' => 'expo', 'token' => 'ExponentPushToken[a]'])
            ->assertCreated();
        $this->actingAsUser($this->tech1)->deleteJson('/api/v1/push-subscriptions', ['token' => 'ExponentPushToken[a]'])
            ->assertNoContent();
        $this->assertSame(0, PushSubscription::query()->count());
    }

    public function test_lookups_for_the_work_order_form(): void
    {
        ServiceCategory::factory()->create(['executor_unit_id' => $this->it->id, 'name' => 'Hanya Request', 'for_work_order' => false]);
        $this->actingAsUser($this->requester);

        $units = $this->getJson('/api/v1/executor-units?for=work_order')->assertOk()->json('data');
        $it = collect($units)->firstWhere('code', 'IT');
        $this->assertSame('Sistem dan IT', $it['display_name']);
        $this->assertSame(['Hardware', 'Lain-lain'], array_column($it['categories'], 'name'));
        $this->assertTrue($it['categories'][1]['requires_note']);

        $this->getJson('/api/v1/equipment?q=scanner&executor_unit_id='.$this->it->id)->assertOk()
            ->assertJsonPath('data.0.code', 'SCN-01')
            ->assertJsonPath('data.0.location.name', 'Kantor Pengadaan');
        $this->getJson('/api/v1/equipment?q=scanner&executor_unit_id='.$this->mtc->id)->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/locations?q=pengadaan')->assertOk()->assertJsonPath('data.0.code', 'LOC-PGD');
        $this->getJson('/api/v1/materials?q=lan')->assertOk()->assertJsonPath('data.0.unit', 'm');

        $this->getJson('/api/v1/auth/me')->assertOk()
            ->assertJsonPath('data.bagian', 'Keuangan & Pengadaan')
            ->assertJsonPath('data.executor_units', []);
        $this->actingAsUser($this->itLead)->getJson('/api/v1/auth/me')
            ->assertJsonPath('data.executor_units.0.code', 'IT')
            ->assertJsonPath('data.executor_units.0.is_lead', true);
        $this->actingAsUser($this->tech1)->getJson('/api/v1/auth/me')
            ->assertJsonPath('data.executor_units.0.is_lead', false);
    }
}
