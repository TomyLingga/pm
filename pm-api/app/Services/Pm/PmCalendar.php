<?php

namespace App\Services\Pm;

use App\Http\Resources\UserBriefResource;
use App\Models\Equipment;
use App\Models\PmSchedule;
use App\Models\PmTask;
use App\Models\User;
use App\Services\Org\ExecutorDirectory;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;

/**
 * Calendar feed: generated tasks in the range plus "projected" occurrences that lie beyond
 * the generation horizon (Q-15), so the calendar is never empty further ahead.
 */
class PmCalendar
{
    public const MAX_RANGE_DAYS = 62;
    private const MAX_PROJECTIONS = 1500;

    public function __construct(
        private PmTaskQuery $tasks,
        private RecurrenceCalculator $calculator,
        private ExecutorDirectory $directory,
    ) {
    }

    public function events(User $user, CarbonImmutable $start, CarbonImmutable $end, array $filters): array
    {
        $scope = $filters['scope'] ?? ($this->directory->isStaffAnywhere($user) ? 'unit' : 'all');
        $filter = fn (Builder $q) => $q
            ->when($filters['executor_unit_id'] ?? null, fn (Builder $w, $id) => $w->where('executor_unit_id', $id))
            ->when($filters['pic_user_id'] ?? null, fn (Builder $w, $id) => $w->where('pic_user_id', $id));

        $tasks = $filter($this->tasks->scoped($user, $scope))
            ->when($filters['equipment_id'] ?? null, fn (Builder $w, $id) => $w->where('equipment_id', $id))
            ->whereBetween('due_at', [$start, $end])
            ->with(['schedule', 'equipment', 'pic'])
            ->orderBy('due_at')->orderBy('id')
            ->get();

        $events = $tasks->map(fn (PmTask $task) => [
            'key' => "t-{$task->id}",
            'task_id' => $task->id,
            'projected' => false,
            'schedule_id' => $task->pm_schedule_id,
            'schedule_name' => $task->schedule->name,
            'equipment' => $this->equipment($task->equipment),
            'due_at' => $task->due_at->toIso8601String(),
            'status' => $task->status->value,
            'status_label' => $task->status->label(),
            'is_late' => $task->is_late,
            'pic' => (new UserBriefResource($task->pic))->toArray(request()),
        ])->all();

        return array_merge($events, $this->projections($user, $scope, $start, $end, $filters, $filter));
    }

    private function projections(User $user, string $scope, CarbonImmutable $start, CarbonImmutable $end, array $filters, callable $filter): array
    {
        $schedules = $filter(PmSchedule::query()->where('is_active', true))
            ->when($scope === 'unit', fn (Builder $q) => $q->whereIn('executor_unit_id', $this->directory->unitIdsFor($user) ?: [0]))
            ->when($scope === 'mine', fn (Builder $q) => $q->where('pic_user_id', $user->id))
            ->where(fn (Builder $q) => $q->whereNull('generated_until')->orWhere('generated_until', '<', $end))
            ->with(['equipment', 'pic'])
            ->get();

        $events = [];
        foreach ($schedules as $schedule) {
            // Everything up to generated_until already exists as real tasks.
            $from = $schedule->generated_until
                ? CarbonImmutable::instance($schedule->generated_until)->addSecond()
                : CarbonImmutable::now();
            $from = $from->greaterThan($start) ? $from : $start;

            $dates = $this->calculator->between(
                $schedule->frequency_type, $schedule->frequency_interval, $schedule->start_at, $schedule->end_at, $from, $end,
                self::MAX_PROJECTIONS
            );
            $pic = (new UserBriefResource($schedule->pic))->toArray(request());

            foreach ($dates as $date) {
                foreach ($schedule->equipment as $equipment) {
                    if (! empty($filters['equipment_id']) && (int) $filters['equipment_id'] !== (int) $equipment->id) {
                        continue;
                    }
                    if (count($events) >= self::MAX_PROJECTIONS) {
                        return $events;
                    }
                    $events[] = [
                        'key' => "p-{$schedule->id}-{$equipment->id}-".$date->format('Y-m-d\TH:i'),
                        'task_id' => null,
                        'projected' => true,
                        'schedule_id' => $schedule->id,
                        'schedule_name' => $schedule->name,
                        'equipment' => $this->equipment($equipment),
                        'due_at' => $date->toIso8601String(),
                        'status' => 'projected',
                        'status_label' => 'PROYEKSI',
                        'is_late' => false,
                        'pic' => $pic,
                    ];
                }
            }
        }

        return $events;
    }

    private function equipment(Equipment $equipment): array
    {
        return ['id' => $equipment->id, 'code' => $equipment->code, 'name' => $equipment->name];
    }
}
