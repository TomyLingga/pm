<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class MobileTotpRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'totp_token' => ['required', 'string', 'max:2000'],
            'code' => ['required', 'digits_between:6,8'],
            'device_name' => ['required', 'string', 'max:150'],
        ];
    }

    public function attributes(): array
    {
        return ['code' => 'kode autentikator'];
    }
}
