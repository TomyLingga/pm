<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/** Actions that only need a mandatory reason (cancel, convert). */
class ReasonRequest extends FormRequest
{
    public function rules(): array
    {
        return ['reason' => ['required', 'string', 'max:255']];
    }

    public function attributes(): array
    {
        return ['reason' => 'alasan'];
    }
}
