<?php

namespace App\Http\Requests\Pm;

use App\Enums\ChecklistInputType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreChecklistTemplateRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'executor_unit_id' => ['required', 'integer', Rule::exists('executor_units', 'id')->where('is_active', true)->whereNull('deleted_at')],
            'name' => ['required', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:2000'],
            'is_active' => ['nullable', 'boolean'],
            'items' => ['required', 'array', 'min:1', 'max:100'],
            'items.*.id' => ['nullable', 'integer'],
            'items.*.section' => ['nullable', 'string', 'max:100'],
            'items.*.description' => ['required', 'string', 'max:500'],
            'items.*.input_type' => ['required', Rule::in(ChecklistInputType::values())],
            'items.*.unit' => ['nullable', 'string', 'max:20'],
            'items.*.min_value' => ['nullable', 'numeric'],
            'items.*.max_value' => ['nullable', 'numeric'],
            'items.*.is_required' => ['nullable', 'boolean'],
            'items.*.photo_required' => ['nullable', 'boolean'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($v) {
            foreach ((array) $this->input('items', []) as $i => $item) {
                $min = $item['min_value'] ?? null;
                $max = $item['max_value'] ?? null;
                if (is_numeric($min) && is_numeric($max) && $min > $max) {
                    $v->errors()->add("items.{$i}.max_value", 'Batas maksimum harus lebih besar atau sama dengan batas minimum.');
                }
            }
        });
    }

    public function attributes(): array
    {
        return [
            'executor_unit_id' => 'unit pelaksana',
            'name' => 'nama template',
            'items' => 'butir checklist',
            'items.*.description' => 'uraian butir',
            'items.*.input_type' => 'jenis isian',
            'items.*.min_value' => 'batas minimum',
            'items.*.max_value' => 'batas maksimum',
        ];
    }
}
