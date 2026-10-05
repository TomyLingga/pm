<?php

namespace App\Http\Requests\WorkOrders;

use Illuminate\Foundation\Http\FormRequest;

class CompleteWorkOrderRequest extends FormRequest
{
    use WorkOrderItemRules;

    public function rules(): array
    {
        return [
            'work_done' => ['required', 'string', 'max:5000'],
            'materials' => ['sometimes', 'array', 'max:50'],
            'labours' => ['sometimes', 'array', 'max:30'],
            'remarks' => ['nullable', 'string', 'max:2000'],
        ] + $this->materialRules() + $this->labourRules() + $this->clearanceRules();
    }

    public function attributes(): array
    {
        return ['work_done' => 'pekerjaan perbaikan selesai', 'clearance' => 'clearance checklist'];
    }
}
