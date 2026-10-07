<?php

namespace App\Http\Requests\Pm;

use App\Enums\PmFrequency;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Create / update a PM schedule; also used (subset) for the preview endpoint. */
class StorePmScheduleRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:150'],
            'executor_unit_id' => ['required', 'integer', Rule::exists('executor_units', 'id')->where('is_active', true)->whereNull('deleted_at')],
            'checklist_template_id' => ['required', 'integer', Rule::exists('checklist_templates', 'id')->whereNull('deleted_at')],
            'equipment_ids' => ['required', 'array', 'min:1', 'max:200'],
            'equipment_ids.*' => ['integer', 'distinct', Rule::exists('equipment', 'id')->whereNull('deleted_at')],
            'pic_user_id' => ['required', 'integer', Rule::exists('users', 'id')->where('is_active', true)],
            'tolerance_hours' => ['required', 'integer', 'min:0', 'max:8760'],
            'due_window_hours' => ['nullable', 'integer', 'min:1', 'max:720'],
            'estimated_minutes' => ['nullable', 'integer', 'min:1', 'max:10080'],
            'is_active' => ['nullable', 'boolean'],
        ] + self::recurrenceRules($this->input('frequency_type'));
    }

    /** Rules shared with the preview endpoint. */
    public static function recurrenceRules(?string $frequencyType): array
    {
        [$min, $max] = PmFrequency::tryFrom((string) $frequencyType)?->intervalRange() ?? [1, 365];

        return [
            'frequency_type' => ['required', Rule::in(PmFrequency::values())],
            'frequency_interval' => ['required', 'integer', "min:{$min}", "max:{$max}"],
            'start_at' => ['required', 'date'],
            'end_at' => ['nullable', 'date', 'after:start_at'],
        ];
    }

    protected function prepareForValidation(): void
    {
        // "Harian" has no interval input; it is always 1.
        if ($this->input('frequency_type') === PmFrequency::Daily->value) {
            $this->merge(['frequency_interval' => 1]);
        }
    }

    public function attributes(): array
    {
        return [
            'name' => 'nama jadwal',
            'executor_unit_id' => 'unit pelaksana',
            'checklist_template_id' => 'template checklist',
            'equipment_ids' => 'equipment',
            'pic_user_id' => 'PIC',
            'frequency_type' => 'frekuensi',
            'frequency_interval' => 'interval',
            'start_at' => 'tanggal mulai',
            'end_at' => 'tanggal berakhir',
            'tolerance_hours' => 'toleransi',
            'due_window_hours' => 'jendela jatuh tempo',
        ];
    }
}
