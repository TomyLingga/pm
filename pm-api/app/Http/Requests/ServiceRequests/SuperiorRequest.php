<?php

namespace App\Http\Requests\ServiceRequests;

use Illuminate\Foundation\Http\FormRequest;

/** Submit (superior optional, defaults to Portal atasan) and change-superior (required). */
class SuperiorRequest extends FormRequest
{
    public function rules(): array
    {
        $required = $this->routeIs('*.change-superior') ? 'required' : 'nullable';

        return [
            'superior_id' => [$required, 'integer', 'exists:users,id'],
            'reason' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function attributes(): array
    {
        return ['superior_id' => 'atasan', 'reason' => 'alasan'];
    }
}
