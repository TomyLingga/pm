<?php

namespace Tests\Feature;

use App\Exports\Templates\DailyActivityTemplate;
use App\Models\DailyActivity;
use App\Models\OrgUnit;
use App\Models\User;
use App\Models\WorkOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsSpreadsheets;
use Tests\Concerns\WorkOrderFixtures;
use Tests\TestCase;

/** Aktivitas Harian: own reports, leads see their subtree, period narrows closed reports only, status trail, WO auto-report, Excel import. */
class DailyActivityTest extends TestCase
{
    use BuildsSpreadsheets;
    use RefreshDatabase;
    use WorkOrderFixtures;

    private User $kasubagIt;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpOrganization();
        $this->kasubagIt = User::factory()->inUnit(OrgUnit::query()->where('code', 'SIT')->sole())->create(['name' => 'Kasubag SIT', 'grade_code' => 'BOM-2', 'grade_level' => 10]);
    }

    private function report(User $as, array $overrides = [])
    {
        return $this->actingAsUser($as)->postJson('/api/v1/daily-activities', array_merge([
            'activity_date' => '2026-10-03', 'title' => 'Final testing SmartWB', 'description' => 'Ceklis form sebelum testing, live test dengan Kabag.',
        ], $overrides));
    }

    public function test_reports_scopes_filters_and_status_trail(): void
    {
        $mine = $this->report($this->tech1)->assertCreated()->assertJsonPath('data.status', 'open')->assertJsonPath('data.week_of_month', 1)->json('data');
        $this->report($this->tech1, ['activity_date' => '2026-10-16', 'title' => 'Pengembangan Web IT Inventory', 'status' => 'on_progress'])->assertCreated()->assertJsonPath('data.week_of_month', 3);
        $this->report($this->tech1, ['activity_date' => '2026-09-29', 'title' => 'Bulan lalu', 'status' => 'closed'])->assertCreated();
        $this->report($this->tech2, ['title' => 'Laporan rekan'])->assertCreated();
        $this->report($this->mtcTech, ['title' => 'Laporan MTC'])->assertCreated();

        // A lead may report on behalf of a subordinate; a technician may not
        $this->report($this->itLead, ['user_id' => $this->tech1->id, 'title' => 'Dicatat pimpinan'])->assertCreated()->assertJsonPath('data.user.id', $this->tech1->id);
        $this->report($this->tech1, ['user_id' => $this->tech2->id])->assertForbidden();

        $list = fn (User $u, string $q) => $this->actingAsUser($u)->getJson('/api/v1/daily-activities?'.$q)->assertOk()->json();
        $titles = fn (array $page) => collect($page['data'])->pluck('title')->sort()->values()->all();

        $this->assertSame(['Bulan lalu', 'Dicatat pimpinan', 'Final testing SmartWB', 'Pengembangan Web IT Inventory'], $titles($list($this->tech1, 'scope=mine')));
        $this->assertSame(['mine'], $list($this->tech1, '')['meta']['available_scopes']);
        $this->actingAsUser($this->tech1)->getJson('/api/v1/daily-activities?scope=team')->assertForbidden();

        $october = $list($this->tech1, 'scope=mine&year=2026&month=10');
        $this->assertSame(['Dicatat pimpinan', 'Final testing SmartWB', 'Pengembangan Web IT Inventory'], $titles($october));
        $this->assertSame(['total' => 3, 'open' => 2, 'on_progress' => 1, 'closed' => 0], $october['meta']['summary']);
        $this->assertSame(['Pengembangan Web IT Inventory'], $titles($list($this->tech1, 'scope=mine&year=2026&month=10&week=3')));
        // The period only narrows closed reports: open / on-progress ones are always listed
        $this->assertSame(['Dicatat pimpinan', 'Final testing SmartWB', 'Pengembangan Web IT Inventory'], $titles($list($this->tech1, 'scope=mine&from=2026-10-01&to=2026-10-07')));
        $this->assertSame(['Bulan lalu'], $titles($list($this->tech1, 'scope=mine&status=closed')));
        $this->assertSame(['Bulan lalu'], $titles($list($this->tech1, 'scope=mine&status=closed&from=2026-09-01&to=2026-09-30')));
        $this->assertSame([], $titles($list($this->tech1, 'scope=mine&status=closed&from=2026-10-01&to=2026-10-31')));
        $this->assertSame(['Dicatat pimpinan', 'Final testing SmartWB', 'Pengembangan Web IT Inventory'], $titles($list($this->tech1, 'scope=mine&status=open,on_progress&from=2026-09-01&to=2026-09-02')));
        $this->assertSame(['Bulan lalu', 'Dicatat pimpinan', 'Final testing SmartWB', 'Pengembangan Web IT Inventory'], $titles($list($this->tech1, 'scope=mine&from=2026-09-01&to=2026-10-31')));

        // The seksi lead sees the whole seksi; the Kasubag sees the seksi below; neither sees Maintenance
        $team = $list($this->itLead, 'scope=team&year=2026&month=10');
        $this->assertSame(['Dicatat pimpinan', 'Final testing SmartWB', 'Laporan rekan', 'Pengembangan Web IT Inventory'], $titles($team));
        $this->assertSame(['mine', 'team'], $team['meta']['available_scopes']);
        $this->assertSame(['Dicatat pimpinan', 'Final testing SmartWB', 'Pengembangan Web IT Inventory'], $titles($list($this->kasubagIt, 'scope=team&user_id='.$this->tech1->id.'&year=2026&month=10')), 'Kasubag filters one subordinate');
        $this->assertNotContains('Laporan MTC', $titles($list($this->kasubagIt, 'scope=team')));
        $this->assertContains('Tomy Lingga', array_column($this->actingAsUser($this->kasubagIt)->getJson('/api/v1/daily-activities/people')->json('data'), 'name'));
        $this->assertSame([$this->tech1->name], array_column($this->actingAsUser($this->tech1)->getJson('/api/v1/daily-activities/people')->json('data'), 'name'));

        // Status trail
        $this->actingAsUser($this->tech2)->postJson("/api/v1/daily-activities/{$mine['id']}/status", ['status' => 'closed'])->assertForbidden();
        $closed = $this->actingAsUser($this->tech1)->postJson("/api/v1/daily-activities/{$mine['id']}/status", ['status' => 'closed', 'notes' => 'Go live berhasil'])
            ->assertOk()->assertJsonPath('data.status', 'closed')->json('data');
        $this->assertNotNull($closed['closed_at']);
        $this->assertSame(['status', 'create'], array_column($closed['logs'], 'action'));
        $this->assertSame('Go live berhasil', $closed['logs'][0]['notes']);
        $this->actingAsUser($this->tech1)->postJson("/api/v1/daily-activities/{$mine['id']}/status", ['status' => 'closed'])->assertStatus(422);
        $this->actingAsUser($this->itLead)->putJson("/api/v1/daily-activities/{$mine['id']}", ['follow_up' => 'Monitoring 1 minggu'])->assertOk()
            ->assertJsonPath('data.follow_up', 'Monitoring 1 minggu');

        // Export
        $this->actingAsUser($this->itLead)->get('/api/v1/daily-activities/export?scope=team&year=2026&month=10')->assertOk()
            ->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        $this->actingAsUser($this->tech2)->deleteJson("/api/v1/daily-activities/{$mine['id']}")->assertForbidden();
        $this->actingAsUser($this->tech1)->deleteJson("/api/v1/daily-activities/{$mine['id']}")->assertNoContent();
    }

    public function test_completing_a_work_order_records_a_closed_daily_report_for_the_technician(): void
    {
        $wo = $this->completedWorkOrder();
        $number = WorkOrder::query()->findOrFail($wo['id'])->wo_number;

        $mine = $this->actingAsUser($this->tech1)->getJson('/api/v1/daily-activities?scope=mine&status=closed')->assertOk()->json('data');
        $this->assertCount(1, $mine);
        $this->assertSame([$wo['id'], $number], [$mine[0]['work_order']['id'], $mine[0]['work_order']['wo_number']]);
        $this->assertStringStartsWith("{$number}: ", $mine[0]['title']);
        $this->assertStringContainsString('Roller scanner dibersihkan', $mine[0]['description']);
        $this->assertSame(['closed', now()->toDateString(), $this->tech1->id], [$mine[0]['status'], $mine[0]['activity_date'], $mine[0]['created_by']['id']]);

        $detail = $this->actingAsUser($this->tech1)->getJson('/api/v1/daily-activities/'.$mine[0]['id'])->assertOk()->json('data');
        $this->assertSame("Otomatis dari penyelesaian Work Order {$number}.", $detail['logs'][0]['notes']);

        // Rejected by the requester and completed again: still one report per technician
        $this->action($this->requester, $wo['id'], 'accept', ['acceptance' => 'no', 'reason' => 'Masih bermasalah'])->assertOk();
        $this->action($this->tech1, $wo['id'], 'complete', $this->completionPayload())->assertOk();
        $this->assertSame(1, DailyActivity::query()->where('work_order_id', $wo['id'])->count());
        $this->assertSame(0, DailyActivity::query()->where('user_id', $this->tech2->id)->count(), 'only assigned technicians get a report');
    }

    public function test_import_from_the_excel_template(): void
    {
        $this->actingAsUser($this->itLead)->get('/api/v1/daily-activities/import-template')->assertOk()
            ->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        $file = $this->xlsx([
            DailyActivityTemplate::HEADINGS,
            ['2026-10-05', 'Backup server mingguan', 'Backup ke NAS, uji restore 1 file.', 'Uji restore bulanan', null, 'CLOSED', null],
            ['06/10/2026', 'Survey AP timbangan', 'Survey sinyal area timbangan.', null, 'Jadwal user belum pasti', 'on progress', $this->tech1->nrk],
            ['2026-10-07', 'Laporan sendiri', 'Tanpa status dan NRK.', null, null, null, null],
        ]);
        $this->actingAsUser($this->itLead)->post('/api/v1/daily-activities/import', ['file' => $file])
            ->assertOk()->assertJsonPath('data.created', 3);

        $tech = $this->actingAsUser($this->tech1)->getJson('/api/v1/daily-activities?scope=mine')->assertOk()->json('data');
        $this->assertSame(['Survey AP timbangan'], array_column($tech, 'title'));
        $this->assertSame(['on_progress', '2026-10-06', 'Jadwal user belum pasti', $this->itLead->id], [$tech[0]['status'], $tech[0]['activity_date'], $tech[0]['obstacles'], $tech[0]['created_by']['id']]);
        $this->assertSame('Diimpor dari Excel', $this->actingAsUser($this->tech1)->getJson('/api/v1/daily-activities/'.$tech[0]['id'])->json('data.logs.0.notes'));
        $lead = $this->actingAsUser($this->itLead)->getJson('/api/v1/daily-activities?scope=mine&from=2026-10-01&to=2026-10-31')->assertOk()->json('data');
        $this->assertSame(['Laporan sendiri', 'Backup server mingguan'], array_column($lead, 'title'));
        $this->assertSame(['open', 'closed'], array_column($lead, 'status'));

        // One bad row means nothing is imported; messages point at the spreadsheet rows
        $bad = $this->xlsx([
            DailyActivityTemplate::HEADINGS,
            ['bukan tanggal', '', 'Uraian ada', null, null, 'DONE', '999999'],
            ['2026-10-08', 'Untuk teknisi MTC', 'Bukan bawahan saya.', null, null, null, $this->mtcTech->nrk],
        ]);
        $errors = $this->actingAsUser($this->itLead)->post('/api/v1/daily-activities/import', ['file' => $bad])->assertStatus(422)->json('errors');
        $this->assertSame(['file', 'rows.2', 'rows.3'], array_keys($errors));
        $this->assertStringContainsString('2 baris bermasalah', $errors['file'][0]);
        $this->assertSame([
            'Tanggal wajib diisi dengan format YYYY-MM-DD.',
            'Laporan Kegiatan (judul) wajib diisi.',
            'Status harus OPEN, ON PROGRESS, atau CLOSED.',
            'NRK 999999 tidak ditemukan atau tidak aktif.',
        ], $errors['rows.2']);
        $this->assertStringContainsString('bukan anggota unit di bawah Anda', $errors['rows.3'][0]);
        $this->assertSame(3, DailyActivity::query()->count());

        // A file that is not the template is rejected up front
        $wrong = $this->xlsx([['Kolom A', 'Kolom B'], ['x', 'y']]);
        $this->actingAsUser($this->itLead)->post('/api/v1/daily-activities/import', ['file' => $wrong])->assertStatus(422)->assertJsonValidationErrors('file');
        $this->actingAsUser($this->itLead)->post('/api/v1/daily-activities/import', [])->assertStatus(422)->assertJsonValidationErrors('file');
    }
}
