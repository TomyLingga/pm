<?php

namespace App\Services\Documents;

use App\Models\DocumentSignature;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/**
 * Electronic signatures printed as QR codes (verification page: /verifikasi/{token}).
 */
class SignatureService
{
    /** Sign a role on a document; an earlier valid signature for the same role is revoked. */
    public function sign(Model $document, string $documentNumber, string $roleKey, string $roleLabel, User $signer): DocumentSignature
    {
        $this->revoke($document, $roleKey);

        $signature = new DocumentSignature([
            'token' => Str::random(40),
            'document_number' => $documentNumber,
            'role_key' => $roleKey,
            'role_label' => $roleLabel,
            'signer_id' => $signer->id,
            'signer_name' => $signer->name,
            'signer_nrk' => $signer->nrk,
            'signer_position' => $signer->position,
            'signed_at' => now(),
        ]);
        $signature->signable()->associate($document);
        $signature->save();

        return $signature;
    }

    public function revoke(Model $document, string $roleKey): void
    {
        DocumentSignature::query()
            ->where('signable_type', $document->getMorphClass())
            ->where('signable_id', $document->getKey())
            ->where('role_key', $roleKey)
            ->whereNull('revoked_at')
            ->update(['revoked_at' => now()]);
    }
}
