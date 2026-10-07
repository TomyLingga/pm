<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\WorkOrderFixtures;
use Tests\TestCase;

/** Two roles only: admin sees everything and manages access; everybody else sees their own unit. */
class UserAccessTest extends TestCase
{
    use RefreshDatabase;
    use WorkOrderFixtures;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpOrganization();
        $this->admin = User::factory()->create(['name' => 'Tomy Inri Akbar Lingga', 'nrk' => '121110304']);
        $this->admin->assignRole(User::ROLE_ADMIN);
    }

    public function test_admin_lists_users_and_grants_or_revokes_admin(): void
    {
        $this->actingAsUser($this->admin)->getJson('/api/v1/auth/me')->assertOk()->assertJsonPath('data.is_admin', true);
        $this->actingAsUser($this->tech1)->getJson('/api/v1/auth/me')->assertOk()->assertJsonPath('data.is_admin', false);

        $page = $this->actingAsUser($this->admin)->getJson('/api/v1/users?q=tomy')->assertOk()->json();
        $this->assertSame(['Tomy Inri Akbar Lingga', 'Tomy Lingga'], array_column($page['data'], 'name'));
        $this->assertSame([true, false], array_column($page['data'], 'is_admin'));
        $this->assertSame([true, false], array_column($page['data'], 'is_me'));
        $this->assertSame(1, $page['meta']['admin_count']);
        $this->assertSame(['Tomy Inri Akbar Lingga'], array_column($this->actingAsUser($this->admin)->getJson('/api/v1/users?role=admin')->json('data'), 'name'));

        $this->actingAsUser($this->admin)->putJson("/api/v1/users/{$this->itLead->id}/access", ['is_admin' => true])
            ->assertOk()->assertJsonPath('data.is_admin', true);
        $this->assertTrue($this->itLead->fresh()->isAdmin());
        // The new admin now sees every WO
        $this->createWorkOrder(['executor_unit_id' => $this->mtc->id, 'service_category_id' => $this->mtcCategory->id]);
        $this->assertCount(1, $this->actingAsUser($this->itLead->fresh())->getJson('/api/v1/work-orders?scope=all')->assertOk()->json('data'));

        $this->actingAsUser($this->admin)->putJson("/api/v1/users/{$this->itLead->id}/access", ['is_admin' => false])
            ->assertOk()->assertJsonPath('data.is_admin', false);
        $this->actingAsUser($this->itLead->fresh())->getJson('/api/v1/work-orders?scope=all')->assertForbidden();
    }

    public function test_guards(): void
    {
        $this->actingAsUser($this->itLead)->getJson('/api/v1/users')->assertForbidden();
        $this->actingAsUser($this->itLead)->putJson("/api/v1/users/{$this->tech1->id}/access", ['is_admin' => true])->assertForbidden();
        $this->actingAsUser($this->admin)->putJson("/api/v1/users/{$this->admin->id}/access", ['is_admin' => false])
            ->assertStatus(422)->assertJsonValidationErrors('is_admin');
        $this->actingAsUser($this->admin)->putJson("/api/v1/users/{$this->tech1->id}/access", ['is_admin' => 'yes'])
            ->assertStatus(422)->assertJsonValidationErrors('is_admin');
        $this->outsider->update(['is_active' => false]);
        $this->actingAsUser($this->admin)->putJson("/api/v1/users/{$this->outsider->id}/access", ['is_admin' => true])
            ->assertStatus(422)->assertJsonValidationErrors('is_admin');
    }

    public function test_regular_users_only_see_their_unit_or_their_own_documents(): void
    {
        $wo = $this->createWorkOrder();
        $ids = fn (User $as, string $scope) => array_column($this->actingAsUser($as)->getJson("/api/v1/work-orders?scope={$scope}")->assertOk()->json('data'), 'id');

        $this->assertSame([$wo['id']], $ids($this->requester, 'mine'));
        $this->assertSame([$wo['id']], $ids($this->colleague, 'unit'), 'colleague in the same org unit');
        $this->assertSame([$wo['id']], $ids($this->tech1, 'executor'), 'executor unit staff');
        $this->assertSame([], $ids($this->mtcTech, 'executor'), 'other executor unit');
        $this->actingAsUser($this->mtcTech)->getJson("/api/v1/work-orders/{$wo['id']}")->assertForbidden();
        $this->actingAsUser($this->outsider)->getJson('/api/v1/work-orders?scope=all')->assertForbidden();
        $this->actingAsUser($this->admin)->getJson("/api/v1/work-orders/{$wo['id']}")->assertOk();
        $this->assertSame([$wo['id']], $ids($this->admin, 'all'));
        $this->assertSame([], array_column($this->actingAsUser($this->admin)->getJson('/api/v1/work-orders?scope=all&executor_unit_id='.$this->mtc->id)->json('data'), 'id'), 'unit filter');
    }
}
