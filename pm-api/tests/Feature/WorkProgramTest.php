<?php

namespace Tests\Feature;

use App\Models\OrgUnit;
use App\Models\User;
use App\Models\WorkProgram;
use App\Notifications\DocumentNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\WorkOrderFixtures;
use Tests\TestCase;

/**
 * Program Kerja Tahunan: a programme belongs to an org unit; the whole branch sees it (seksi staff see the
 * programmes of the units above, a Kasubag/Kabag those of every unit below); leads manage, PICs update.
 */
class WorkProgramTest extends TestCase
{
    use RefreshDatabase;
    use WorkOrderFixtures;

    private User $kasubagIt;
    private User $kabagTek;
    private OrgUnit $subIt;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpOrganization();
        Notification::fake();
        $this->subIt = OrgUnit::query()->where('code', 'SIT')->sole();
        $this->kasubagIt = User::factory()->inUnit($this->subIt)->create(['name' => 'Kasubag SIT', 'grade_code' => 'BOM-2', 'grade_level' => 10]);
        $this->kabagTek = User::factory()->inUnit(OrgUnit::query()->where('code', 'TEK')->sole())->create(['name' => 'Kabag Teknik', 'grade_code' => 'BOM-1', 'grade_level' => 12]);
    }

    private function programPayload(array $overrides = []): array
    {
        return array_merge([
            'year' => 2026, 'code' => 'A', 'title' => 'Enabling Digital and Reliable Operation',
            'description' => 'Program kerja Sub Bagian Sistem & IT', 'org_unit_id' => $this->subIt->id,
        ], $overrides);
    }

    public function test_leads_create_programmes_for_their_subtree_and_the_branch_sees_them(): void
    {
        // A technician (BOM-4) cannot create; the seksi lead cannot create for the sub bagian above.
        $this->actingAsUser($this->tech1)->postJson('/api/v1/work-programs', $this->programPayload())->assertForbidden();
        $this->actingAsUser($this->itLead)->postJson('/api/v1/work-programs', $this->programPayload())->assertForbidden();
        $this->assertSame(['IT'], array_column($this->actingAsUser($this->itLead)->getJson('/api/v1/work-programs/units')->json('data'), 'code'));
        $this->assertSame(['IT', 'SIT'], collect($this->actingAsUser($this->kasubagIt)->getJson('/api/v1/work-programs/units')->json('data'))->pluck('code')->sort()->values()->all());

        $program = $this->actingAsUser($this->kasubagIt)->postJson('/api/v1/work-programs', $this->programPayload())
            ->assertCreated()->assertJsonPath('data.code', 'A')->assertJsonPath('data.status', 'active')
            ->assertJsonPath('data.permissions.can_manage', true)->json('data');
        $this->actingAsUser($this->kasubagIt)->postJson('/api/v1/work-programs', $this->programPayload(['title' => 'Duplikat']))
            ->assertStatus(422)->assertJsonValidationErrors('code');

        // Items and activities
        $withItem = $this->actingAsUser($this->kasubagIt)->postJson("/api/v1/work-programs/{$program['id']}/items", ['code' => 'A.1', 'title' => 'IT Development'])
            ->assertOk()->json('data');
        $itemId = $withItem['items'][0]['id'];
        $activity = $this->actingAsUser($this->kasubagIt)->postJson("/api/v1/work-program-items/{$itemId}/activities", [
            'title' => 'Integrasi SAP dengan SmartWB', 'action_plan' => "A. Pengumpulan data\nB. Desain database", 'target_date' => '2026-12-31',
            'pics' => [['user_id' => $this->itLead->id, 'role' => 'utama'], ['user_id' => $this->tech1->id, 'role' => 'pendukung']],
        ])->assertCreated()->assertJsonPath('data.status', 'open')->assertJsonPath('data.pics.0.role', 'utama')->json('data');
        Notification::assertSentTo($this->itLead, DocumentNotification::class, fn (DocumentNotification $n) => $n->event === 'work_program.assigned');
        Notification::assertSentTo($this->tech1, DocumentNotification::class);
        $this->actingAsUser($this->kasubagIt)->postJson("/api/v1/work-program-items/{$itemId}/activities", [
            'title' => 'Dua PIC utama', 'pics' => [['user_id' => $this->itLead->id, 'role' => 'utama'], ['user_id' => $this->tech1->id, 'role' => 'utama']],
        ])->assertStatus(422)->assertJsonValidationErrors('pics');

        // Visibility along the branch
        $ids = fn (User $u, string $q = '') => array_column($this->actingAsUser($u)->getJson('/api/v1/work-programs'.$q)->assertOk()->json('data'), 'id');
        $this->assertSame([$program['id']], $ids($this->tech1), 'seksi staff see the sub bagian programme above them');
        $this->assertSame([$program['id']], $ids($this->kabagTek), 'the Kabag sees everything below');
        $this->assertSame([], $ids($this->mtcTech), 'another branch (seksi Maintenance under Teknik) does not see Sistem & IT');
        $this->assertSame([], $ids($this->requester), 'another bagian does not see it');
        $this->actingAsUser($this->requester)->getJson("/api/v1/work-programs/{$program['id']}")->assertForbidden();
        $this->assertSame(2026, $this->actingAsUser($this->tech1)->getJson('/api/v1/work-programs')->json('meta.year'));
        $this->assertSame([], $ids($this->tech1, '?year=2025'));

        // PIC updates progress and remarks; cannot edit the title; a non-PIC technician cannot touch it
        $this->actingAsUser($this->tech1)->putJson("/api/v1/work-program-activities/{$activity['id']}", ['progress_pct' => 40, 'remarks' => 'Data terkumpul'])
            ->assertOk()->assertJsonPath('data.progress_pct', 40)->assertJsonPath('data.status', 'on_progress')->assertJsonPath('data.permissions.can_edit', false);
        $this->actingAsUser($this->tech1)->putJson("/api/v1/work-program-activities/{$activity['id']}", ['title' => 'Ganti judul'])->assertOk()
            ->assertJsonPath('data.title', 'Integrasi SAP dengan SmartWB');
        $this->actingAsUser($this->tech2)->putJson("/api/v1/work-program-activities/{$activity['id']}", ['progress_pct' => 90])->assertForbidden();

        // Close with a status log; programme progress follows
        $closed = $this->actingAsUser($this->itLead)->postJson("/api/v1/work-program-activities/{$activity['id']}/status", ['status' => 'closed', 'notes' => 'Go live 13 Agustus'])
            ->assertOk()->assertJsonPath('data.status', 'closed')->assertJsonPath('data.progress_pct', 100)->json('data');
        $this->assertNotNull($closed['closed_date']);
        $this->assertSame(['create', 'update', 'update', 'status'], array_reverse(array_column($closed['logs'], 'action')));
        $this->assertSame('Go live 13 Agustus', $closed['logs'][0]['notes']);
        $detail = $this->actingAsUser($this->tech1)->getJson("/api/v1/work-programs/{$program['id']}")->assertOk()->json('data');
        $this->assertSame(100, $detail['progress_pct']);
        $this->assertSame(['open' => 0, 'on_progress' => 0, 'closed' => 1, 'cancelled' => 0], $detail['counts']);
        $this->assertSame('item_added', $detail['logs'][0]['action']);

        // Export and close the programme
        $this->actingAsUser($this->tech1)->get("/api/v1/work-programs/{$program['id']}/export")->assertOk()
            ->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        $this->actingAsUser($this->kasubagIt)->putJson("/api/v1/work-programs/{$program['id']}", ['status' => 'closed'])->assertOk()
            ->assertJsonPath('data.status', 'closed')->assertJsonPath('data.permissions.can_add_activity', false);
        $this->actingAsUser($this->itLead)->deleteJson("/api/v1/work-programs/{$program['id']}")->assertForbidden();
        $this->actingAsUser($this->kasubagIt)->deleteJson("/api/v1/work-programs/{$program['id']}")->assertNoContent();
        $this->assertSoftDeleted('work_programs', ['id' => $program['id']]);
    }

    public function test_pic_outside_the_branch_still_sees_the_programme(): void
    {
        $program = WorkProgram::query()->create($this->programPayload(['created_by_id' => $this->kasubagIt->id]));
        $item = $program->items()->create(['code' => 'A.1', 'title' => 'IT Development', 'sort_order' => 1]);
        $activity = $item->activities()->create(['sequence' => 1, 'title' => 'Dukungan dari Pengadaan', 'status' => 'open']);
        $activity->pics()->attach($this->requester->id, ['role' => 'pendukung']);

        $this->actingAsUser($this->requester)->getJson("/api/v1/work-programs/{$program->id}")->assertOk()
            ->assertJsonPath('data.permissions.can_manage', false)
            ->assertJsonPath('data.items.0.activities.0.permissions.can_update_progress', true);
        $this->assertSame([$program->id], array_column($this->actingAsUser($this->requester)->getJson('/api/v1/work-programs')->json('data'), 'id'));
        $this->assertContains('Kasubag SIT', array_column($this->actingAsUser($this->tech1)->getJson('/api/v1/work-programs/people?q=kasubag')->json('data'), 'name'));
    }
}
