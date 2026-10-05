<?php

namespace App\Http\Requests\WorkOrders;

use App\Enums\Priority;
use App\Models\ServiceCategory;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/** Used for both create and update (PUT) of a Work Order. */
class StoreWorkOrderRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'executor_unit_id' => [
                'required', 'integer',
                Rule::exists('executor_units', 'id')->where('is_active', true)->where('accepts_work_orders', true)->whereNull('deleted_at'),
            ],
            'service_category_id' => [
                'required', 'integer',
                Rule::exists('service_categories', 'id')
                    ->where('executor_unit_id', (int) $this->input('executor_unit_id'))
                    ->where('for_work_order', true)->where('is_active', true)->whereNull('deleted_at'),
            ],
            'category_note' => ['nullable', 'string', 'max:150'],
            'equipment_id' => ['nullable', 'integer', Rule::exists('equipment', 'id')->whereNull('deleted_at')],
            'equipment_code' => ['nullable', 'string', 'max:50'],
            'equipment_name' => ['nullable', 'string', 'max:150'],
            'location_id' => ['nullable', 'integer', Rule::exists('locations', 'id')->whereNull('deleted_at')],
            'location_note' => ['nullable', 'string', 'max:150'],
            'request_description' => ['required', 'string', 'max:5000'],
            'priority' => ['required', Rule::in(Priority::values())],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $v) {
            $category = ServiceCategory::query()->find($this->input('service_category_id'));
            if ($category?->requires_note && blank($this->input('category_note'))) {
                $v->errors()->add('category_note', 'Keterangan kategori wajib diisi untuk kategori '.$category->name.'.');
            }
        });
    }

    public function attributes(): array
    {
        return [
            'executor_unit_id' => 'unit pelaksana',
            'service_category_id' => 'kategori',
            'request_description' => 'permintaan pekerjaan',
            'priority' => 'prioritas',
            'equipment_id' => 'alat',
            'location_id' => 'lokasi',
        ];
    }
}
