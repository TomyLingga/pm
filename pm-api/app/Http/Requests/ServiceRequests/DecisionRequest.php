<?php

namespace App\Http\Requests\ServiceRequests;

use Illuminate\Foundation\Http\FormRequest;

/** Approve (notes optional) / reject & request revision (notes required). */
class DecisionRequest extends FormRequest
{
    public function rules(): array
    {
        $notes = $this->routeIs('*.approve') ? 'nullable' : 'required';

        return [
            'notes' => [$notes, 'string', 'max:1000'],
            'assigned_executor_id' => ['nullable', 'integer', 'exists:users,id'],
        ];
    }

    public function attributes(): array
    {
        return ['notes' => 'catatan', 'assigned_executor_id' => 'pelaksana'];
    }
}
