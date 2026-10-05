<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/** Electronic approval mark, printed as a QR code that links to a public verification page. */
class DocumentSignature extends Model
{
    protected $fillable = [
        'token',
        'document_number',
        'role_key',
        'role_label',
        'signer_id',
        'signer_name',
        'signer_nrk',
        'signer_position',
        'signed_at',
        'revoked_at',
    ];

    protected $casts = [
        'signed_at' => 'datetime',
        'revoked_at' => 'datetime',
    ];

    public function signable(): MorphTo
    {
        return $this->morphTo();
    }

    public function signer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'signer_id');
    }

    public function isValid(): bool
    {
        return $this->revoked_at === null;
    }

    public function verifyUrl(): string
    {
        return config('pm.web_url').'/verifikasi/'.$this->token;
    }
}
