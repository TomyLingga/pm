<?php

namespace Tests\Feature\WorkOrders;

use App\Models\StatusLog;
use App\Models\WorkOrder;
use App\Notifications\WorkOrderNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\WorkOrderFixtures;
use Tests\TestCase;

class WorkOrderFlowTest extends TestCase
{
    use RefreshDatabase;
    use WorkOrderFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpOrganization();
        Notification::fake();
        // Wednesday morning, so the 3-working-day acceptance window is predictable.
        $this->travelTo(Carbon::parse('2026-10-07 08:00:00', 'Asia/Jakarta'));
    }

    public function test_full_flow_receive_assign_start_complete_and_accept(): void
    {
        // 1. Requester submits
        $wo = $this->createWorkOrder();
        $this->assertSame('WO/IT/X/2026/0001', $wo['wo_number']);
        $this->assertSame('submitted', $wo['status']);
        $this->assertSame('DIAJUKAN', $wo['status_label']);
        $this->assertSame('SCN-01', $wo['equipment_code']);
        $this->assertSame('Scanner Brother ADS-2200', $wo['equipment_name']);
        $this->assertSame($this->location->id, $wo['location']['id'], 'location defaults to the equipment location');
        $this->assertSame('Pengadaan', $wo['requester_sub_bagian_name']);
        $this->assertSame('Keuangan & Pengadaan', $wo['requester_bagian_name']);
        $this->assertCount(2, $wo['clearances']);
        $this->assertSame(['requested'], array_column($wo['signatures'], 'role_key'));
        $this->assertTrue($wo['permissions']['can_cancel']);

        Notification::assertSentTo([$this->itLead, $this->tech1, $this->tech2], WorkOrderNotification::class,
            fn (WorkOrderNotification $n) => $n->event === 'work_order.created' && $n->alarm === true);
        Notification::assertNotSentTo([$this->mtcTech, $this->requester], WorkOrderNotification::class);

        // 2. Lead receives and assigns tech1 (lead) + tech2
        $wo = $this->action($this->itLead, $wo['id'], 'receive', [
            'assignee_ids' => [$this->tech1->id, $this->tech2->id],
            'lead_id' => $this->tech1->id,
        ])->assertOk()->json('data');
        $this->assertSame('received', $wo['status']);
        $this->assertSame($this->itLead->id, $wo['received_by']['id']);
        $this->assertEqualsCanonicalizing([$this->tech1->id, $this->tech2->id], array_column($wo['assignees'], 'id'));
        $this->assertTrue(collect($wo['assignees'])->firstWhere('id', $this->tech1->id)['is_lead']);
        Notification::assertSentTo([$this->tech1, $this->tech2], WorkOrderNotification::class,
            fn (WorkOrderNotification $n) => $n->event === 'work_order.assigned');
        Notification::assertSentTo($this->requester, WorkOrderNotification::class,
            fn (WorkOrderNotification $n) => $n->event === 'work_order.received');

        // 3. Assigned technician starts
        $this->travelTo(now()->addMinutes(30));
        $wo = $this->action($this->tech1, $wo['id'], 'start')->assertOk()->json('data');
        $this->assertSame('in_progress', $wo['status']);
        $this->assertSame($this->tech1->id, $wo['picked_by']['id']);
        $this->assertTrue($wo['permissions']['can_complete']);

        // 4. Draft materials & labours, then complete
        $this->action($this->tech1, $wo['id'], 'materials', [
            'materials' => [
                ['material_id' => $this->material->id, 'quantity' => 3],
                ['material_name' => 'Cleaning kit', 'quantity' => 1, 'unit' => 'set'],
            ],
        ], 'putJson')->assertOk()->assertJsonPath('data.materials.0.material_name', 'Kabel LAN')
            ->assertJsonPath('data.materials.0.unit', 'm');

        $wo = $this->action($this->tech1, $wo['id'], 'labours', [
            'labours' => [
                ['user_id' => $this->tech1->id, 'started_at' => '2026-10-07T08:30:00+07:00', 'finished_at' => '2026-10-07T10:00:00+07:00'],
                ['worker_name' => 'Helper Outsourcing', 'started_at' => '2026-10-07T09:00:00+07:00', 'finished_at' => '2026-10-07T09:45:00+07:00'],
            ],
        ], 'putJson')->assertOk()->json('data');
        $this->assertSame('Tomy Lingga', $wo['labours'][0]['worker_name']);
        $this->assertSame(90, $wo['labours'][0]['duration_minutes']);
        $this->assertSame(135, $wo['total_labour_minutes']);

        $this->travelTo(Carbon::parse('2026-10-07 10:05:00', 'Asia/Jakarta'));
        $wo = $this->action($this->tech1, $wo['id'], 'complete', [
            'work_done' => 'Roller dibersihkan, driver diperbarui.',
            'clearance' => [['item_no' => 1, 'result' => 'ok'], ['item_no' => 2, 'result' => 'not_ok']],
            'remarks' => 'Disarankan ganti roller bulan depan.',
        ])->assertOk()->json('data');
        $this->assertSame('completed', $wo['status']);
        $this->assertCount(2, $wo['materials'], 'materials saved earlier are kept when omitted on complete');
        $this->assertSame('not_ok', $wo['clearances'][1]['mtc_result']);
        $this->assertSame($this->tech1->id, $wo['clearances'][0]['mtc_confirmed_by']['id']);
        $this->assertSame(95, $wo['sla_minutes'], 'SLA = picked (08:30) → completed (10:05)');
        // Wednesday 10:05 + 3 working days = Monday 10:05
        $this->assertSame('2026-10-12T10:05:00+07:00', $wo['acceptance_due_at']);
        Notification::assertSentTo($this->requester, WorkOrderNotification::class,
            fn (WorkOrderNotification $n) => $n->event === 'work_order.completed');

        // 5. Requester accepts → closed
        $wo = $this->action($this->requester, $wo['id'], 'accept', $this->acceptPayload())->assertOk()->json('data');
        $this->assertSame('closed', $wo['status']);
        $this->assertSame($this->requester->id, $wo['accepted_by']['id']);
        $this->assertSame(1.5, $wo['total_breakdown_hours']);
        $this->assertNull($wo['acceptance_due_at']);
        $this->assertFalse($wo['auto_accepted']);
        $this->assertSame('ok', $wo['clearances'][0]['user_result']);
        $this->assertEqualsCanonicalizing(['requested', 'received', 'completed', 'accepted'], array_column($wo['signatures'], 'role_key'));
        $this->assertSame(
            ['create', 'receive', 'start', 'update_materials', 'update_labours', 'complete', 'accept'],
            array_column($wo['logs'], 'action')
        );
        $this->assertFalse(in_array(true, $wo['permissions'], true), 'no action is possible on a closed WO');
        Notification::assertSentTo([$this->tech1, $this->tech2], WorkOrderNotification::class,
            fn (WorkOrderNotification $n) => $n->event === 'work_order.closed');
    }

    public function test_acceptance_no_returns_work_to_technician_until_accepted(): void
    {
        $wo = $this->completedWorkOrder();
        $this->assertSame('completed', $wo['status']);

        // Reason is mandatory
        $this->action($this->requester, $wo['id'], 'accept', ['acceptance' => 'no'])
            ->assertStatus(422)->assertJsonValidationErrors('reason');

        $wo = $this->action($this->requester, $wo['id'], 'accept', [
            'acceptance' => 'no',
            'reason' => 'Scanner masih gagal membaca dokumen A3.',
        ])->assertOk()->json('data');

        $this->assertSame('in_progress', $wo['status']);
        $this->assertSame(1, $wo['rework_count']);
        $this->assertNull($wo['acceptance_due_at']);
        $this->assertNull($wo['accepted_by']);
        foreach ($wo['clearances'] as $clearance) {
            $this->assertNull($clearance['mtc_result'], 'checklist must be redone');
            $this->assertNull($clearance['user_result']);
        }
        $this->assertNotContains('completed', array_column($wo['signatures'], 'role_key'), 'old completion signature is revoked');
        $reject = collect($wo['logs'])->firstWhere('action', 'reject');
        $this->assertSame('completed', $reject['from_status']);
        $this->assertSame('in_progress', $reject['to_status']);
        $this->assertSame('Scanner masih gagal membaca dokumen A3.', $reject['notes']);
        $this->assertSame($this->requester->id, $reject['user']['id']);
        $this->assertTrue($wo['permissions']['can_complete'] === false, 'requester cannot complete');

        Notification::assertSentTo($this->tech1, WorkOrderNotification::class,
            fn (WorkOrderNotification $n) => $n->event === 'work_order.rejected' && $n->alarm === true);

        // Technician sees the job again and finishes it a second time
        $this->actingAsUser($this->tech1)->getJson("/api/v1/work-orders/{$wo['id']}")
            ->assertOk()->assertJsonPath('data.permissions.can_complete', true);
        $wo = $this->action($this->tech1, $wo['id'], 'complete', $this->completionPayload(['work_done' => 'Sensor A3 dikalibrasi ulang.']))
            ->assertOk()->json('data');
        $this->assertSame('completed', $wo['status']);
        $this->assertSame('Sensor A3 dikalibrasi ulang.', $wo['work_done']);
        $this->assertContains('completed', array_column($wo['signatures'], 'role_key'));

        $wo = $this->action($this->requester, $wo['id'], 'accept', $this->acceptPayload())->assertOk()->json('data');
        $this->assertSame('closed', $wo['status']);
        $this->assertSame(1, $wo['rework_count']);
        $this->assertSame(
            ['create', 'pick', 'complete', 'reject', 'complete', 'accept'],
            array_column($wo['logs'], 'action')
        );
        $this->assertSame(2, StatusLog::query()->where('action', 'complete')->count());
    }

    public function test_technician_can_pick_from_pool_once(): void
    {
        $wo = $this->createWorkOrder(['priority' => 'medium']);

        $wo = $this->action($this->tech2, $wo['id'], 'pick')->assertOk()->json('data');
        $this->assertSame('in_progress', $wo['status']);
        $this->assertSame($this->tech2->id, $wo['picked_by']['id']);
        $this->assertSame($this->tech2->id, $wo['received_by']['id']);
        $this->assertSame([$this->tech2->id], array_column($wo['assignees'], 'id'));
        $this->assertTrue($wo['assignees'][0]['is_lead']);
        $this->assertNotNull($wo['picked_at']);
        Notification::assertSentTo($this->requester, WorkOrderNotification::class,
            fn (WorkOrderNotification $n) => $n->event === 'work_order.picked');

        // Somebody else can no longer pick it
        $this->action($this->tech1, $wo['id'], 'pick')->assertStatus(409);
    }

    public function test_requester_can_update_and_cancel_only_while_submitted(): void
    {
        $wo = $this->createWorkOrder();

        $this->actingAsUser($this->requester)->putJson("/api/v1/work-orders/{$wo['id']}", $this->workOrderPayload([
            'request_description' => 'Scanner tidak menyala sama sekali.',
            'priority' => 'low',
        ]))->assertOk()->assertJsonPath('data.priority', 'low');

        $this->actingAsUser($this->requester)->putJson("/api/v1/work-orders/{$wo['id']}", $this->workOrderPayload([
            'executor_unit_id' => $this->mtc->id,
            'service_category_id' => $this->mtcCategory->id,
        ]))->assertStatus(422)->assertJsonValidationErrors('executor_unit_id');

        $this->action($this->requester, $wo['id'], 'cancel')->assertStatus(422)->assertJsonValidationErrors('reason');
        $cancelled = $this->action($this->requester, $wo['id'], 'cancel', ['reason' => 'Sudah normal kembali'])->assertOk()->json('data');
        $this->assertSame('cancelled', $cancelled['status']);
        $this->assertSame('Sudah normal kembali', $cancelled['cancel_reason']);

        // A received WO can no longer be cancelled or edited
        $other = $this->createWorkOrder();
        $this->action($this->itLead, $other['id'], 'receive', ['assignee_ids' => [$this->tech1->id], 'lead_id' => $this->tech1->id])->assertOk();
        $this->action($this->requester, $other['id'], 'cancel', ['reason' => 'x'])->assertStatus(409);
        $this->actingAsUser($this->requester)->putJson("/api/v1/work-orders/{$other['id']}", $this->workOrderPayload())->assertStatus(409);
    }

    public function test_lead_can_reassign_technicians(): void
    {
        $wo = $this->createWorkOrder();
        $this->action($this->itLead, $wo['id'], 'receive', ['assignee_ids' => [$this->tech1->id], 'lead_id' => $this->tech1->id])->assertOk();

        $wo = $this->action($this->itLead, $wo['id'], 'assignees', [
            'assignee_ids' => [$this->tech2->id],
            'lead_id' => $this->tech2->id,
        ], 'putJson')->assertOk()->json('data');

        $this->assertSame([$this->tech2->id], array_column($wo['assignees'], 'id'));
        $this->action($this->tech1, $wo['id'], 'start')->assertForbidden();
        $this->action($this->tech2, $wo['id'], 'start')->assertOk();
        Notification::assertSentTo($this->tech2, WorkOrderNotification::class,
            fn (WorkOrderNotification $n) => $n->event === 'work_order.assigned');
    }

    public function test_receive_validates_assignees(): void
    {
        $wo = $this->createWorkOrder();

        $this->action($this->itLead, $wo['id'], 'receive', ['assignee_ids' => [$this->mtcTech->id], 'lead_id' => $this->mtcTech->id])
            ->assertStatus(422)->assertJsonValidationErrors('assignee_ids');
        $this->action($this->itLead, $wo['id'], 'receive', ['assignee_ids' => [$this->tech1->id], 'lead_id' => $this->tech2->id])
            ->assertStatus(422)->assertJsonValidationErrors('lead_id');
        $this->action($this->itLead, $wo['id'], 'receive', ['assignee_ids' => [], 'lead_id' => $this->tech1->id])
            ->assertStatus(422)->assertJsonValidationErrors('assignee_ids');

        $this->assertSame('submitted', WorkOrder::query()->find($wo['id'])->status->value);
    }

    public function test_complete_requires_work_done_labour_and_clearance(): void
    {
        $wo = $this->createWorkOrder();
        $this->action($this->tech1, $wo['id'], 'pick')->assertOk();

        $this->action($this->tech1, $wo['id'], 'complete', [])
            ->assertStatus(422)->assertJsonValidationErrors(['work_done', 'clearance']);

        $this->action($this->tech1, $wo['id'], 'complete', $this->completionPayload(['labours' => []]))
            ->assertStatus(422)->assertJsonValidationErrors('labours');

        $this->action($this->tech1, $wo['id'], 'complete', $this->completionPayload(['labours' => [[
            'worker_name' => 'Tomy', 'started_at' => '2026-10-07T10:00:00+07:00', 'finished_at' => '2026-10-07T09:00:00+07:00',
        ]]]))->assertStatus(422)->assertJsonValidationErrors('labours.0.finished_at');

        $this->action($this->tech1, $wo['id'], 'complete', $this->completionPayload([
            'clearance' => [['item_no' => 1, 'result' => 'ok']],
        ]))->assertStatus(422)->assertJsonValidationErrors('clearance');

        $this->assertSame('in_progress', WorkOrder::query()->find($wo['id'])->status->value);
    }

    public function test_accept_yes_requires_user_clearance(): void
    {
        $wo = $this->completedWorkOrder();

        $this->action($this->requester, $wo['id'], 'accept', ['acceptance' => 'yes'])
            ->assertStatus(422)->assertJsonValidationErrors('clearance');
        $this->action($this->requester, $wo['id'], 'accept', ['acceptance' => 'maybe'])
            ->assertStatus(422)->assertJsonValidationErrors('acceptance');
    }

    public function test_invalid_transitions_return_conflict(): void
    {
        $wo = $this->createWorkOrder();
        $this->action($this->itLead, $wo['id'], 'receive', ['assignee_ids' => [$this->tech1->id], 'lead_id' => $this->tech1->id])->assertOk();

        // Complete before start
        $this->action($this->tech1, $wo['id'], 'complete', $this->completionPayload())
            ->assertStatus(409)->assertJsonFragment(['message' => "WO {$wo['wo_number']} berstatus DITERIMA; aksi ini tidak dapat dilakukan."]);
        // Receive twice
        $this->action($this->itLead, $wo['id'], 'receive', ['assignee_ids' => [$this->tech2->id], 'lead_id' => $this->tech2->id])
            ->assertStatus(409);
        // Accept before completion
        $this->action($this->requester, $wo['id'], 'accept', $this->acceptPayload())->assertStatus(409);
    }

    public function test_category_must_belong_to_executor_and_other_requires_note(): void
    {
        $this->actingAsUser($this->requester)
            ->postJson('/api/v1/work-orders', $this->workOrderPayload(['service_category_id' => $this->mtcCategory->id]))
            ->assertStatus(422)->assertJsonValidationErrors('service_category_id');

        $this->actingAsUser($this->requester)
            ->postJson('/api/v1/work-orders', $this->workOrderPayload(['service_category_id' => $this->otherCategory->id]))
            ->assertStatus(422)->assertJsonValidationErrors('category_note');

        $this->actingAsUser($this->requester)
            ->postJson('/api/v1/work-orders', $this->workOrderPayload(['request_description' => '', 'priority' => 'urgent']))
            ->assertStatus(422)->assertJsonValidationErrors(['request_description', 'priority']);

        $wo = $this->createWorkOrder([
            'service_category_id' => $this->otherCategory->id,
            'category_note' => 'Instalasi CCTV',
            'equipment_id' => null,
            'equipment_code' => 'CCTV-09',
            'equipment_name' => 'Kamera gudang',
            'location_id' => $this->location->id,
        ]);
        $this->assertSame('Instalasi CCTV', $wo['category_note']);
        $this->assertSame('CCTV-09', $wo['equipment_code']);
        $this->assertNull($wo['equipment']);
    }
}
