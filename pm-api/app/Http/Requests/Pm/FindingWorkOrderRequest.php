<?php

namespace App\Http\Requests\Pm;

use App\Enums\Priority;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** "Buat WO dari temuan": the Work Order goes to the task's own unit unless another executor is chosen. */
class FindingWorkOrderRequest extends FormRequest
{
    public function rules(): array
    {
        $executorUnitId = (int) ($this->input('executor_unit_id') ?: $this->route('pmTask')->executor_unit_id);

        return [
            'executor_unit_id' => [
                'nullable', 'integer',
                Rule::exists('executor_units', 'id')->where('is_active', true)->where('accepts_work_orders', true)->whereNull('deleted_at'),
            ],
            'service_category_id' => [
                'required', 'integer',
                Rule::exists('service_categories', 'id')->where('executor_unit_id', $executorUnitId)
                    ->where('for_work_order', true)->where('is_active', true)->whereNull('deleted_at'),
            ],
            'category_note' => ['nullable', 'string', 'max:150'],
            'priority' => ['required', Rule::in(Priority::values())],
            'request_description' => ['nullable', 'string', 'max:5000'],
        ];
    }

    public function attributes(): array
    {
        return [
            'executor_unit_id' => 'unit pelaksana',
            'service_category_id' => 'kategori',
            'priority' => 'prioritas',
            'request_description' => 'permintaan pekerjaan',
        ];
    }
}
