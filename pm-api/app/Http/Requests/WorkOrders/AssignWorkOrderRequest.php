<?php

namespace App\Http\Requests\WorkOrders;

use App\Enums\Priority;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Receive (assign technicians) and reassign. */
class AssignWorkOrderRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'assignee_ids' => ['required', 'array', 'min:1', 'max:20'],
            'assignee_ids.*' => ['integer', 'distinct', 'exists:users,id'],
            'lead_id' => ['required', 'integer'],
            'priority' => ['nullable', Rule::in(Priority::values())],
        ];
    }

    public function attributes(): array
    {
        return ['assignee_ids' => 'teknisi', 'lead_id' => 'ketua tim', 'priority' => 'prioritas'];
    }
}
