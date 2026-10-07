<?php

namespace Tests\Feature\Pm;

use App\Models\Equipment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\ChannelManager;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use PhpOffice\PhpSpreadsheet\IOFactory;
use Tests\Concerns\PmFixtures;
use Tests\TestCase;

/** Calendar feed, task list / summary / export, maintenance history per equipment, equipment master. */
class PmCalendarHistoryAndEquipmentTest extends TestCase
{
    use PmFixtures;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpPm();
    }

    public function test_calendar_shows_tasks_and_projections_beyond_the_horizon(): void
    {
        $schedule = $this->createSchedule(); // generated up to 4 Dec 07:00
        $get = fn (string $query, ?User $as = null) => $this->actingAsUser($as ?? $this->tech2)->getJson('/api/v1/pm-tasks/calendar?'.$query);

        $events = $get('start=2026-11-23&end=2026-12-20')->assertOk()->json('data');

        $real = array_values(array_filter($events, fn ($e) => ! $e['projected']));
        $projected = array_values(array_filter($events, fn ($e) => $e['projected']));
        // Mondays 23 and 30 Nov exist as tasks; 7 and 14 Dec are beyond the horizon → projections
        $this->assertCount(4, $real);
        $this->assertCount(4, $projected);
        $this->assertSame(['2026-11-23T08:00:00+07:00', '2026-11-30T08:00:00+07:00'], array_values(array_unique(array_column($real, 'due_at'))));
        $this->assertSame(['2026-12-07T08:00:00+07:00', '2026-12-14T08:00:00+07:00'], array_values(array_unique(array_column($projected, 'due_at'))));
        $this->assertSame('scheduled', $real[0]['status']);
        $this->assertSame("t-{$real[0]['task_id']}", $real[0]['key']);
        $this->assertSame('PM Mingguan Server Room', $real[0]['schedule_name']);
        $this->assertSame($this->tech1->id, $real[0]['pic']['id']);
        $this->assertSame(
            ['key' => "p-{$schedule['id']}-{$this->equipment->id}-2026-12-07T08:00", 'task_id' => null, 'status' => 'projected', 'status_label' => 'PROYEKSI'],
            array_intersect_key($projected[0], array_flip(['key', 'task_id', 'status', 'status_label']))
        );
        $this->assertCount(count($events), array_unique(array_column($events, 'key')), 'keys are unique');

        // Filters and scopes
        $this->assertCount(4, $get('start=2026-11-23&end=2026-12-20&equipment_id='.$this->equipment2->id)->json('data'));
        $this->assertCount(0, $get('start=2026-11-23&end=2026-12-20&pic_user_id='.$this->tech2->id)->json('data'));
        $this->assertCount(0, $get('start=2026-11-23&end=2026-12-20&scope=mine')->json('data'), 'tech2 is not the PIC');
        $this->assertCount(8, $get('start=2026-11-23&end=2026-12-20&scope=mine', $this->tech1)->json('data'));
        $this->assertCount(0, $get('start=2026-11-23&end=2026-12-20', $this->mtcTech)->json('data'), 'other units see nothing');

        // Once the nightly run reaches 7 Dec, the projection becomes a real task
        $this->travelTo($this->wib('2026-10-12 00:05'));
        $this->artisan('pm:generate-tasks');
        $events = $get('start=2026-12-07&end=2026-12-07')->json('data');
        $this->assertSame([false, false], array_column($events, 'projected'));

        // Guard rails
        $get('start=2026-01-01&end=2026-06-30')->assertStatus(422)->assertJsonValidationErrors('end');
        $get('start=2026-12-10&end=2026-12-01')->assertStatus(422)->assertJsonValidationErrors('end');
        $get('start=2026-11-23&end=2026-12-20&scope=all')->assertForbidden();
    }

    public function test_task_list_scopes_summary_and_export(): void
    {
        $schedule = $this->createSchedule();
        $this->checkOverdueAt('2026-10-10 09:00');
        [$first, $second] = $this->tasksOf($schedule['id'])->take(2)->all();
        $this->pmAction($this->tech1, $first->id, 'start')->assertOk();
        $ids = fn (string $query, User $as) => array_column(
            $this->actingAsUser($as)->getJson('/api/v1/pm-tasks?'.$query)->assertOk()->json('data'), 'id'
        );

        $this->assertSame([$first->id, $second->id], $ids('scope=mine&status=due,in_progress', $this->tech1));
        $this->assertSame([], $ids('scope=mine', $this->tech2));
        $this->assertCount(16, $ids('scope=unit&per_page=50', $this->tech2));
        $this->assertSame([], $ids('scope=unit', $this->mtcTech));
        $this->assertSame([$second->id], $ids('scope=unit&status=due&q=ups', $this->tech2));
        $this->assertCount(8, $ids('scope=unit&equipment_id='.$this->equipment->id.'&q=server', $this->tech2));
        $this->assertCount(4, $ids('scope=unit&due_from=2026-10-19&due_to=2026-10-26', $this->tech2));
        $this->assertSame($first->id, $ids('scope=unit&sort=due_at', $this->tech2)[0]);
        $this->assertNotSame($first->id, $ids('scope=unit&sort=-due_at', $this->tech2)[0]);
        $this->actingAsUser($this->tech1)->getJson('/api/v1/pm-tasks?scope=all')->assertForbidden();

        $this->actingAsUser($this->tech1)->getJson('/api/v1/pm-tasks?scope=mine&per_page=1')
            ->assertJsonPath('meta.total', 16)
            ->assertJsonStructure(['data' => [[
                'id', 'number', 'status', 'status_label', 'due_at', 'due_window_at', 'overdue_at', 'is_late',
                'schedule' => ['id', 'name', 'frequency_label'], 'equipment' => ['id', 'code', 'name', 'location_name'],
                'executor_unit' => ['id', 'code', 'display_name'], 'pic' => ['id', 'name'], 'has_skip_proposal', 'findings_count',
            ]], 'links', 'meta']);

        // Badge counts
        $this->actingAsUser($this->tech1)->getJson('/api/v1/pm-tasks/summary')->assertOk()
            ->assertJsonPath('data.mine', ['due' => 1, 'overdue' => 0, 'in_progress' => 1])
            ->assertJsonPath('data.unit', ['due' => 1, 'overdue' => 0, 'in_progress' => 1]);
        $this->actingAsUser($this->tech2)->getJson('/api/v1/pm-tasks/summary')
            ->assertJsonPath('data.mine', ['due' => 0, 'overdue' => 0, 'in_progress' => 0])
            ->assertJsonPath('data.unit.due', 1);

        // Excel
        $response = $this->actingAsUser($this->tech1)->get('/api/v1/pm-tasks/export?scope=mine&status=due,in_progress')->assertOk();
        $this->assertStringContainsString('tugas-pm-', $response->headers->get('Content-Disposition'));
        $sheet = IOFactory::load($response->getFile()->getPathname())->getActiveSheet()->toArray();
        $this->assertSame(['No. Tugas', 'Jadwal', 'Frekuensi', 'No. Alat'], array_slice($sheet[0], 0, 4));
        $this->assertCount(3, $sheet);
        $this->assertSame([$first->number, 'PM Mingguan Server Room', 'Mingguan', 'SCN-01'], array_slice($sheet[1], 0, 4));
        $this->assertSame('DIKERJAKAN', $sheet[1][10]);
        $this->assertSame('Tomy Lingga', $sheet[2][7]);
    }

    public function test_maintenance_history_per_equipment_merges_pm_and_work_orders(): void
    {
        // A corrective Work Order on the scanner in September
        $this->travelTo($this->wib('2026-09-20 10:00'));
        $workOrder = $this->createWorkOrder(['request_description' => 'Scanner macet kertas']);

        // A PM on the same scanner in October, with a finding that raises a second Work Order
        $this->travelTo($this->wib('2026-10-05 07:00'));
        $schedule = $this->createSchedule(['equipment_ids' => [$this->equipment->id]]);
        $this->checkOverdueAt('2026-10-12 09:00');
        [$task, $nextWeek] = $this->tasksOf($schedule['id'])->take(2)->all();
        $items = $this->pmAction($this->tech1, $task->id, 'start')->json('data.items');
        $this->pmAction($this->tech1, $task->id, 'items', ['items' => [['id' => $items[0]['id'], 'result' => 'not_ok']]], 'putJson')->assertOk();
        $this->travelTo($this->wib('2026-10-12 09:10'));
        $this->pmAction($this->tech1, $task->id, "items/{$items[0]['id']}/work-order", ['service_category_id' => $this->hardware->id, 'priority' => 'medium'])
            ->assertCreated();
        $this->travelTo($this->wib('2026-10-12 09:20'));
        $this->pmAction($this->itLead, $nextWeek->id, 'skip', ['reason' => 'Libur nasional'])->assertOk();

        $history = $this->actingAsUser($this->tech2)->getJson("/api/v1/equipment/{$this->equipment->id}/history")
            ->assertOk()->assertJsonPath('meta.total', 4)->json('data');

        $this->assertSame(['pm_task', 'work_order', 'pm_task', 'work_order'], array_column($history, 'type'), 'newest first');
        $this->assertSame([
            'type' => 'pm_task', 'id' => $nextWeek->id, 'number' => $nextWeek->number, 'status' => 'skipped', 'status_label' => 'DILEWATI',
            'title' => 'PM Mingguan Server Room', 'actor_name' => 'Oka Aritonang', 'findings_count' => 0, 'is_late' => false,
        ], array_diff_key($history[0], ['date' => 1]));
        $this->assertSame('WO/IT/X/2026/0002', $history[1]['number'], 'second WO of the year (the corrective one was 0001)');
        $this->assertStringStartsWith('Temuan PM', $history[1]['title']);
        $this->assertSame(['in_progress', 1], [$history[2]['status'], $history[2]['findings_count']]);
        $this->assertSame([$workOrder['wo_number'], 'Scanner macet kertas', null], [$history[3]['number'], $history[3]['title'], $history[3]['findings_count']]);
        $this->assertSame('2026-09-20T10:00:00+07:00', $history[3]['date']);

        // Other equipment has its own (empty) log; only executor staff may read histories
        $this->actingAsUser($this->tech2)->getJson("/api/v1/equipment/{$this->equipment2->id}/history")->assertJsonPath('meta.total', 0);
        $this->actingAsUser($this->mtcTech)->getJson("/api/v1/equipment/{$this->equipment->id}/history")->assertOk();
        $this->actingAsUser($this->requester)->getJson("/api/v1/equipment/{$this->equipment->id}/history")->assertForbidden();

        // Equipment detail with stats
        $this->actingAsUser($this->tech2)->getJson("/api/v1/equipment/{$this->equipment->id}")->assertOk()
            ->assertJsonPath('data.code', 'SCN-01')
            ->assertJsonPath('data.stats.open_work_orders', 2)
            ->assertJsonPath('data.stats.active_schedules', 1)
            ->assertJsonPath('data.stats.next_pm_due_at', '2026-10-26T08:00:00+07:00')
            ->assertJsonPath('data.stats.last_pm_completed_at', null)
            ->assertJsonPath('data.permissions.can_update', false);
    }

    public function test_equipment_master_is_managed_by_leads(): void
    {
        $body = ['code' => 'SRV-09', 'name' => 'Server Database', 'location_id' => $this->location->id, 'executor_unit_id' => $this->it->id, 'brand' => 'Dell'];

        $this->actingAsUser($this->tech1)->postJson('/api/v1/equipment', $body)->assertForbidden();
        $this->actingAsUser($this->requester)->postJson('/api/v1/equipment', $body)->assertForbidden();
        $this->actingAsUser($this->itLead)->postJson('/api/v1/equipment', ['executor_unit_id' => $this->mtc->id] + $body)->assertForbidden();

        $created = $this->actingAsUser($this->itLead)->postJson('/api/v1/equipment', $body)->assertCreated()->json('data');
        $this->assertSame(['SRV-09', 'active', 'Aktif', 'Dell'], [$created['code'], $created['status'], $created['status_label'], $created['brand']]);
        $this->assertSame('Sistem dan IT', $created['executor_unit']['display_name']);
        $this->assertTrue($created['permissions']['can_update']);

        $this->actingAsUser($this->itLead)->postJson('/api/v1/equipment', $body)->assertStatus(422)->assertJsonValidationErrors('code');
        $this->actingAsUser($this->itLead)->putJson("/api/v1/equipment/{$created['id']}", ['name' => 'Server DB Utama', 'status' => 'under_repair'] + $body)
            ->assertOk()->assertJsonPath('data.name', 'Server DB Utama')->assertJsonPath('data.status_label', 'Dalam Perbaikan');
        $this->actingAsUser($this->tech1)->putJson("/api/v1/equipment/{$created['id']}", $body)->assertForbidden();

        // Lookup (max 50, no pagination) keeps working for forms; with ?page it is a paginated list
        $lookup = $this->actingAsUser($this->requester)->getJson('/api/v1/equipment?q=srv')->assertOk()->json();
        $this->assertSame(['SRV-09'], array_column($lookup['data'], 'code'));
        $this->assertArrayNotHasKey('meta', $lookup);
        $this->actingAsUser($this->tech1)->getJson('/api/v1/equipment?page=1&per_page=2&executor_unit_id='.$this->it->id)
            ->assertOk()->assertJsonPath('meta.total', 3)->assertJsonCount(2, 'data');
        $this->actingAsUser($this->tech1)->getJson('/api/v1/equipment?page=1&status=under_repair')->assertJsonPath('meta.total', 1);

        // Delete: blocked while an active PM schedule uses the equipment
        $this->createSchedule(['equipment_ids' => [$created['id']]]);
        $this->actingAsUser($this->itLead)->deleteJson("/api/v1/equipment/{$created['id']}")
            ->assertStatus(409)->assertJsonFragment(['message' => 'Equipment masih dipakai jadwal PM aktif. Keluarkan dari jadwal terlebih dahulu.']);
        $this->actingAsUser($this->tech1)->deleteJson("/api/v1/equipment/{$this->equipment2->id}")->assertForbidden();
        $this->actingAsUser($this->itLead)->deleteJson("/api/v1/equipment/{$this->equipment2->id}")->assertNoContent();
        $this->assertSoftDeleted('equipment', ['id' => $this->equipment2->id]);

        // Quick-add of a location from the equipment form
        $this->actingAsUser($this->tech1)->postJson('/api/v1/locations', ['code' => 'SRV-ROOM', 'name' => 'Ruang Server'])->assertForbidden();
        $this->actingAsUser($this->itLead)->postJson('/api/v1/locations', ['code' => 'SRV-ROOM', 'name' => 'Ruang Server'])
            ->assertCreated()->assertJsonPath('data.name', 'Ruang Server');
        $this->actingAsUser($this->itLead)->postJson('/api/v1/locations', ['code' => 'SRV-ROOM', 'name' => 'Lagi'])
            ->assertStatus(422)->assertJsonValidationErrors('code');
        $this->assertSame(3, Equipment::withTrashed()->count(), 'SCN-01, UPS-02 (soft-deleted) and SRV-09');
    }

    public function test_pm_notifications_carry_the_task_reference(): void
    {
        $schedule = $this->createSchedule(['equipment_ids' => [$this->equipment->id]]);
        $task = $this->tasksOf($schedule['id'])->first();

        // Real (non-faked) notification pipeline: database + push payload shape
        Notification::swap(new ChannelManager($this->app));
        Http::fake();
        $this->checkOverdueAt('2026-10-10 08:00');

        $item = $this->actingAsUser($this->tech1)->getJson('/api/v1/notifications')->assertOk()->json('data.0');
        $this->assertSame('pm_task.upcoming', $item['event']);
        $this->assertSame(['pm_task', $task->id, $task->id, null, true], [
            $item['document_type'], $item['document_id'], $item['pm_task_id'], $item['work_order_id'], $item['alarm'],
        ]);
    }
}
