<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\DocumentSignature;
use App\Models\WorkOrder;
use Illuminate\Http\JsonResponse;

/** Public QR verification (no login): shows who signed which document and when. */
class PublicSignatureController extends Controller
{
    public function show(string $token): JsonResponse
    {
        $signature = DocumentSignature::query()->where('token', $token)->with('signable')->firstOrFail();
        $document = $signature->signable;

        return response()->json(['data' => [
            'document_type_label' => $document instanceof WorkOrder ? 'Work Order' : 'Dokumen',
            'document_number' => $signature->document_number,
            'role_label' => $signature->role_label,
            'signer_name' => $signature->signer_name,
            'signer_nrk' => $signature->signer_nrk,
            'signer_position' => $signature->signer_position,
            'signed_at' => $signature->signed_at->toIso8601String(),
            'document_status_label' => $document instanceof WorkOrder ? $document->status->label() : null,
            'is_valid' => $signature->isValid() && $document !== null,
        ]]);
    }
}
