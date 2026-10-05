<?php

namespace App\Http\Requests\ServiceRequests;

use App\Enums\Priority;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Create / update a Form Request draft. */
class StoreServiceRequestRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'executor_unit_id' => [
                'required', 'integer',
                Rule::exists('executor_units', 'id')->where('is_active', true)->where('accepts_requests', true)->whereNull('deleted_at'),
            ],
            'service_category_id' => [
                'required', 'integer',
                Rule::exists('service_categories', 'id')
                    ->where('executor_unit_id', (int) $this->input('executor_unit_id'))
                    ->where('for_request', true)->where('is_active', true)->whereNull('deleted_at'),
            ],
            'office_id' => ['required', 'integer', Rule::exists('offices', 'id')->where('is_active', true)->whereNull('deleted_at')],
            'purpose' => ['required', 'string', 'max:5000'],
            'priority' => ['required', Rule::in(Priority::values())],
            'estimated_cost' => ['nullable', 'numeric', 'min:0', 'max:9999999999999'],
            'superior_id' => ['nullable', 'integer', Rule::exists('users', 'id')->where('is_active', true)],
        ];
    }

    public function attributes(): array
    {
        return [
            'executor_unit_id' => 'unit pelaksana',
            'service_category_id' => 'jenis permintaan',
            'office_id' => 'office',
            'purpose' => 'keperluan',
            'priority' => 'prioritas',
            'estimated_cost' => 'estimasi biaya',
            'superior_id' => 'atasan',
        ];
    }
}
