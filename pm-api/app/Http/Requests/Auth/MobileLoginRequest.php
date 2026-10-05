<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class MobileLoginRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'login' => ['required', 'string', 'max:150'],
            'password' => ['required', 'string', 'max:200'],
            'device_name' => ['required', 'string', 'max:150'],
        ];
    }

    public function attributes(): array
    {
        return ['login' => 'email atau NRK', 'password' => 'password', 'device_name' => 'nama perangkat'];
    }
}
