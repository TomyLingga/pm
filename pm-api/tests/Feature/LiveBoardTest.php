<?php

namespace Tests\Feature;

use Database\Seeders\OfficeSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\PmFixtures;
use Tests\TestCase;

/** `GET /dashboard/live`: what needs attention now, scoped by role, never cached. */
class LiveBoardTest extends TestCase
{
    use PmFixtures;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpPm(); // Mon 5 Oct 2026 07:00
        $this->seed(OfficeSeeder::class);
        Notification::fake();
        $this->requester->update(['superior_id' => $this->superior->id]);
    }

    public function test_lead_sees_waiting_work_requests_and_pm_of_the_unit(): void
    {
        $submitted = $this->createWorkOrder(['request_description' => 'Printer macet']);
        $received = $this->createWorkOrder(['request_description' => 'LAN putus', 'priority' => 'low']);
        $this->action($this->itLead, $received['id'], 'receive', ['assignee_ids' => [$this->tech1->id], 'lead_id' => $this->tech1->id])->assertOk();
        $picked = $this->createWorkOrder(['request_description' => 'Sudah diambil']);
        $this->action($this->tech1, $picked['id'], 'pick')->assertOk();
        $this->createWorkOrder(['executor_unit_id' => $this->mtc->id, 'service_category_id' => $this->mtcCategory->id, 'request_description' => 'Pompa']);

        $draft = $this->actingAsUser($this->requester)->postJson('/api/v1/service-requests', [
            'executor_unit_id' => $this->it->id, 'service_category_id' => $this->hardware->id,
            'office_id' => \App\Models\Office::query()->value('id'), 'purpose' => 'Laptop', 'priority' => 'high',
        ])->assertCreated()->json('data');
        $this->actingAsUser($this->requester)->postJson("/api/v1/service-requests/{$draft['id']}/submit")->assertOk();

        // Daily PM: today's task is due; tomorrow's and the day after are upcoming (within 48 h).
        $schedule = $this->createSchedule(['frequency_type' => 'daily', 'start_at' => '2026-10-05T08:00:00+07:00', 'equipment_ids' => [$this->equipment->id]]);
        $this->checkOverdueAt('2026-10-05 08:30');

        $d = $this->actingAsUser($this->itLead)->getJson('/api/v1/dashboard/live')->assertOk()
            ->json('data');

        $this->assertSame('unit', $d['scope']);
        $this->assertSame(['total' => 2, 'submitted' => 1], ['total' => $d['work_orders']['total'], 'submitted' => $d['work_orders']['submitted']]);
        $this->assertSame([$submitted['id'], $received['id']], array_column($d['work_orders']['items'], 'id'), 'high priority first, picked WO excluded');
        $this->assertSame(1, $d['requests']['total']);
        $this->assertSame('waiting_superior', $d['requests']['items'][0]['status']);
        $this->assertSame(['overdue' => 0, 'due' => 1, 'in_progress' => 0, 'upcoming' => 2], array_intersect_key($d['pm'], array_flip(['overdue', 'due', 'in_progress', 'upcoming'])));
        $this->assertSame(['due', 'scheduled', 'scheduled'], array_column($d['pm']['items'], 'status'));
        $this->assertSame($this->tasksOf($schedule['id'])->first()->id, $d['pm']['items'][0]['id']);

        // Technician: own PM tasks + own WOs only; requester: nothing from the unit's queue
        $mine = $this->actingAsUser($this->tech1)->getJson('/api/v1/dashboard/live')->assertOk()->json('data');
        $this->assertSame('mine', $mine['scope']);
        $this->assertSame([$received['id']], array_column($mine['work_orders']['items'], 'id'), 'assigned but not started; the picked one is in progress');
        $this->assertSame(3, count($mine['pm']['items']), 'PIC of the schedule');
        $this->actingAsUser($this->tech1)->getJson('/api/v1/dashboard/live?scope=all')->assertForbidden();

        $admin = \App\Models\User::factory()->create();
        $admin->assignRole(\App\Models\User::ROLE_ADMIN);
        $all = $this->actingAsUser($admin)->getJson('/api/v1/dashboard/live?scope=all')->assertOk()->json('data');
        $this->assertSame(3, $all['work_orders']['total'], 'MTC WO included for admin');
    }
}
