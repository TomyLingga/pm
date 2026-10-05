<?php

namespace Tests\Feature\ServiceRequests;

use App\Models\ApprovalStep;
use App\Models\User;
use App\Notifications\DocumentNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\ServiceRequestFixtures;
use Tests\TestCase;

/** Superior selection, self-approval, visibility, cancel/delete, inbox and reminders. */
class ServiceRequestRulesTest extends TestCase
{
    use RefreshDatabase;
    use ServiceRequestFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpServiceRequests();
        Notification::fake();
    }

    public function test_superior_defaults_to_portal_atasan_and_can_be_replaced_by_a_higher_grade(): void
    {
        $this->actingAsUser($this->requester)->getJson('/api/v1/users/my-superior')
            ->assertOk()->assertJsonPath('data.id', $this->superior->id);

        $candidates = $this->actingAsUser($this->requester)->getJson('/api/v1/users/superior-candidates')->assertOk()->json('data');
        $ids = array_column($candidates, 'id');
        $this->assertContains($this->superior->id, $ids);
        $this->assertNotContains($this->colleague->id, $ids, 'lower grade');
        $this->assertNotContains($this->requester->id, $ids);
        $this->actingAsUser($this->requester)->getJson('/api/v1/users/superior-candidates?q=indra')
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.grade_code', 'BOM-1');

        // A lower grade cannot be chosen
        $draft = $this->createRequest();
        $this->requestAction($this->requester, $draft['id'], 'submit', ['superior_id' => $this->colleague->id])
            ->assertStatus(422)->assertJsonValidationErrors('superior_id');

        // Another higher grade can
        $manager = User::factory()->inUnit($this->requesterUnit)->create(['grade_code' => 'BOM-2', 'grade_level' => 10]);
        $sr = $this->requestAction($this->requester, $draft['id'], 'submit', ['superior_id' => $manager->id])->assertOk()->json('data');
        $this->assertSame($manager->id, $sr['superior']['id']);
        $this->assertSame($manager->id, $this->requester->fresh()->preferred_superior_id);
        $this->actingAsUser($this->requester)->getJson('/api/v1/users/my-superior')->assertJsonPath('data.id', $manager->id);
    }

    public function test_requester_can_change_superior_while_waiting(): void
    {
        $sr = $this->submittedRequest();
        $deputy = User::factory()->inUnit($this->requesterUnit)->create(['grade_code' => 'BOM-2', 'grade_level' => 10]);

        $this->requestAction($this->colleague, $sr['id'], 'change-superior', ['superior_id' => $deputy->id])->assertForbidden();
        $sr = $this->requestAction($this->requester, $sr['id'], 'change-superior', ['superior_id' => $deputy->id, 'reason' => 'Pak Indra cuti'])
            ->assertOk()->json('data');

        $this->assertSame($deputy->id, $sr['superior']['id']);
        $this->assertSame($deputy->name, $sr['current_step']['assignee_label']);
        $this->requestAction($this->superior, $sr['id'], 'approve')->assertForbidden();
        $this->requestAction($deputy, $sr['id'], 'approve')->assertOk()->assertJsonPath('data.status', 'waiting_executor');
        Notification::assertSentTo($deputy, DocumentNotification::class, fn ($n) => $n->event === 'service_request.submitted');

        // Not possible anymore once the superior step is done
        $this->requestAction($this->requester, $sr['id'], 'change-superior', ['superior_id' => $this->superior->id])->assertStatus(409);
    }

    public function test_top_grade_requester_skips_the_superior_step(): void
    {
        $director = User::factory()->inUnit($this->requesterUnit)->create(['grade_code' => 'BOM', 'grade_level' => 99]);

        $sr = $this->submittedRequest([], $director);

        $this->assertSame('waiting_executor', $sr['status']);
        $this->assertSame('skipped', $this->stepStatuses($sr)['superior']);
        $this->assertSame('pending', $this->stepStatuses($sr)['executor_lead']);
    }

    public function test_nobody_approves_their_own_request(): void
    {
        $secondLead = User::factory()->lead()->inUnit($this->it->orgUnit)->create(['grade_code' => 'BOM-2', 'grade_level' => 10]);
        $this->itLead->update(['superior_id' => $secondLead->id]);

        // The IT lead asks something from IT: approved by the superior, but the division step must be someone else
        $sr = $this->submittedRequest([], $this->itLead);
        $this->requestAction($secondLead, $sr['id'], 'approve')->assertOk();

        $this->requestAction($this->itLead, $sr['id'], 'approve')->assertForbidden();
        $this->actingAsUser($this->itLead)->getJson('/api/v1/approvals/pending-count')->assertJsonPath('data.count', 0);
        $this->actingAsUser($secondLead)->getJson('/api/v1/approvals/pending')->assertJsonPath('data.0.document_id', $sr['id']);
        $this->requestAction($secondLead, $sr['id'], 'approve', ['assigned_executor_id' => $this->itLead->id])
            ->assertStatus(422)->assertJsonValidationErrors('assigned_executor_id');
        $this->requestAction($secondLead, $sr['id'], 'approve', ['assigned_executor_id' => $this->mtcTech->id])
            ->assertStatus(422)->assertJsonValidationErrors('assigned_executor_id');
    }

    public function test_visibility(): void
    {
        $draft = $this->createRequest();
        $url = "/api/v1/service-requests/{$draft['id']}";

        $this->actingAsUser($this->colleague)->getJson($url)->assertOk();
        $this->actingAsUser($this->superior)->getJson($url)->assertForbidden(); // drafts stay private
        $this->actingAsUser($this->tech1)->getJson($url)->assertForbidden();

        $this->requestAction($this->requester, $draft['id'], 'submit')->assertOk();
        foreach ([$this->superior, $this->itLead, $this->tech1] as $allowed) {
            $this->actingAsUser($allowed)->getJson($url)->assertOk();
        }
        foreach ([$this->outsider, $this->mtcTech] as $denied) {
            $this->actingAsUser($denied)->getJson($url)->assertForbidden();
        }
    }

    public function test_cancel_and_delete_rules(): void
    {
        $draft = $this->createRequest();
        $this->actingAsUser($this->colleague)->deleteJson("/api/v1/service-requests/{$draft['id']}")->assertForbidden();
        $this->actingAsUser($this->requester)->deleteJson("/api/v1/service-requests/{$draft['id']}")->assertNoContent();

        $sr = $this->submittedRequest();
        $this->requestAction($this->requester, $sr['id'], 'cancel', [])->assertStatus(422)->assertJsonValidationErrors('reason');
        $sr = $this->requestAction($this->requester, $sr['id'], 'cancel', ['reason' => 'Sudah tidak diperlukan'])->assertOk()->json('data');
        $this->assertSame('cancelled', $sr['status']);
        $this->assertSame(['completed', 'cancelled', 'cancelled', 'cancelled'], array_column($sr['approval_steps'], 'status'));
        $this->actingAsUser($this->superior)->getJson('/api/v1/approvals/pending-count')->assertJsonPath('data.count', 0);

        // Once in progress it can no longer be cancelled
        $other = $this->submittedRequest();
        $this->requestAction($this->superior, $other['id'], 'approve')->assertOk();
        $this->requestAction($this->itLead, $other['id'], 'approve')->assertOk();
        $this->requestAction($this->requester, $other['id'], 'cancel', ['reason' => 'x'])->assertStatus(409);
    }

    public function test_submit_validates_the_draft_and_editing_is_draft_only(): void
    {
        $this->actingAsUser($this->requester)->postJson('/api/v1/service-requests', $this->requestPayload([
            'service_category_id' => $this->mtcCategory->id, 'office_id' => null, 'purpose' => '',
        ]))->assertStatus(422)->assertJsonValidationErrors(['service_category_id', 'office_id', 'purpose']);

        $sr = $this->submittedRequest();
        $this->actingAsUser($this->requester)->putJson("/api/v1/service-requests/{$sr['id']}", $this->requestPayload())->assertStatus(409);
        $this->requestAction($this->requester, $sr['id'], 'submit')->assertStatus(409);
    }

    public function test_pending_approvals_are_reminded_with_an_alarm_after_24_hours(): void
    {
        $sr = $this->submittedRequest();

        $this->travelTo(now()->addHours(23));
        $this->artisan('approvals:remind')->expectsOutput('0 pengingat persetujuan dikirim.');

        $this->travelTo(now()->addHours(2));
        $this->artisan('approvals:remind')->expectsOutput('1 pengingat persetujuan dikirim.');
        Notification::assertSentTo($this->superior, DocumentNotification::class,
            fn (DocumentNotification $n) => $n->event === 'approval.reminder' && $n->alarm === true && $n->documentId === $sr['id']);
        $this->actingAsUser($this->superior)->getJson('/api/v1/approvals/pending')->assertJsonPath('data.0.overdue', true);

        $this->travelTo(now()->addHours(5));
        $this->artisan('approvals:remind')->expectsOutput('0 pengingat persetujuan dikirim.');
        $this->travelTo(now()->addHours(20));
        $this->artisan('approvals:remind')->expectsOutput('1 pengingat persetujuan dikirim.');

        // After the superior approves, the reminder clock restarts for the division
        $this->requestAction($this->superior, $sr['id'], 'approve')->assertOk();
        $this->artisan('approvals:remind')->expectsOutput('0 pengingat persetujuan dikirim.');
        $this->assertNull(ApprovalStep::query()->where('step_key', 'executor_lead')->value('last_reminded_at'));
    }

    public function test_leads_maintain_the_rules_text(): void
    {
        $body = ['request_rules' => "1. Aturan baru\n2. Aturan kedua", 'contact_footer' => 'Hubungi IT ext 144'];

        $this->actingAsUser($this->tech1)->putJson("/api/v1/executor-units/{$this->it->id}/request-settings", $body)->assertForbidden();
        $this->actingAsUser($this->itLead)->putJson("/api/v1/executor-units/{$this->it->id}/request-settings", $body)
            ->assertOk()->assertJsonPath('data.request_rules', "1. Aturan baru\n2. Aturan kedua");

        $units = $this->actingAsUser($this->requester)->getJson('/api/v1/executor-units?for=request')->json('data');
        $this->assertSame('Hubungi IT ext 144', collect($units)->firstWhere('code', 'IT')['contact_footer']);
    }
}
