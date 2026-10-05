<?php

namespace App\Services\WorkOrders;

use App\Models\DocumentSignature;
use App\Models\ServiceCategory;
use App\Models\WorkOrder;
use App\Services\Documents\PdfRenderer;

/**
 * Renders a Work Order on the FM-BOPS-10/05 layout, with QR codes as electronic signatures.
 */
class WorkOrderPdf
{
    public function __construct(private PdfRenderer $renderer)
    {
    }

    public const VIEW = 'pdf.work-order';

    public function render(WorkOrder $workOrder): string
    {
        return $this->renderer->render(self::VIEW, $this->viewData($workOrder));
    }

    public function viewData(WorkOrder $workOrder): array
    {
        $workOrder->loadMissing([
            'executorUnit', 'serviceCategory', 'location', 'requester', 'materials', 'labours',
            'clearances.mtcConfirmedBy', 'clearances.userConfirmedBy', 'signatures', 'receivedBy', 'completedBy', 'acceptedBy',
        ]);

        $signatures = $workOrder->signatures
            ->filter(fn (DocumentSignature $s) => $s->isValid())
            ->keyBy('role_key')
            ->map(fn (DocumentSignature $s) => [
                'name' => $s->signer_name,
                'signed_at' => $s->signed_at,
                'qr' => $this->renderer->qrDataUri($s->verifyUrl(), 150),
            ]);

        $categories = ServiceCategory::query()
            ->where('executor_unit_id', $workOrder->executor_unit_id)
            ->where('for_work_order', true)
            ->where(fn ($q) => $q->where('is_active', true)->orWhere('id', $workOrder->service_category_id))
            ->withTrashed()
            ->orderBy('sort_order')->orderBy('name')
            ->get();

        return [
            'wo' => $workOrder,
            'doc' => config('pm.work_order.document'),
            'logo' => $this->renderer->imageDataUri(resource_path('pdf/inl-logo.png')),
            'categories' => $categories,
            'signatures' => $signatures,
            'rowCount' => max(3, $workOrder->materials->count(), $workOrder->labours->count()),
            'printedAt' => now(),
        ];
    }
}
