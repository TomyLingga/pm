<?php

namespace App\Services\Pm;

use App\Enums\PmTaskStatus;
use App\Models\PmSchedule;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Creates PM tasks (one per equipment per occurrence) up to the schedule's horizon.
 *
 * Idempotent: the unique key (schedule, equipment, due_at) plus INSERT … ON CONFLICT DO NOTHING means
 * running it twice — or concurrently — never creates a duplicate task.
 */
class PmTaskGenerator
{
    public function __construct(private RecurrenceCalculator $calculator)
    {
    }

    /** Generate for every active schedule. Returns the number of tasks created. */
    public function generateAll(?CarbonImmutable $now = null): int
    {
        $created = 0;

        PmSchedule::query()->where('is_active', true)->orderBy('id')
            ->each(function (PmSchedule $schedule) use (&$created, $now) {
                $created += $this->generate($schedule, $now);
            });

        return $created;
    }

    /** Generate the tasks of one schedule from where the previous run stopped up to the horizon. */
    public function generate(PmSchedule $schedule, ?CarbonImmutable $now = null): int
    {
        if (! $schedule->is_active || $schedule->trashed()) {
            return 0;
        }

        $now ??= CarbonImmutable::now();
        $horizon = $now->addDays($schedule->horizonDays());
        $from = $schedule->generated_until
            ? CarbonImmutable::instance($schedule->generated_until)->addSecond()
            : $this->initialFrom($schedule, $now);

        if ($from->greaterThan($horizon)) {
            return 0;
        }

        $dates = $this->calculator->between(
            $schedule->frequency_type, $schedule->frequency_interval, $schedule->start_at, $schedule->end_at, $from, $horizon
        );
        $equipmentIds = $schedule->equipment()->pluck('equipment.id')->all();

        $rows = [];
        foreach ($dates as $dueAt) {
            $windowAt = $this->calculator->dueWindowAt($dueAt, $schedule->windowHours());
            $base = [
                'pm_schedule_id' => $schedule->id,
                'executor_unit_id' => $schedule->executor_unit_id,
                'checklist_template_id' => $schedule->checklist_template_id,
                'pic_user_id' => $schedule->pic_user_id,
                'due_at' => $dueAt,
                'due_window_at' => $windowAt,
                'overdue_at' => $this->calculator->overdueAt($dueAt, $schedule->tolerance_hours),
                // Tasks created inside their window start as JATUH_TEMPO right away.
                'status' => ($windowAt->lessThanOrEqualTo($now) ? PmTaskStatus::Due : PmTaskStatus::Scheduled)->value,
                'created_at' => $now,
                'updated_at' => $now,
            ];
            foreach ($equipmentIds as $equipmentId) {
                $rows[] = $base + ['equipment_id' => $equipmentId];
            }
        }

        $created = 0;
        foreach (array_chunk($rows, 500) as $chunk) {
            $created += DB::table('pm_tasks')->insertOrIgnore($chunk);
        }

        $schedule->forceFill(['generated_until' => $horizon])->saveQuietly();

        return $created;
    }

    /**
     * After a schedule changed: drop the tasks nobody has touched yet (TERJADWAL) and generate again.
     * Tasks that are already JATUH_TEMPO, in progress, done or skipped are kept.
     */
    public function regenerate(PmSchedule $schedule, ?CarbonImmutable $now = null): int
    {
        $this->removeScheduledTasks($schedule);
        $schedule->forceFill(['generated_until' => null])->saveQuietly();

        return $this->generate($schedule, $now);
    }

    public function removeScheduledTasks(PmSchedule $schedule): int
    {
        return $schedule->tasks()->where('status', PmTaskStatus::Scheduled->value)->delete();
    }

    /**
     * Where the very first generation starts: the schedule start, or — when that is already in the
     * past — the current cycle if it began today (so "start today 08:00" created at 10:00 still gets
     * today's task), otherwise now.
     */
    private function initialFrom(PmSchedule $schedule, CarbonImmutable $now): CarbonImmutable
    {
        $start = CarbonImmutable::instance($schedule->start_at);
        if ($start->greaterThanOrEqualTo($now)) {
            return $start;
        }

        $current = $this->calculator->previous($schedule->frequency_type, $schedule->frequency_interval, $start, $now);

        return $current && $current->greaterThanOrEqualTo($now->startOfDay()) ? $current : $now;
    }
}
