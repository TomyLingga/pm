<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\OfficeSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\PmFixtures;
use Tests\TestCase;

/**
 * Dashboard aggregates (PRD §8) and the role-based scope: technicians see their work, leads their unit,
 * management everything.
 */
class DashboardTest extends TestCase
{
    use PmFixtures;
    use RefreshDatabase;

    private array $wo = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpPm();
        $this->seed(OfficeSeeder::class);
        Storage::fake('local');
        $this->requester->update(['superior_id' => $this->superior->id]);
        $this->buildActivity();
    }

    /** One week of activity, 1–7 Oct 2026 (clock ends at Wed 7 Oct 12:00). */
    private function buildActivity(): void
    {
        // Daily PM on the scanner since 1 Oct (created 5 Oct → today's task is open)
        $this->travelTo($this->wib('2026-10-05 07:30'));
        $schedule = $this->createSchedule([
            'frequency_type' => 'daily', 'start_at' => '2026-10-01T08:00:00+07:00', 'equipment_ids' => [$this->equipment->id],
        ]);
        $tasks = fn () => $this->tasksOf($schedule['id']);

        // 5 Oct: PM done on time; WO1 raised, picked in 60 min, done in 120 min, accepted with 2.5 h breakdown
        $this->checkOverdueAt('2026-10-05 08:00'); // today's PM task opens at its due time
        $this->wo[1] = $this->createWorkOrder(['request_description' => 'Scanner macet']);
        $items = $this->pmAction($this->tech1, $tasks()->first()->id, 'start')->assertOk()->json('data.items');
        $this->travelTo($this->wib('2026-10-05 08:30'));
        $this->actingAsUser($this->tech1)->postJson("/api/v1/pm-tasks/{$tasks()->first()->id}/attachments", [
            'file' => \Illuminate\Http\UploadedFile::fake()->image('a.jpg'), 'item_id' => $items[3]['id'],
        ])->assertCreated();
        $this->pmAction($this->tech1, $tasks()->first()->id, 'complete', ['items' => [
            ['id' => $items[0]['id'], 'result' => 'ok'], ['id' => $items[1]['id'], 'value_number' => 220], ['id' => $items[3]['id'], 'result' => 'ok'],
        ]])->assertOk();

        $this->travelTo($this->wib('2026-10-05 09:00'));
        $this->action($this->tech1, $this->wo[1]['id'], 'pick')->assertOk();
        $this->travelTo($this->wib('2026-10-05 11:00'));
        $this->action($this->tech1, $this->wo[1]['id'], 'complete', $this->completionPayload())->assertOk();
        $this->travelTo($this->wib('2026-10-05 12:00'));
        $this->action($this->requester, $this->wo[1]['id'], 'accept', $this->acceptPayload(['total_breakdown_hours' => 2.5]))->assertOk();

        // 6 Oct: PM done late (after 24 h tolerance); WO2 assigned to tech2, started after 120 min, still in progress
        $this->checkOverdueAt('2026-10-06 08:00');
        $this->travelTo($this->wib('2026-10-06 08:00'));
        $this->wo[2] = $this->createWorkOrder(['equipment_id' => $this->equipment2->id, 'request_description' => 'UPS bunyi', 'priority' => 'medium']);
        $this->action($this->itLead, $this->wo[2]['id'], 'receive', ['assignee_ids' => [$this->tech2->id], 'lead_id' => $this->tech2->id])->assertOk();
        $this->travelTo($this->wib('2026-10-06 10:00'));
        $this->action($this->tech2, $this->wo[2]['id'], 'start')->assertOk();
        $this->pmAction($this->tech1, $tasks()->get(1)->id, 'start')->assertOk();

        // 7 Oct: late completion of yesterday's PM; today's PM skipped by the lead; WO3 (colleague) + WO4 (MTC) submitted; a Form Request waiting for the superior
        $this->checkOverdueAt('2026-10-07 09:00');
        $items = $this->actingAsUser($this->tech1)->getJson("/api/v1/pm-tasks/{$tasks()->get(1)->id}")->json('data.items');
        $this->actingAsUser($this->tech1)->postJson("/api/v1/pm-tasks/{$tasks()->get(1)->id}/attachments", [
            'file' => \Illuminate\Http\UploadedFile::fake()->image('b.jpg'), 'item_id' => $items[3]['id'],
        ])->assertCreated();
        $this->pmAction($this->tech1, $tasks()->get(1)->id, 'complete', ['items' => [
            ['id' => $items[0]['id'], 'result' => 'ok'], ['id' => $items[1]['id'], 'value_number' => 215], ['id' => $items[3]['id'], 'result' => 'ok'],
        ]])->assertOk()->assertJsonPath('data.is_late', true);
        $this->pmAction($this->itLead, $tasks()->get(2)->id, 'skip', ['reason' => 'Alat dipakai audit'])->assertOk();

        $this->travelTo($this->wib('2026-10-07 10:00'));
        $this->wo[3] = $this->createWorkOrder(['equipment_id' => null, 'request_description' => 'Mouse rusak', 'priority' => 'low'], $this->colleague);
        $this->wo[4] = $this->createWorkOrder([
            'executor_unit_id' => $this->mtc->id, 'service_category_id' => $this->mtcCategory->id, 'equipment_id' => null,
            'request_description' => 'Pompa bocor', 'priority' => 'medium',
        ]);
        $draft = $this->actingAsUser($this->requester)->postJson('/api/v1/service-requests', [
            'executor_unit_id' => $this->it->id, 'service_category_id' => $this->hardware->id,
            'office_id' => \App\Models\Office::query()->value('id'), 'purpose' => 'Laptop baru', 'priority' => 'high',
        ])->assertCreated()->json('data');
        $this->actingAsUser($this->requester)->postJson("/api/v1/service-requests/{$draft['id']}/submit")->assertOk()
            ->assertJsonPath('data.status', 'waiting_superior');

        $this->travelTo($this->wib('2026-10-07 12:00'));
    }

    private function dashboard(User $as, string $query = ''): array
    {
        return $this->actingAsUser($as)->getJson('/api/v1/dashboard?from=2026-10-01&to=2026-10-07'.($query ? '&'.$query : ''))
            ->assertOk()->json('data');
    }

    public function test_lead_sees_the_whole_unit(): void
    {
        $d = $this->dashboard($this->itLead);

        $this->assertSame('unit', $d['scope']);
        $this->assertSame(['mine', 'unit'], $d['available_scopes']);
        $this->assertSame(['from' => '2026-10-01', 'to' => '2026-10-07', 'bucket' => 'week'], $d['period']);

        $this->assertEquals([
            'wo_open' => 2,                     // WO2 in progress, WO3 submitted (WO4 belongs to MTC)
            'wo_created' => 3, 'wo_closed' => 1,
            'wo_awaiting_acceptance' => 0,
            'requests_pending_approval' => 1, 'requests_waiting_me' => 0,
            'pm_due' => 0, 'pm_overdue' => 0, 'pm_in_progress' => 0,
            'pm_compliance_pct' => 33.3,       // 1 on time, 1 late, 1 skipped
            'wo_avg_response_minutes' => 90.0, // (60 + 120) / 2
            'wo_avg_completion_minutes' => 120.0,
            'wo_median_completion_minutes' => 120.0,
            'wo_rework_count' => 0,
        ], $d['kpi']);

        $byStatus = collect($d['wo_by_status'])->pluck('count', 'status')->all();
        $this->assertSame(['submitted' => 1, 'in_progress' => 1, 'closed' => 1, 'cancelled' => 0], array_intersect_key($byStatus, array_flip(['submitted', 'in_progress', 'closed', 'cancelled'])));
        $this->assertSame('DIAJUKAN', $d['wo_by_status'][0]['status_label']);
        $this->assertSame(['high' => 1, 'medium' => 1, 'low' => 1], collect($d['wo_by_priority'])->pluck('count', 'priority')->all());
        $this->assertSame([['id' => $this->hardware->id, 'name' => 'Hardware', 'count' => 3]], $d['wo_by_category']);

        // Week buckets cover 1–7 Oct: W40 (28 Sep–4 Oct) and W41 (5–11 Oct)
        $this->assertSame(['2026-W40', '2026-W41'], array_column($d['wo_trend'], 'period'));
        $this->assertSame(['28 Sep–4 Okt', '5–11 Okt'], array_column($d['wo_trend'], 'label'));
        $this->assertSame([['created' => 0, 'closed' => 0], ['created' => 3, 'closed' => 1]], array_map(fn ($b) => ['created' => $b['created'], 'closed' => $b['closed']], $d['wo_trend']));

        $high = collect($d['wo_sla_by_priority'])->firstWhere('priority', 'high');
        $this->assertEquals(['avg_response_minutes' => 60.0, 'avg_completion_minutes' => 120.0, 'count' => 1], array_intersect_key($high, array_flip(['avg_response_minutes', 'avg_completion_minutes', 'count'])));

        $this->assertSame(1, collect($d['requests_by_status'])->firstWhere('status', 'waiting_superior')['count']);
        $this->assertSame([['key' => 'superior', 'label' => 'Atasan YBS', 'count' => 1]], $d['requests_pending_by_step']);

        $this->assertSame(['on_time' => 1, 'late' => 1, 'skipped' => 1, 'open_overdue' => 0, 'total' => 3, 'pct_on_time' => 33.3], $d['pm_compliance']);
        $this->assertSame([['on_time' => 0, 'late' => 0, 'skipped' => 0], ['on_time' => 1, 'late' => 1, 'skipped' => 1]],
            array_map(fn ($b) => array_intersect_key($b, array_flip(['on_time', 'late', 'skipped'])), $d['pm_trend']));

        $this->assertEquals([['equipment' => ['id' => $this->equipment->id, 'code' => 'SCN-01', 'name' => 'Scanner Brother ADS-2200'], 'hours' => 2.5, 'work_orders' => 1]], $d['equipment_breakdown_hours']);
        $this->assertSame(['SCN-01', 'UPS-02'], array_map(fn ($r) => $r['equipment']['code'], $d['equipment_top_failures']));
        $this->assertSame(1, $d['equipment_top_failures'][0]['work_orders']);

        $workload = collect($d['technician_workload'])->keyBy(fn ($r) => $r['user']['id']);
        $this->assertSame(['wo_active' => 0, 'wo_completed' => 1, 'pm_open' => 0, 'pm_completed' => 2, 'labour_minutes' => 90],
            array_intersect_key($workload[$this->tech1->id], array_flip(['wo_active', 'wo_completed', 'pm_open', 'pm_completed', 'labour_minutes'])));
        $this->assertSame(['wo_active' => 1, 'wo_completed' => 0], array_intersect_key($workload[$this->tech2->id], array_flip(['wo_active', 'wo_completed'])));
        $this->assertArrayHasKey($this->itLead->id, $workload->all(), 'unit staff without activity are listed too');
        $this->assertArrayNotHasKey($this->mtcTech->id, $workload->all());

        $this->assertSame('2026-10-08T08:00:00+07:00', $d['pm_upcoming'][0]['due_at']);
        $this->assertSame(['scheduled', 'SCN-01'], [$d['pm_upcoming'][0]['status'], $d['pm_upcoming'][0]['equipment']['code']]);
    }

    public function test_technician_defaults_to_own_work(): void
    {
        $d = $this->dashboard($this->tech1);

        $this->assertSame('mine', $d['scope']);
        $this->assertSame(['mine', 'unit'], $d['available_scopes']);
        $this->assertSame(1, $d['kpi']['wo_created'], 'only WO1 involved tech1');
        $this->assertSame(0, $d['kpi']['wo_open']);
        $this->assertEquals(60.0, $d['kpi']['wo_avg_response_minutes']);
        $this->assertSame(33.3, $d['kpi']['pm_compliance_pct'], 'PIC of the PM schedule');
        $this->assertSame([$this->tech1->id], array_map(fn ($r) => $r['user']['id'], $d['technician_workload']));

        // A technician may still look at the unit as a whole
        $this->assertSame(3, $this->dashboard($this->tech1, 'scope=unit')['kpi']['wo_created']);
        $this->actingAsUser($this->tech1)->getJson('/api/v1/dashboard?scope=all')->assertForbidden();
    }

    public function test_requester_sees_only_own_documents_and_management_sees_everything(): void
    {
        $d = $this->dashboard($this->requester);
        $this->assertSame(['mine'], $d['available_scopes']);
        $this->assertSame(3, $d['kpi']['wo_created'], 'WO1, WO2 and the MTC one');
        $this->assertSame(2, $d['kpi']['wo_open']);
        $this->assertSame(1, $d['kpi']['requests_pending_approval']);
        $this->assertNull($d['kpi']['pm_compliance_pct']);
        $this->assertSame([], $d['technician_workload']);
        $this->actingAsUser($this->requester)->getJson('/api/v1/dashboard?scope=unit')->assertForbidden();

        $this->assertSame(1, $this->dashboard($this->superior)['kpi']['requests_waiting_me']);

        $manager = User::factory()->create();
        $manager->assignRole(User::ROLE_ADMIN);
        $all = $this->dashboard($manager);
        $this->assertSame('all', $all['scope']);
        $this->assertSame(['mine', 'all'], $all['available_scopes']);
        $this->assertSame(4, $all['kpi']['wo_created']);
        $this->assertSame(3, $all['kpi']['wo_open']);
        $this->assertSame(1, $this->dashboard($manager, 'executor_unit_id='.$this->mtc->id)['kpi']['wo_created']);
        $this->assertSame(1, $this->dashboard($manager, 'service_category_id='.$this->mtcCategory->id)['kpi']['wo_created']);
        $this->assertSame(2, $this->dashboard($manager, 'location_id='.$this->location->id)['kpi']['wo_created'], 'WO1 (scanner) and WO2 (UPS) share the location; WO3/WO4 have none');
    }

    public function test_filters_validation_and_month_buckets(): void
    {
        $this->actingAsUser($this->itLead)->getJson('/api/v1/dashboard?scope=everything')->assertStatus(422)->assertJsonValidationErrors('scope');
        $this->actingAsUser($this->itLead)->getJson('/api/v1/dashboard?from=2026-10-07&to=2026-10-01')->assertStatus(422)->assertJsonValidationErrors('to');
        $this->actingAsUser($this->itLead)->getJson('/api/v1/dashboard?from=2025-01-01&to=2026-10-07')->assertStatus(422)->assertJsonValidationErrors('to');

        $d = $this->actingAsUser($this->itLead)->getJson('/api/v1/dashboard?from=2026-06-01&to=2026-10-07')->assertOk()->json('data');
        $this->assertSame('month', $d['period']['bucket']);
        $this->assertSame(['2026-06', '2026-07', '2026-08', '2026-09', '2026-10'], array_column($d['wo_trend'], 'period'));
        $this->assertSame('Okt 2026', $d['wo_trend'][4]['label']);
        $this->assertSame(3, $d['wo_trend'][4]['created']);

        // Outside my units in unit scope → nothing, no error
        $this->assertSame(0, $this->dashboard($this->itLead, 'executor_unit_id='.$this->mtc->id)['kpi']['wo_created']);

        // Default period = last 30 days
        $default = $this->actingAsUser($this->itLead)->getJson('/api/v1/dashboard')->json('data.period');
        $this->assertSame(['from' => '2026-09-08', 'to' => '2026-10-07'], array_intersect_key($default, array_flip(['from', 'to'])));
    }

    public function test_results_are_cached_per_user_scope_and_filters(): void
    {
        config(['pm.dashboard.cache_seconds' => 300]);
        Cache::flush();

        $this->assertSame(3, $this->dashboard($this->itLead)['kpi']['wo_created']);
        $this->createWorkOrder(['equipment_id' => null, 'request_description' => 'Baru'], $this->colleague);

        $this->assertSame(3, $this->dashboard($this->itLead)['kpi']['wo_created'], 'served from cache');
        $this->assertSame(4, $this->dashboard($this->itLead, 'scope=unit&service_category_id='.$this->hardware->id)['kpi']['wo_created'], 'other filters are computed fresh');
        $this->assertSame(1, $this->dashboard($this->tech1)['kpi']['wo_created'], 'other users have their own entry');
    }
}
