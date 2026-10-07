<?php

namespace App\Http\Resources;

use App\Enums\PmTaskStatus;
use App\Models\Equipment;
use App\Services\Pm\RecurrenceCalculator;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Gate;

/**
 * List shape by default; `->detail()` adds upcoming dates, task counts and permissions.
 *
 * @mixin \App\Models\PmSchedule
 */
class PmScheduleResource extends JsonResource
{
    public const RELATIONS = ['executorUnit', 'checklistTemplate', 'pic', 'equipment'];

    private bool $detail = false;

    public function detail(): static
    {
        $this->detail = true;

        return $this;
    }

    public function toArray($request): array
    {
        $nextDueAt = $this->tasks()
            ->whereIn('status', [PmTaskStatus::Scheduled->value, PmTaskStatus::Due->value])
            ->where('due_at', '>=', now())
            ->min('due_at');

        $data = [
            'id' => $this->id,
            'name' => $this->name,
            'is_active' => $this->is_active,
            'executor_unit' => [
                'id' => $this->executorUnit->id,
                'code' => $this->executorUnit->code,
                'display_name' => $this->executorUnit->display_name,
            ],
            'checklist_template' => ['id' => $this->checklistTemplate->id, 'name' => $this->checklistTemplate->name],
            'frequency_type' => $this->frequency_type->value,
            'frequency_interval' => $this->frequency_type->normalizeInterval($this->frequency_interval),
            'frequency_label' => $this->frequencyLabel(),
            'start_at' => $this->start_at->toIso8601String(),
            'end_at' => $this->end_at?->toIso8601String(),
            'tolerance_hours' => $this->tolerance_hours,
            'due_window_hours' => $this->configuredWindowHours(),
            'estimated_minutes' => $this->estimated_minutes,
            'pic' => new UserBriefResource($this->pic),
            'equipment' => $this->equipment->map(fn (Equipment $e) => ['id' => $e->id, 'code' => $e->code, 'name' => $e->name])->values(),
            'equipment_count' => $this->equipment->count(),
            'next_due_at' => $nextDueAt ? Carbon::parse($nextDueAt)->toIso8601String() : null,
            'generated_until' => $this->generated_until?->toIso8601String(),
        ];

        if (! $this->detail) {
            return $data;
        }

        $canManage = Gate::forUser($request->user())->allows('manage', $this->resource);
        $counts = $this->tasks()->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');
        $upcoming = $this->is_active ? app(RecurrenceCalculator::class)->next(
            $this->frequency_type, $this->frequency_interval, $this->start_at, $this->end_at, now()->subSecond(), 5
        ) : [];

        return $data + [
            'upcoming' => array_map(fn ($date) => $date->toIso8601String(), $upcoming),
            'task_counts' => collect(PmTaskStatus::values())->mapWithKeys(fn ($s) => [$s => (int) ($counts[$s] ?? 0)])->all(),
            'permissions' => ['can_update' => $canManage, 'can_delete' => $canManage],
        ];
    }
}
