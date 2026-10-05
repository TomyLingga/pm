<?php

namespace App\Http\Requests\WorkOrders;

use Illuminate\Foundation\Http\FormRequest;

class SaveMaterialsRequest extends FormRequest
{
    use WorkOrderItemRules;

    public function rules(): array
    {
        return ['materials' => ['present', 'array', 'max:50']] + $this->materialRules();
    }
}
