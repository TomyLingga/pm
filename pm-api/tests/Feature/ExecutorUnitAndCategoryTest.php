<?php

namespace Tests\Feature;

use App\Models\ExecutorUnit;
use App\Models\OrgUnit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\ServiceRequestFixtures;
use Tests\TestCase;

/**
 * Executor units are seksi; the Kasubag / Kabag above a seksi lead it too.
 * Every seksi member may add service categories; the seksi's executor unit is created on first use.
 */
class ExecutorUnitAndCategoryTest extends TestCase
{
    use RefreshDatabase;
    use ServiceRequestFixtures;

    private User $kasubagIt;
    private User $kabagTek;
    private User $adminSit;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpServiceRequests();
        Notification::fake();

        $subIt = OrgUnit::query()->where('code', 'SIT')->sole();
        $bagTek = OrgUnit::query()->where('code', 'TEK')->sole();
        $this->kasubagIt = User::factory()->inUnit($subIt)->create(['name' => 'Kasubag SIT', 'grade_code' => 'BOM-2', 'grade_level' => 10]);
        $this->kabagTek = User::factory()->inUnit($bagTek)->create(['name' => 'Kabag Teknik', 'grade_code' => 'BOM-1', 'grade_level' => 12]);
        $this->adminSit = User::factory()->technician()->inUnit($subIt)->create(['name' => 'Staf Administrasi SIT']);
    }

    private function myUnits(User $user): array
    {
        return collect($this->actingAsUser($user)->getJson('/api/v1/auth/me')->assertOk()->json('data.executor_units'))
            ->map(fn ($u) => [$u['code'], $u['is_lead']])->sortBy(0)->values()->all();
    }

    public function test_sub_bagian_and_bagian_leads_lead_the_seksi_below(): void
    {
        $this->assertSame([['IT', true]], $this->myUnits($this->kasubagIt));
        $this->assertSame([['IT', true], ['MTC', true]], $this->myUnits($this->kabagTek));
        $this->assertSame([], $this->myUnits($this->adminSit), 'non-lead staff of the sub bagian is not an executor');
        $this->assertSame([['IT', true]], $this->myUnits($this->itLead));
        $this->assertSame([['IT', false]], $this->myUnits($this->tech1));

        $staff = collect($this->actingAsUser($this->tech1)->getJson("/api/v1/executor-units/{$this->it->id}/staff")->json('data'))
            ->pluck('is_lead', 'name')->all();
        $this->assertTrue($staff['Kasubag SIT']);
        $this->assertTrue($staff['Kabag Teknik']);
        $this->assertArrayNotHasKey('Staf Administrasi SIT', $staff);
        $this->assertFalse($staff['Tomy Lingga']);

        // The Kasubag can receive/assign a WO of the seksi, the sub bagian's admin staff cannot touch it.
        $wo = $this->createWorkOrder();
        $this->action($this->adminSit, $wo['id'], 'pick')->assertForbidden();
        $this->action($this->kasubagIt, $wo['id'], 'receive', ['assignee_ids' => [$this->tech1->id], 'lead_id' => $this->tech1->id])
            ->assertOk()->assertJsonPath('data.status', 'received');

        // Delegation only goes downwards: the seksi lead cannot assign a WO to the Kasubag/Kabag above.
        $staffFor = fn (User $u) => collect($this->actingAsUser($u)->getJson("/api/v1/executor-units/{$this->it->id}/staff")->json('data'))->pluck('assignable', 'name');
        $this->assertEquals(['Kabag Teknik' => false, 'Kasubag SIT' => false, 'Oka Aritonang' => true, 'Tomy Lingga' => true], $staffFor($this->itLead)->only(['Kasubag SIT', 'Kabag Teknik', 'Oka Aritonang', 'Tomy Lingga'])->sortKeys()->all());
        $this->assertEquals(['Kabag Teknik' => false, 'Kasubag SIT' => true, 'Oka Aritonang' => true], $staffFor($this->kasubagIt)->only(['Kasubag SIT', 'Kabag Teknik', 'Oka Aritonang'])->sortKeys()->all());
        $wo2 = $this->createWorkOrder();
        $this->action($this->itLead, $wo2['id'], 'receive', ['assignee_ids' => [$this->kasubagIt->id], 'lead_id' => $this->kasubagIt->id])
            ->assertStatus(422)->assertJsonValidationErrors('assignee_ids');
        $this->action($this->kasubagIt, $wo2['id'], 'receive', ['assignee_ids' => [$this->itLead->id, $this->tech1->id], 'lead_id' => $this->itLead->id])
            ->assertOk();
        $this->action($this->itLead, $wo2['id'], 'assignees', ['assignee_ids' => [$this->kabagTek->id], 'lead_id' => $this->kabagTek->id], 'putJson')
            ->assertStatus(422)->assertJsonValidationErrors('assignee_ids');

        // "Mgr/Spv Divisi" of a Form Request can be the Kabag above the seksi.
        $sr = $this->submittedRequest();
        $this->requestAction($this->superior, $sr['id'], 'approve')->assertOk();
        $this->requestAction($this->kabagTek, $sr['id'], 'approve', ['assigned_executor_id' => $this->tech2->id])
            ->assertOk()->assertJsonPath('data.status', 'in_progress');
    }

    public function test_every_seksi_member_can_add_categories_and_the_unit_is_created_on_first_use(): void
    {
        $sections = fn (User $u) => collect($this->actingAsUser($u)->getJson('/api/v1/service-categories/sections')->assertOk()->json('data'));

        $mine = $sections($this->tech1);
        $this->assertSame(['IT'], $mine->pluck('org_unit.name')->all());
        $this->assertSame(['Sistem & IT', 'Teknik'], $mine[0]['org_unit']['parents']);
        $this->assertSame(['Hardware', 'Lain-lain'], array_column($mine[0]['categories'], 'name'));
        $this->assertFalse($mine[0]['can_manage']);
        $this->assertSame(['IT', 'Maintenance'], $sections($this->kabagTek)->pluck('org_unit.name')->all());
        $this->assertSame([], $sections($this->requester)->all(), 'a sub bagian has no seksi of its own');

        // A technician adds "Network": it lands before "Lain-lain"
        $this->actingAsUser($this->tech1)->postJson('/api/v1/service-categories', ['org_unit_id' => $this->it->org_unit_id, 'name' => 'Network'])
            ->assertCreated()->assertJsonPath('data.for_work_order', true)->assertJsonPath('data.for_request', true);
        $this->assertSame(['Hardware', 'Network', 'Lain-lain'], array_column($sections($this->tech1)[0]['categories'], 'name'));
        $this->actingAsUser($this->tech2)->postJson('/api/v1/service-categories', ['org_unit_id' => $this->it->org_unit_id, 'name' => 'network'])
            ->assertStatus(422)->assertJsonValidationErrors('name');
        $this->actingAsUser($this->tech1)->postJson('/api/v1/service-categories', ['org_unit_id' => $this->mtc->org_unit_id, 'name' => 'Pompa'])
            ->assertForbidden();
        $this->actingAsUser($this->tech1)->postJson('/api/v1/service-categories', ['org_unit_id' => OrgUnit::query()->where('code', 'SIT')->value('id'), 'name' => 'Lainnya'])
            ->assertForbidden();

        // A seksi that is not an executor yet: its first category creates the unit (code without "SEK-")
        $seksi = OrgUnit::factory()->ofType(OrgUnit::TYPE_SEKSI, OrgUnit::query()->where('code', 'KEU')->sole())
            ->create(['code' => 'SEK-GA', 'name' => 'General Affair']);
        $gaStaff = User::factory()->technician()->inUnit($seksi)->create();
        $this->assertNull($sections($gaStaff)[0]['executor_unit']);
        $this->assertNotContains('General Affair', collect($this->actingAsUser($gaStaff)->getJson('/api/v1/executor-units')->json('data'))->pluck('display_name'));

        $this->actingAsUser($gaStaff)->postJson('/api/v1/service-categories', [
            'org_unit_id' => $seksi->id, 'name' => 'Kendaraan', 'for_request' => false,
        ])->assertCreated();
        $unit = ExecutorUnit::query()->where('org_unit_id', $seksi->id)->sole();
        $this->assertSame(['GA', 'General Affair', true], [$unit->code, $unit->display_name, $unit->is_active]);
        $this->assertContains('General Affair', collect($this->actingAsUser($gaStaff)->getJson('/api/v1/executor-units?for=work_order')->json('data'))->pluck('display_name'));
        $this->assertNotContains('General Affair', collect($this->actingAsUser($gaStaff)->getJson('/api/v1/executor-units?for=request')->json('data'))->pluck('display_name'),
            'no category is meant for Form Requests yet');
        $this->assertSame([['GA', false]], $this->myUnits($gaStaff));
    }

    public function test_only_leads_rename_or_deactivate_categories(): void
    {
        $this->actingAsUser($this->tech1)->putJson("/api/v1/service-categories/{$this->hardware->id}", ['name' => 'Perangkat Keras'])->assertForbidden();
        $this->actingAsUser($this->kasubagIt)->putJson("/api/v1/service-categories/{$this->hardware->id}", ['name' => 'Lain-lain'])
            ->assertStatus(422)->assertJsonValidationErrors('name');
        $this->actingAsUser($this->kasubagIt)->putJson("/api/v1/service-categories/{$this->hardware->id}", ['for_work_order' => false, 'for_request' => false])
            ->assertStatus(422)->assertJsonValidationErrors('for_work_order');
        $this->actingAsUser($this->kasubagIt)->putJson("/api/v1/service-categories/{$this->hardware->id}", ['name' => 'Perangkat Keras', 'is_active' => false])
            ->assertOk()->assertJsonPath('data.name', 'Perangkat Keras')->assertJsonPath('data.is_active', false);

        $it = collect($this->actingAsUser($this->requester)->getJson('/api/v1/executor-units?for=work_order')->json('data'))->firstWhere('code', 'IT');
        $this->assertSame(['Lain-lain'], array_column($it['categories'], 'name'), 'inactive categories are not offered');

        // Re-adding a deactivated name brings it back
        $this->actingAsUser($this->tech1)->postJson('/api/v1/service-categories', ['org_unit_id' => $this->it->org_unit_id, 'name' => 'perangkat keras'])
            ->assertCreated()->assertJsonPath('data.id', $this->hardware->id)->assertJsonPath('data.is_active', true);
    }

    public function test_command_registers_seksi_only(): void
    {
        $this->artisan('pm:executor-unit SIT')->assertExitCode(1);
        $seksi = OrgUnit::factory()->ofType(OrgUnit::TYPE_SEKSI)->create(['code' => 'SEK-HK', 'name' => 'Hukum & Kepatuhan']);
        $this->artisan('pm:executor-unit SEK-HK --category=Kontrak')->assertExitCode(0);
        $this->artisan('pm:executor-unit SEK-HK --category=Perizinan')->assertExitCode(0);
        $this->artisan('pm:executor-unit SEK-HK')->assertExitCode(0);
        $this->assertSame(['Kontrak', 'Perizinan', 'Lain-lain'], ExecutorUnit::query()->where('org_unit_id', $seksi->id)->sole()
            ->categories()->orderBy('sort_order')->pluck('name')->all(), 'new categories are appended, "Lain-lain" stays last');
        $this->assertSame(['HK', 'Hukum & Kepatuhan'], [
            ExecutorUnit::query()->where('org_unit_id', $seksi->id)->value('code'),
            ExecutorUnit::query()->where('org_unit_id', $seksi->id)->value('display_name'),
        ]);
    }
}
