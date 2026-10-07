<?php

namespace App\Http\Requests;

use App\Models\Equipment;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreEquipmentRequest extends FormRequest
{
    public function rules(): array
    {
        $equipment = $this->route('equipment');

        return [
            'code' => ['required', 'string', 'max:50', Rule::unique('equipment', 'code')->ignore($equipment?->id)],
            'name' => ['required', 'string', 'max:150'],
            'location_id' => ['nullable', 'integer', Rule::exists('locations', 'id')->whereNull('deleted_at')],
            'executor_unit_id' => ['nullable', 'integer', Rule::exists('executor_units', 'id')->whereNull('deleted_at')],
            'brand' => ['nullable', 'string', 'max:100'],
            'model' => ['nullable', 'string', 'max:100'],
            'serial_number' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', Rule::in(array_keys(Equipment::STATUSES))],
        ];
    }

    public function attributes(): array
    {
        return [
            'code' => 'no. alat',
            'name' => 'nama alat',
            'location_id' => 'lokasi',
            'executor_unit_id' => 'unit penanggung jawab',
            'serial_number' => 'nomor seri',
        ];
    }
}
