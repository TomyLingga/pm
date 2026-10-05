<?php

namespace Tests\Feature\ServiceRequests;

use App\Models\Attachment;
use App\Models\ServiceRequest;
use App\Notifications\DocumentNotification;
use App\Notifications\WorkOrderNotification;
use App\Services\ServiceRequests\ServiceRequestPdf;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use PhpOffice\PhpSpreadsheet\IOFactory;
use Tests\Concerns\ServiceRequestFixtures;
use Tests\TestCase;

/** WO ↔ Form Request conversion (Q-9), list/export and the INLHO/BSIS-ITC/F-004 PDF. */
class ServiceRequestConversionAndOutputTest extends TestCase
{
    use RefreshDatabase;
    use ServiceRequestFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpServiceRequests();
        Notification::fake();
        $this->travelTo(Carbon::parse('2026-10-06 09:00', 'Asia/Jakarta'));
    }

    public function test_lead_redirects_a_request_to_a_work_order(): void
    {
        $sr = $this->submittedRequest(['purpose' => 'Mouse tidak berfungsi']);
        $this->requestAction($this->superior, $sr['id'], 'approve')->assertOk();

        $this->requestAction($this->tech1, $sr['id'], 'convert-to-work-order', ['reason' => 'x'])->assertForbidden();
        $sr = $this->requestAction($this->itLead, $sr['id'], 'convert-to-work-order', ['reason' => 'Cukup pakai WO'])->assertOk()->json('data');

        $this->assertSame('converted', $sr['status']);
        $this->assertSame('Cukup pakai WO', $sr['conversion_reason']);
        $this->assertSame('cancelled', $this->stepStatuses($sr)['executor_lead']);
        $this->assertSame('WO/IT/X/2026/0001', $sr['converted_work_order']['wo_number']);

        $wo = $this->actingAsUser($this->requester)->getJson("/api/v1/work-orders/{$sr['converted_work_order']['id']}")->assertOk()->json('data');
        $this->assertSame('submitted', $wo['status']);
        $this->assertSame($this->requester->id, $wo['requester']['id']);
        $this->assertSame('Mouse tidak berfungsi', $wo['request_description']);
        $this->assertSame($sr['id'], $wo['source_service_request']['id']);
        Notification::assertSentTo($this->requester, DocumentNotification::class, fn ($n) => $n->event === 'service_request.converted');
        Notification::assertSentTo($this->tech1, WorkOrderNotification::class, fn ($n) => $n->event === 'work_order.created');

        // Only while waiting for the division
        $other = $this->submittedRequest();
        $this->requestAction($this->itLead, $other['id'], 'convert-to-work-order', ['reason' => 'x'])->assertStatus(409);
    }

    public function test_lead_redirects_a_costly_work_order_to_a_form_request_draft(): void
    {
        Storage::fake('local');
        $wo = $this->createWorkOrder(['request_description' => 'Ganti scanner baru', 'priority' => 'medium']);
        $this->actingAsUser($this->requester)->postJson("/api/v1/work-orders/{$wo['id']}/attachments", [
            'file' => UploadedFile::fake()->image('scanner.jpg'), 'collection' => 'photo_before',
        ])->assertCreated();

        $this->action($this->tech1, $wo['id'], 'convert-to-request', ['reason' => 'x'])->assertForbidden();
        $this->action($this->requester, $wo['id'], 'convert-to-request', ['reason' => 'x'])->assertForbidden();
        $this->actingAsUser($this->itLead)->getJson("/api/v1/work-orders/{$wo['id']}")->assertJsonPath('data.permissions.can_convert', true);

        $wo = $this->action($this->itLead, $wo['id'], 'convert-to-request', ['reason' => 'Biaya besar, gunakan Form Request'])
            ->assertOk()->json('data');
        $this->assertSame('converted', $wo['status']);
        $this->assertSame('DIALIHKAN KE FORM REQUEST', $wo['status_label']);
        $this->assertNull($wo['converted_service_request']['request_number'], 'a draft has no number yet');

        $draft = $this->actingAsUser($this->requester)->getJson("/api/v1/service-requests/{$wo['converted_service_request']['id']}")
            ->assertOk()->json('data');
        $this->assertSame('draft', $draft['status']);
        $this->assertSame($wo['id'], $draft['source_work_order']['id']);
        $this->assertStringContainsString('Ganti scanner baru', $draft['purpose']);
        $this->assertSame('medium', $draft['priority']);
        $this->assertSame('Sedang', $draft['priority_label']);
        $this->assertCount(1, $draft['attachments'], 'photos travel along');
        Notification::assertSentTo($this->requester, DocumentNotification::class, fn ($n) => $n->event === 'work_order.converted');

        // The requester completes and submits the draft
        $this->actingAsUser($this->requester)->putJson("/api/v1/service-requests/{$draft['id']}", $this->requestPayload())->assertOk();
        $this->requestAction($this->requester, $draft['id'], 'submit')->assertOk()->assertJsonPath('data.status', 'waiting_superior');

        // Shared photo file is kept as long as one document still references it
        $this->assertSame(2, Attachment::query()->count());
        $this->action($this->itLead, $wo['id'], 'convert-to-request', ['reason' => 'x'])->assertStatus(409);
    }

    public function test_list_scopes_filters_and_export(): void
    {
        $this->colleague->update(['superior_id' => $this->superior->id]);
        $mine = $this->submittedRequest();
        $draft = $this->createRequest(['priority' => 'low', 'purpose' => 'Akses VPN']);
        $colleagues = $this->submittedRequest(['purpose' => 'Laptop baru'], $this->colleague);

        $ids = fn (string $q, $as) => array_column($this->actingAsUser($as)->getJson('/api/v1/service-requests?'.$q)->assertOk()->json('data'), 'id');

        $this->assertEqualsCanonicalizing([$mine['id'], $draft['id']], $ids('scope=mine', $this->requester));
        $this->assertEqualsCanonicalizing([$mine['id'], $draft['id'], $colleagues['id']], $ids('scope=unit', $this->requester));
        $this->assertEqualsCanonicalizing([$mine['id'], $colleagues['id']], $ids('scope=executor', $this->tech1), 'drafts are hidden from executors');
        $this->assertSame([$draft['id']], $ids('scope=mine&status=draft', $this->requester));
        $this->assertSame([$draft['id']], $ids('scope=mine&q=vpn', $this->requester));
        $this->assertSame([$mine['id']], $ids('scope=mine&q=REQ0001', $this->requester));
        $this->actingAsUser($this->requester)->getJson('/api/v1/service-requests?scope=all')->assertForbidden();

        $list = $this->actingAsUser($this->requester)->getJson('/api/v1/service-requests?scope=mine&status=waiting_superior')->json('data');
        $this->assertSame('Atasan YBS', $list[0]['current_step']['label']);
        $this->assertSame('Head Office', $list[0]['office']['name']);

        $response = $this->actingAsUser($this->requester)->get('/api/v1/service-requests/export?scope=unit')->assertOk();
        $sheet = IOFactory::load($response->getFile()->getPathname())->getActiveSheet()->toArray();
        $this->assertSame('No. Request', $sheet[0][0]);
        $this->assertCount(4, $sheet);
        $this->assertContains('REQ0001/IT/X/2026', array_column($sheet, 0));
        $this->assertContains('DRAFT', array_column($sheet, 0));
    }

    public function test_pdf_mirrors_the_form_request_with_pengesahan_block(): void
    {
        $sr = $this->submittedRequest();
        $this->travelTo(Carbon::parse('2026-10-07 10:00', 'Asia/Jakarta'));
        $this->requestAction($this->superior, $sr['id'], 'approve')->assertOk();
        $this->requestAction($this->itLead, $sr['id'], 'approve', ['assigned_executor_id' => $this->tech1->id])->assertOk();
        $this->requestAction($this->tech1, $sr['id'], 'complete', ['executor_notes' => 'done'])->assertOk();

        $response = $this->actingAsUser($this->colleague)->get("/api/v1/service-requests/{$sr['id']}/pdf")
            ->assertOk()->assertHeader('Content-Type', 'application/pdf');
        $pdf = $response->getContent();
        $this->assertStringStartsWith('%PDF', $pdf);
        $this->assertSame(1, preg_match_all('#/Type\s*/Page[^s]#', $pdf), 'one page');
        $this->assertStringContainsString('/MediaBox [0.000 0.000 841.890 595.280]', $pdf, 'A4 landscape');
        $this->assertStringContainsString('inline; filename="REQ0001-IT-X-2026.pdf"', $response->headers->get('Content-Disposition'));

        $html = view(ServiceRequestPdf::VIEW, app(ServiceRequestPdf::class)->viewData(ServiceRequest::query()->findOrFail($sr['id'])))->render();
        foreach ([
            'INLHO/BSIS-ITC/F-004', '04-Mei-22', 'FORM REQUEST', 'REQ0001/IT/X/2026', 'Office:</b> Head Office',
            'KEPERLUAN', 'PENGESAHAN', 'YANG BERSANGKUTAN', 'Diminta oleh Muhammad Adib Nugraha pada 6 Oktober 2026',
            'ATASAN YBS', 'Disetujui oleh Indra Sakti Lubis pada 7 Oktober 2026', '085761959096',
            'MRG/SPV DIVISI', 'Disetujui oleh Oka Aritonang pada 7 Oktober 2026', 'FOREMAN DIVISI',
            'Diselesaikan oleh Tomy Lingga pada 7 Oktober 2026', '082178546887', 'JENIS PERMINTAAN', 'HARDWARE',
            'PETUNJUK DAN ATURAN', 'IT Security Policy INL', 'PRIORITAS', 'Tinggi', 'KETERANGAN', 'done',
            'IDENTITAS KARYAWAN', '119090170', 'Karyawan Tetap', 'Keuangan &amp; Pengadaan',
            'Untuk informasi, silakan menghubungi IT HP : 081260666418 Ext. 144', 'versi dokumen : 1/Agustus 2019',
        ] as $expected) {
            $this->assertStringContainsString($expected, $html, "PDF should contain [{$expected}]");
        }
        $this->assertSame(4, substr_count($html, '<img class="qr"'), 'a QR for each of the 4 PENGESAHAN rows');

        $this->actingAsUser($this->outsider)->get("/api/v1/service-requests/{$sr['id']}/pdf")->assertForbidden();
    }
}
