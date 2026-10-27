<?php

namespace Tests\Feature\ServiceRequests;

use App\Models\Office;
use App\Models\ServiceRequest;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\ServiceRequestFixtures;
use Tests\TestCase;

/** The requester's Portal placement (users.office_id) is the default office of their Form Requests. */
class RequestOfficeFromPlacementTest extends TestCase
{
    use RefreshDatabase;
    use ServiceRequestFixtures;

    private Office $medan;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpServiceRequests();
        Notification::fake();
        $this->medan = Office::query()->create(['code' => 'RO_MEDAN', 'name' => 'Representative Office Medan']);
        $this->requester->update(['office_id' => $this->medan->id]);
    }

    public function test_me_tells_the_web_and_mobile_form_which_office_to_preselect(): void
    {
        $this->actingAsUser($this->requester)->getJson('/api/v1/auth/me')->assertOk()
            ->assertJsonPath('data.office', ['id' => $this->medan->id, 'code' => 'RO_MEDAN', 'name' => 'Representative Office Medan', 'is_active' => true]);
        $this->actingAsUser($this->tech1)->getJson('/api/v1/auth/me')->assertOk()->assertJsonPath('data.office', null);
    }

    public function test_a_work_order_converted_to_a_request_takes_the_requesters_office(): void
    {
        $wo = $this->createWorkOrder(['request_description' => 'Ganti scanner baru']);
        $wo = $this->action($this->itLead, $wo['id'], 'convert-to-request', ['reason' => 'Biaya besar'])->assertOk()->json('data');

        $this->actingAsUser($this->requester)->getJson("/api/v1/service-requests/{$wo['converted_service_request']['id']}")
            ->assertOk()->assertJsonPath('data.office.name', 'Representative Office Medan');
    }

    public function test_an_office_that_is_no_longer_selectable_is_not_used(): void
    {
        $this->medan->update(['is_active' => false]);
        $wo = $this->createWorkOrder();
        $wo = $this->action($this->itLead, $wo['id'], 'convert-to-request', ['reason' => 'Biaya besar'])->assertOk()->json('data');

        $this->assertNull(ServiceRequest::query()->findOrFail($wo['converted_service_request']['id'])->office_id);
    }

    public function test_the_requester_can_still_choose_another_office(): void
    {
        $headOffice = Office::query()->where('code', 'HO')->value('id');
        $sr = $this->actingAsUser($this->requester)->postJson('/api/v1/service-requests', $this->requestPayload(['office_id' => $headOffice]))
            ->assertCreated()->json('data');

        $this->assertSame($headOffice, $sr['office']['id']);
    }
}
