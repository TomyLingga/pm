<?php

namespace App\Http\Requests\Pm;

use App\Enums\ChecklistResult;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Save checklist answers (PUT items), materials (PUT materials) and complete (POST complete). */
class PmTaskAnswersRequest extends FormRequest
{
    public function rules(): array
    {
        $itemsRule = $this->routeIs('pm-tasks.items') ? 'required' : 'nullable';
        $materialsRule = $this->routeIs('pm-tasks.materials') ? 'present' : 'nullable';

        return [
            'items' => [$itemsRule, 'array', 'max:200'],
            'items.*.id' => ['required', 'integer'],
            'items.*.result' => ['nullable', Rule::in(ChecklistResult::values())],
            'items.*.value_number' => ['nullable', 'numeric', 'between:-9999999999,9999999999'],
            'items.*.value_text' => ['nullable', 'string', 'max:2000'],
            'items.*.notes' => ['nullable', 'string', 'max:2000'],

            'materials' => [$materialsRule, 'array', 'max:50'],
            'materials.*.material_id' => ['nullable', 'integer', 'exists:materials,id'],
            'materials.*.material_name' => ['required_without:materials.*.material_id', 'nullable', 'string', 'max:150'],
            'materials.*.quantity' => ['required', 'numeric', 'gt:0', 'max:999999'],
            'materials.*.unit' => ['required_without:materials.*.material_id', 'nullable', 'string', 'max:20'],

            'duration_minutes' => ['nullable', 'integer', 'min:1', 'max:100000'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    public function attributes(): array
    {
        return [
            'items' => 'butir checklist',
            'items.*.result' => 'hasil',
            'items.*.value_number' => 'nilai',
            'duration_minutes' => 'durasi',
            'notes' => 'catatan',
        ];
    }
}
