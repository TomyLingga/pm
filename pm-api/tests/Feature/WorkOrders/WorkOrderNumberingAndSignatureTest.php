<?php

namespace Tests\Feature\WorkOrders;

use App\Models\DocumentSignature;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\WorkOrderFixtures;
use Tests\TestCase;

class WorkOrderNumberingAndSignatureTest extends TestCase
{
    use RefreshDatabase;
    use WorkOrderFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpOrganization();
        Notification::fake();
    }

    public function test_numbers_use_section_code_roman_month_and_reset_yearly(): void
    {
        $this->travelTo(Carbon::parse('2026-03-10 08:00', 'Asia/Jakarta'));
        $this->assertSame('WO/IT/III/2026/0001', $this->createWorkOrder()['wo_number']);
        $this->assertSame('WO/MTC/III/2026/0001', $this->createWorkOrder([
            'executor_unit_id' => $this->mtc->id, 'service_category_id' => $this->mtcCategory->id, 'equipment_id' => null,
        ])['wo_number']);

        $this->travelTo(Carbon::parse('2026-12-31 23:00', 'Asia/Jakarta'));
        $this->assertSame('WO/IT/XII/2026/0002', $this->createWorkOrder()['wo_number'], 'sequence continues across months');

        $this->travelTo(Carbon::parse('2027-01-01 07:00', 'Asia/Jakarta'));
        $this->assertSame('WO/IT/I/2027/0001', $this->createWorkOrder()['wo_number'], 'sequence resets every year');
    }

    public function test_qr_signature_can_be_verified_publicly(): void
    {
        $wo = $this->createWorkOrder();
        $signature = DocumentSignature::query()->where('role_key', 'requested')->sole();
        $this->assertSame("http://pm.test/verifikasi/{$signature->token}", $wo['signatures'][0]['verify_url']);
        $this->assertGreaterThanOrEqual(40, strlen($signature->token), 'token is not guessable');

        app('auth')->forgetGuards();
        $this->getJson("/api/v1/public/signatures/{$signature->token}")
            ->assertOk()
            ->assertJsonPath('data.document_type_label', 'Work Order')
            ->assertJsonPath('data.document_number', $wo['wo_number'])
            ->assertJsonPath('data.role_label', 'Diminta Oleh')
            ->assertJsonPath('data.signer_name', 'Muhammad Adib Nugraha')
            ->assertJsonPath('data.signer_nrk', '119090170')
            ->assertJsonPath('data.document_status_label', 'DIAJUKAN')
            ->assertJsonPath('data.is_valid', true);

        $this->getJson('/api/v1/public/signatures/does-not-exist')->assertNotFound();
    }

    public function test_completion_signature_is_invalidated_when_user_rejects(): void
    {
        $wo = $this->completedWorkOrder();
        $completed = DocumentSignature::query()->where('role_key', 'completed')->sole();

        $this->action($this->requester, $wo['id'], 'accept', ['acceptance' => 'no', 'reason' => 'Masih rusak'])->assertOk();

        app('auth')->forgetGuards();
        $this->getJson("/api/v1/public/signatures/{$completed->token}")
            ->assertOk()
            ->assertJsonPath('data.is_valid', false)
            ->assertJsonPath('data.document_status_label', 'DIKERJAKAN');
    }
}
