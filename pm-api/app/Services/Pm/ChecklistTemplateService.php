<?php

namespace App\Services\Pm;

use App\Exceptions\InvalidTransitionException;
use App\Models\ChecklistTemplate;
use App\Models\ChecklistTemplateItem;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

class ChecklistTemplateService
{
    public function create(array $data): ChecklistTemplate
    {
        return DB::transaction(function () use ($data) {
            $template = ChecklistTemplate::query()->create(Arr::only($data, ['executor_unit_id', 'name', 'description', 'is_active']));
            $this->syncItems($template, $data['items']);

            return $template;
        });
    }

    /** Changes apply to tasks that have not been started yet (items are copied at start). */
    public function update(ChecklistTemplate $template, array $data): ChecklistTemplate
    {
        return DB::transaction(function () use ($template, $data) {
            $template->update(Arr::only($data, ['name', 'description', 'is_active']));
            $this->syncItems($template, $data['items']);

            return $template;
        });
    }

    public function delete(ChecklistTemplate $template): void
    {
        if ($template->schedules()->exists()) {
            throw new InvalidTransitionException('Template masih dipakai jadwal PM. Ganti template pada jadwal tersebut terlebih dahulu.');
        }

        $template->delete();
    }

    public function duplicate(ChecklistTemplate $template): ChecklistTemplate
    {
        return DB::transaction(function () use ($template) {
            $copy = $template->replicate();
            $copy->name = mb_substr($template->name, 0, 138).' (salinan)';
            $copy->save();

            foreach ($template->items as $item) {
                $copy->items()->create($item->only(ChecklistTemplateItem::DEFINITION_COLUMNS));
            }

            return $copy;
        });
    }

    /** Rows with a known id are updated, rows without are created, missing rows are deleted; order = array order. */
    private function syncItems(ChecklistTemplate $template, array $rows): void
    {
        $existing = $template->items()->get()->keyBy('id');
        $kept = [];

        foreach (array_values($rows) as $order => $row) {
            $isNumber = ($row['input_type'] ?? null) === 'number';
            $attributes = [
                'sort_order' => $order,
                'section' => $row['section'] ?? null,
                'description' => $row['description'],
                'input_type' => $row['input_type'],
                'unit' => $isNumber ? ($row['unit'] ?? null) : null,
                'min_value' => $isNumber ? ($row['min_value'] ?? null) : null,
                'max_value' => $isNumber ? ($row['max_value'] ?? null) : null,
                'is_required' => (bool) ($row['is_required'] ?? true),
                'photo_required' => (bool) ($row['photo_required'] ?? false),
            ];

            $item = isset($row['id']) ? $existing->get($row['id']) : null;
            if ($item) {
                $item->update($attributes);
            } else {
                $item = $template->items()->create($attributes);
            }
            $kept[] = $item->id;
        }

        $template->items()->whereNotIn('id', $kept)->delete();
        $template->unsetRelation('items');
    }
}
