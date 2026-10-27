<?php

namespace App\Http\Requests\Settings;

use App\Services\Settings\MailSettingsService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateMailSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->isAdmin();
    }

    protected function failedAuthorization(): void
    {
        throw new AuthorizationException('Hanya admin yang dapat mengatur email notifikasi.');
    }

    public function rules(): array
    {
        return [
            'enabled' => ['required', 'boolean'],
            // Host name or IP only, e.g. smtp.office365.com (no smtp:// or port)
            'host' => ['nullable', 'required_if:enabled,true', 'string', 'max:255', 'regex:/^[A-Za-z0-9.-]+$/'],
            'port' => ['nullable', 'required_if:enabled,true', 'integer', 'between:1,65535'],
            'encryption' => ['nullable', Rule::in(MailSettingsService::ENCRYPTIONS)],
            'username' => ['nullable', 'string', 'max:255'],
            'password' => ['nullable', 'string', 'max:255'],
            'from_address' => ['nullable', 'required_if:enabled,true', 'email', 'max:255'],
            'from_name' => ['nullable', 'string', 'max:100'],
        ];
    }

    public function messages(): array
    {
        return [
            'required_if' => ':attribute wajib diisi bila email notifikasi diaktifkan.',
            'host.regex' => 'Host SMTP cukup nama server atau IP, tanpa http://, smtp://, atau port.',
        ];
    }

    public function attributes(): array
    {
        return [
            'enabled' => 'status email notifikasi',
            'host' => 'host SMTP',
            'port' => 'port SMTP',
            'encryption' => 'enkripsi',
            'from_address' => 'alamat pengirim',
            'from_name' => 'nama pengirim',
        ];
    }
}
