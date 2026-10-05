<?php

namespace App\Http\Requests\WorkOrders;

use Illuminate\Foundation\Http\FormRequest;

class SaveLaboursRequest extends FormRequest
{
    use WorkOrderItemRules;

    public function rules(): array
    {
        return ['labours' => ['present', 'array', 'max:30']] + $this->labourRules();
    }
}
