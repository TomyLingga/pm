<?php

namespace App\Services\ServiceRequests;

use App\Models\ApprovalStep;
use App\Models\DocumentSignature;
use App\Models\ServiceRequest;
use App\Services\Documents\PdfRenderer;

/**
 * Renders a Form Request on the INLHO/BSIS-ITC/F-004 layout (A4 landscape) with a QR per approval in "PENGESAHAN".
 */
class ServiceRequestPdf
{
    public const VIEW = 'pdf.service-request';

    public function __construct(private PdfRenderer $renderer)
    {
    }

    public function render(ServiceRequest $request): string
    {
        return $this->renderer->render(self::VIEW, $this->viewData($request), 'A4', 'landscape');
    }

    public function viewData(ServiceRequest $request): array
    {
        $request->loadMissing(['executorUnit', 'serviceCategory', 'office', 'requester.orgUnit', 'superior', 'approvalSteps', 'signatures']);

        $steps = $request->approvalSteps->filter(fn (ApprovalStep $s) => $s->round === $request->revision_no)->keyBy('step_key');
        $signatures = $request->signatures->filter(fn (DocumentSignature $s) => $s->isValid())->keyBy('role_key');

        $rows = [];
        foreach (ServiceRequestService::STEPS as $key => $meta) {
            $step = $steps->get($key);
            $signature = $signatures->get($key);
            $rows[] = [
                'caption' => match ($key) {
                    ServiceRequestService::STEP_SUBMISSION => 'YANG BERSANGKUTAN',
                    ServiceRequestService::STEP_SUPERIOR => 'ATASAN YBS',
                    ServiceRequestService::STEP_EXECUTOR_LEAD => 'MRG/SPV DIVISI',
                    default => 'FOREMAN DIVISI',
                },
                'verb' => $meta['verb'],
                'step' => $step,
                'signed' => $step && $step->status->isPositive(),
                'qr' => $signature ? $this->renderer->qrDataUri($signature->verifyUrl(), 120) : null,
            ];
        }

        return [
            'sr' => $request,
            'doc' => config('pm.service_request.document'),
            'logo' => $this->renderer->imageDataUri(resource_path('pdf/inl-logo.png')),
            'rows' => $rows,
            'rules' => $request->submitted_at ? $request->rules_snapshot : $request->executorUnit->request_rules,
            'footer' => $request->submitted_at ? $request->contact_footer_snapshot : $request->executorUnit->contact_footer,
            'printedAt' => now(),
        ];
    }
}
