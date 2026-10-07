<?php

namespace Tests\Feature\WorkOrders;

use App\Models\ExecutorUnitMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\WorkOrderFixtures;
use Tests\TestCase;

class WorkOrderAuthorizationTest extends TestCase
{
    use RefreshDatabase;
    use WorkOrderFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpOrganization();
        Notification::fake();
    }

    public function test_guests_are_rejected(): void
    {
        $this->getJson('/api/v1/work-orders')->assertUnauthorized();
        $this->get('/api/v1/auth/me')->assertUnauthorized()->assertHeader('Content-Type', 'application/json');
    }

    public function test_visibility_of_a_work_order(): void
    {
        $wo = $this->createWorkOrder();
        $url = "/api/v1/work-orders/{$wo['id']}";

        foreach ([$this->requester, $this->colleague, $this->superior, $this->itLead, $this->tech1] as $allowed) {
            $this->actingAsUser($allowed)->getJson($url)->assertOk();
        }
        foreach ([$this->outsider, $this->mtcTech] as $denied) {
            $this->actingAsUser($denied)->getJson($url)->assertForbidden();
        }

        $admin = User::factory()->create();
        $admin->assignRole(User::ROLE_ADMIN);
        $this->actingAsUser($admin)->getJson($url)->assertOk();
    }

    public function test_only_executor_staff_can_pick_and_only_leads_can_receive(): void
    {
        $wo = $this->createWorkOrder();

        $this->action($this->mtcTech, $wo['id'], 'pick')->assertForbidden();
        $this->action($this->requester, $wo['id'], 'pick')->assertForbidden();
        $this->action($this->tech1, $wo['id'], 'receive', ['assignee_ids' => [$this->tech1->id], 'lead_id' => $this->tech1->id])
            ->assertForbidden();
        $this->action($this->itLead, $wo['id'], 'receive', ['assignee_ids' => [$this->tech1->id], 'lead_id' => $this->tech1->id])
            ->assertOk();

        // Only the assigned technician can start
        $this->action($this->tech2, $wo['id'], 'start')->assertForbidden();
        $this->action($this->tech1, $wo['id'], 'start')->assertOk();
    }

    public function test_user_in_charge_rules_for_acceptance(): void
    {
        $wo = $this->completedWorkOrder();

        $this->action($this->tech1, $wo['id'], 'accept', $this->acceptPayload())->assertForbidden();
        $this->action($this->outsider, $wo['id'], 'accept', $this->acceptPayload())->assertForbidden();
        $this->action($this->itLead, $wo['id'], 'accept', $this->acceptPayload())->assertForbidden();
        $this->action($this->colleague, $wo['id'], 'accept', $this->acceptPayload())
            ->assertOk()->assertJsonPath('data.accepted_by.id', $this->colleague->id);

        $second = $this->completedWorkOrder();
        $this->action($this->superior, $second['id'], 'accept', $this->acceptPayload())
            ->assertOk()->assertJsonPath('data.status', 'closed');
    }

    public function test_permission_flags_reflect_role_and_status(): void
    {
        $wo = $this->createWorkOrder();
        $url = "/api/v1/work-orders/{$wo['id']}";

        $this->actingAsUser($this->requester)->getJson($url)
            ->assertJsonPath('data.permissions.can_update', true)
            ->assertJsonPath('data.permissions.can_cancel', true)
            ->assertJsonPath('data.permissions.can_pick', false)
            ->assertJsonPath('data.permissions.can_accept', false);

        $this->actingAsUser($this->tech1)->getJson($url)
            ->assertJsonPath('data.permissions.can_pick', true)
            ->assertJsonPath('data.permissions.can_receive', false)
            ->assertJsonPath('data.permissions.can_cancel', false);

        $this->actingAsUser($this->itLead)->getJson($url)
            ->assertJsonPath('data.permissions.can_pick', true)
            ->assertJsonPath('data.permissions.can_receive', true);
    }

    public function test_manual_membership_include_and_exclude(): void
    {
        $wo = $this->createWorkOrder();

        // Kabag above the section is added manually as executor staff (lead grade)
        $kabag = User::factory()->create(['grade_code' => 'BOM-1', 'grade_level' => 13]);
        ExecutorUnitMember::query()->create(['executor_unit_id' => $this->it->id, 'user_id' => $kabag->id, 'membership' => 'include']);
        // tech2 is temporarily excluded
        ExecutorUnitMember::query()->create(['executor_unit_id' => $this->it->id, 'user_id' => $this->tech2->id, 'membership' => 'exclude']);

        $this->actingAsUser($kabag)->getJson('/api/v1/auth/me')
            ->assertJsonPath('data.executor_units.0.code', 'IT')
            ->assertJsonPath('data.executor_units.0.is_lead', true);
        $this->action($this->tech2, $wo['id'], 'pick')->assertForbidden();
        $this->action($kabag, $wo['id'], 'receive', ['assignee_ids' => [$this->tech1->id], 'lead_id' => $this->tech1->id])->assertOk();
    }

    public function test_staff_lookup_is_limited_to_the_unit(): void
    {
        $this->actingAsUser($this->outsider)->getJson("/api/v1/executor-units/{$this->it->id}/staff")->assertForbidden();

        $staff = $this->actingAsUser($this->itLead)->getJson("/api/v1/executor-units/{$this->it->id}/staff")
            ->assertOk()->json('data');
        $this->assertEqualsCanonicalizing([$this->itLead->id, $this->tech1->id, $this->tech2->id], array_column($staff, 'id'));
        $this->assertTrue(collect($staff)->firstWhere('id', $this->itLead->id)['is_lead']);
        $this->assertFalse(collect($staff)->firstWhere('id', $this->tech1->id)['is_lead']);
    }
}
