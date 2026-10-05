<?php

namespace App\Http\Requests\ServiceRequests;

use Illuminate\Foundation\Http\FormRequest;

class CompleteServiceRequestRequest extends FormRequest
{
    public function rules(): array
    {
        return ['executor_notes' => ['required', 'string', 'max:2000']];
    }

    public function attributes(): array
    {
        return ['executor_notes' => 'keterangan'];
    }
}
