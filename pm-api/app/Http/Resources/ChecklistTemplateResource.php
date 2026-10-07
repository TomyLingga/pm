<?php

namespace App\Http\Resources;

use App\Models\ChecklistTemplateItem;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Gate;

/**
 * List shape by default; the detail shape (items + permissions) when `items` is loaded.
 *
 * @mixin \App\Models\ChecklistTemplate
 */
class ChecklistTemplateResource extends JsonResource
{
    public function toArray($request): array
    {
        $data = [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'is_active' => $this->is_active,
            'executor_unit' => [
                'id' => $this->executorUnit->id,
                'code' => $this->executorUnit->code,
                'display_name' => $this->executorUnit->display_name,
            ],
            'items_count' => (int) ($this->items_count ?? $this->items()->count()),
            'schedules_count' => (int) ($this->schedules_count ?? $this->schedules()->count()),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];

        if ($this->relationLoaded('items')) {
            $canManage = Gate::forUser($request->user())->allows('manage', $this->resource);
            $data['items'] = $this->items->map(fn (ChecklistTemplateItem $item) => self::definition($item))->values();
            $data['permissions'] = ['can_update' => $canManage, 'can_delete' => $canManage];
        }

        return $data;
    }

    /** ChecklistItemDef of the contract. */
    public static function definition(ChecklistTemplateItem $item): array
    {
        return [
            'id' => $item->id,
            'sort_order' => $item->sort_order,
            'section' => $item->section,
            'description' => $item->description,
            'input_type' => $item->input_type,
            'unit' => $item->unit,
            'min_value' => $item->min_value,
            'max_value' => $item->max_value,
            'is_required' => $item->is_required,
            'photo_required' => $item->photo_required,
        ];
    }
}
