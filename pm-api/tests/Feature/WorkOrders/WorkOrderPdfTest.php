<?php

namespace Tests\Feature\WorkOrders;

use App\Models\WorkOrder;
use App\Services\WorkOrders\WorkOrderPdf;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\WorkOrderFixtures;
use Tests\TestCase;

class WorkOrderPdfTest extends TestCase
{
    use RefreshDatabase;
    use WorkOrderFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpOrganization();
        Notification::fake();
    }

    public function test_pdf_is_a_single_a4_page(): void
    {
        $wo = $this->completedWorkOrder();
        $this->action($this->requester, $wo['id'], 'accept', $this->acceptPayload())->assertOk();

        $response = $this->actingAsUser($this->colleague)->get("/api/v1/work-orders/{$wo['id']}/pdf")
            ->assertOk()
            ->assertHeader('Content-Type', 'application/pdf');

        $pdf = $response->getContent();
        $this->assertStringStartsWith('%PDF', $pdf);
        $this->assertStringContainsString('inline; filename="WO-IT-', $response->headers->get('Content-Disposition'));
        $this->assertSame(1, preg_match_all('#/Type\s*/Page[^s]#', $pdf), 'form fits on one page (Halaman 1 dari 1)');
        $this->assertStringContainsString('/MediaBox [0.000 0.000 595.280 841.890]', $pdf, 'A4 portrait');
    }

    public function test_pdf_content_mirrors_the_paper_form(): void
    {
        $wo = $this->completedWorkOrder();
        $this->action($this->requester, $wo['id'], 'accept', $this->acceptPayload(['remarks' => 'Terima kasih']))->assertOk();

        $html = view(WorkOrderPdf::VIEW, app(WorkOrderPdf::class)->viewData(WorkOrder::query()->findOrFail($wo['id'])))->render();

        foreach ([
            'FORMULIR WORK ORDER', 'FM-BOPS-10/05', '09-Sept-25', $wo['wo_number'], 'Pengadaan',
            'SCN-01', 'Scanner Brother ADS-2200', 'Kantor Pengadaan', 'Scanner sering gagal membaca dokumen.',
            'Roller scanner dibersihkan dan driver diperbarui.', 'Maintenance Clearance Checklist', 'Area bersih',
            'Kabel LAN', 'Tomy Lingga', 'Terima kasih', 'Diminta Oleh', 'Diterima Oleh',
            'Pekerjaan Diselesaikan Oleh', 'Pekerjaan Diterima Oleh', 'Muhammad Adib Nugraha', '1,5 Jam',
        ] as $expected) {
            $this->assertStringContainsString(e($expected), $html, "PDF should contain [{$expected}]");
        }
        $this->assertSame(4, substr_count($html, '<img class="qr" src="data:image/png;base64'), '4 QR signatures');
        $this->assertStringContainsString('<span class="box">X</span>Hardware', $html, 'selected category is ticked');
        $this->assertStringContainsString('<span class="box">X</span>Tinggi', $html, 'priority is ticked');
    }

    public function test_outsider_cannot_print(): void
    {
        $wo = $this->createWorkOrder();
        $this->actingAsUser($this->outsider)->get("/api/v1/work-orders/{$wo['id']}/pdf")->assertForbidden();
    }
}
