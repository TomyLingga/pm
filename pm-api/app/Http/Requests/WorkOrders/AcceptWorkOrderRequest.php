<?php

namespace App\Http\Requests\WorkOrders;

use Illuminate\Foundation\Http\FormRequest;

class AcceptWorkOrderRequest extends FormRequest
{
    use WorkOrderItemRules;

    public function rules(): array
    {
        return [
            'acceptance' => ['required', 'in:yes,no'],
            'reason' => ['required_if:acceptance,no', 'nullable', 'string', 'max:1000'],
            'total_breakdown_hours' => ['nullable', 'numeric', 'min:0', 'max:9999'],
            'remarks' => ['nullable', 'string', 'max:2000'],
        ] + $this->clearanceRules('required_if:acceptance,yes');
    }

    public function attributes(): array
    {
        return [
            'acceptance' => 'penerimaan pengguna',
            'reason' => 'alasan penolakan',
            'total_breakdown_hours' => 'total breakdown',
            'clearance' => 'clearance checklist',
        ];
    }
}
