<?php

namespace App\Http\Requests;

use App\Models\Attachment;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreAttachmentRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'file' => ['required', 'file', 'mimes:'.implode(',', config('pm.attachments.mimes')), 'max:'.config('pm.attachments.max_kb')],
            'collection' => ['required', Rule::in(Attachment::COLLECTIONS)],
        ];
    }

    public function attributes(): array
    {
        return ['file' => 'berkas', 'collection' => 'jenis lampiran'];
    }
}
