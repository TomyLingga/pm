<?php

namespace App\Services\Pm;

use App\Enums\PmTaskStatus;
use App\Models\PmTask;
use App\Services\Audit\StatusLogger;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Time-based part of the PM task state machine (run by `pm:check-overdue`):
 *
 *   1. auto-skip   an open task is DILEWATI by the system once the next occurrence is due
 *   2. scheduled → due      when the task enters its window (default H-2) + "upcoming" reminder
 *   3. H-0 reminder         at due_at
 *   4. due → overdue        after due_at + tolerance, PIC and leads are alerted
 *   5. overdue reminder     repeated every `overdue_reminder_hours`
 *
 * Every reminder is stamped on the task, so re-running never notifies twice.
 */
class PmStatusRefresher
{
    public const AUTO_SKIP_REASON = 'Terlewati otomatis oleh jadwal berikutnya';

    public function __construct(
        private PmNotifier $notifier,
        private StatusLogger $logger,
    ) {
    }

    /** @return array{skipped: int, due: int, overdue: int, upcoming_reminders: int, due_reminders: int, overdue_reminders: int} */
    public function run(?CarbonImmutable $now = null): array
    {
        $now ??= CarbonImmutable::now();

        return [
            'skipped' => $this->autoSkip($now),
            'due' => $this->markDue($now),
            'upcoming_reminders' => $this->remindUpcoming($now),
            'due_reminders' => $this->remindDue($now),
            'overdue' => $this->markOverdue($now),
            'overdue_reminders' => $this->remindOverdue($now),
        ];
    }

    /** Untouched tasks whose next occurrence (same schedule and equipment) has already come due. */
    private function autoSkip(CarbonImmutable $now): int
    {
        $tasks = PmTask::query()
            ->whereIn('status', [PmTaskStatus::Due->value, PmTaskStatus::Overdue->value])
            ->whereExists(fn ($q) => $q->select(DB::raw(1))->from('pm_tasks as later')
                ->whereColumn('later.pm_schedule_id', 'pm_tasks.pm_schedule_id')
                ->whereColumn('later.equipment_id', 'pm_tasks.equipment_id')
                ->whereColumn('later.due_at', '>', 'pm_tasks.due_at')
                ->where('later.due_at', '<=', $now))
            ->orderBy('id')
            ->get();

        foreach ($tasks as $task) {
            $from = $task->status;
            $task->fill([
                'status' => PmTaskStatus::Skipped,
                'skip_reason' => self::AUTO_SKIP_REASON,
                'skipped_by_id' => null,
                'skipped_at' => $now,
            ])->save();
            $this->logger->log($task, 'auto_skip', $from, $task->status, null, self::AUTO_SKIP_REASON);
        }

        return $tasks->count();
    }

    private function markDue(CarbonImmutable $now): int
    {
        return $this->transition(
            PmTask::query()->where('status', PmTaskStatus::Scheduled->value)->where('due_window_at', '<=', $now),
            PmTaskStatus::Due, 'due'
        )->count();
    }

    /** Early reminder for tasks that entered the window but are not due yet. */
    private function remindUpcoming(CarbonImmutable $now): int
    {
        $tasks = PmTask::query()
            ->where('status', PmTaskStatus::Due->value)
            ->whereNull('reminder_upcoming_sent_at')
            ->where('due_at', '>', $now)
            ->with('schedule')
            ->get()
            ->filter(fn (PmTask $task) => $task->schedule?->sendsUpcomingReminder());

        return $this->notifyGrouped($tasks, 'upcoming', ['reminder_upcoming_sent_at' => $now]);
    }

    private function remindDue(CarbonImmutable $now): int
    {
        $tasks = PmTask::query()
            ->where('status', PmTaskStatus::Due->value)
            ->whereNull('reminder_due_sent_at')
            ->where('due_at', '<=', $now)
            ->where('overdue_at', '>=', $now) // already past tolerance → the overdue alert covers it
            ->get();

        // A task announced as due no longer needs the early reminder.
        return $this->notifyGrouped($tasks, 'due', ['reminder_due_sent_at' => $now, 'reminder_upcoming_sent_at' => $now]);
    }

    private function markOverdue(CarbonImmutable $now): int
    {
        $tasks = $this->transition(
            PmTask::query()->where('status', PmTaskStatus::Due->value)->where('overdue_at', '<', $now),
            PmTaskStatus::Overdue, 'overdue'
        );

        return $this->notifyGrouped($tasks, 'overdue', ['last_overdue_reminder_at' => $now]);
    }

    private function remindOverdue(CarbonImmutable $now): int
    {
        $tasks = PmTask::query()
            ->where('status', PmTaskStatus::Overdue->value)
            ->where('last_overdue_reminder_at', '<=', $now->subHours((int) config('pm.preventive.overdue_reminder_hours')))
            ->get();

        return $this->notifyGrouped($tasks, 'overdue', ['last_overdue_reminder_at' => $now]);
    }

    /** @return Collection<int, PmTask> */
    private function transition(Builder $query, PmTaskStatus $to, string $action): Collection
    {
        $tasks = $query->orderBy('id')->get();

        foreach ($tasks as $task) {
            $from = $task->status;
            $task->status = $to;
            $task->save();
            $this->logger->log($task, $action, $from, $to, null);
        }

        return $tasks;
    }

    /**
     * One notification per (schedule, due date, PIC); stamps every task so it is not announced again.
     *
     * @param  iterable<PmTask>  $tasks
     */
    private function notifyGrouped(iterable $tasks, string $method, array $stamp): int
    {
        $groups = collect($tasks)->groupBy(
            fn (PmTask $t) => $t->pm_schedule_id.'|'.$t->due_at->getTimestamp().'|'.$t->pic_user_id
        );

        foreach ($groups as $group) {
            $this->notifier->{$method}($group->values());
            PmTask::query()->whereIn('id', $group->pluck('id'))->update($stamp);
        }

        return $groups->count();
    }
}
