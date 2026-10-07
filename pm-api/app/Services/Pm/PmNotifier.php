<?php

namespace App\Services\Pm;

use App\Models\ExecutorUnit;
use App\Models\PmTask;
use App\Models\User;
use App\Notifications\DocumentNotification;
use App\Services\Org\ExecutorDirectory;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;

/**
 * Who hears about which PM event (in-app + Expo push, queued).
 * Time-based reminders are grouped per schedule occurrence so a schedule with many
 * equipment produces one alarm, not one per machine.
 */
class PmNotifier
{
    public function __construct(private ExecutorDirectory $directory)
    {
    }

    /**
     * @param  Collection<int, PmTask>  $tasks  tasks of the same schedule, due date and PIC
     */
    public function upcoming(Collection $tasks): void
    {
        $this->reminder($tasks, 'pm_task.upcoming', 'PM mendekati jadwal', fn (PmTask $t) => 'Jatuh tempo '.$this->when($t).'.');
    }

    /** @param Collection<int, PmTask> $tasks */
    public function due(Collection $tasks): void
    {
        $this->reminder($tasks, 'pm_task.due', 'PM JATUH TEMPO', fn (PmTask $t) => 'Jadwal '.$this->when($t).' — segera kerjakan.');
    }

    /** @param Collection<int, PmTask> $tasks */
    public function overdue(Collection $tasks): void
    {
        $this->reminder($tasks, 'pm_task.overdue', 'PM TERLAMBAT', fn (PmTask $t) => 'Seharusnya '.$this->when($t).', belum dikerjakan.', withLeads: true);
    }

    public function skipProposed(PmTask $task, User $by): void
    {
        $this->send($this->leads($task)->where('id', '!=', $by->id), $task, 'pm_task.skip_proposed',
            "Usulan lewati {$task->number}",
            "{$by->name}: ".Str::limit((string) $task->skip_proposal, 120));
    }

    public function skipped(PmTask $task, User $by): void
    {
        $this->send($this->pic($task, $by), $task, 'pm_task.skipped',
            "PM dilewati: {$task->number}",
            "{$by->name}: ".Str::limit((string) $task->skip_reason, 120));
    }

    public function reassigned(PmTask $task, User $by): void
    {
        $this->send($this->pic($task, $by), $task, 'pm_task.reassigned',
            "Anda menjadi PIC {$task->number}",
            $this->subject($task).' — jatuh tempo '.$this->when($task).'.');
    }

    private function reminder(Collection $tasks, string $event, string $prefix, callable $body, bool $withLeads = false): void
    {
        /** @var PmTask $first */
        $first = $tasks->first();
        if (! $first) {
            return;
        }
        $first->loadMissing('schedule', 'equipment', 'pic');

        $recipients = collect([$first->pic]);
        if ($withLeads) {
            $recipients = $recipients->merge($this->leads($first));
        }

        $count = $tasks->count();
        $title = $count > 1
            ? "{$prefix}: {$first->schedule->name} ({$count} alat)"
            : "{$prefix}: {$this->subject($first)}";

        $this->send($recipients, $first, $event, $title, $body($first), alarm: true);
    }

    /** @return Collection<int, User> */
    private function leads(PmTask $task): Collection
    {
        $unit = ExecutorUnit::withTrashed()->find($task->executor_unit_id);

        return $unit
            ? $this->directory->staffQuery($unit)->whereIn('grade_code', config('pm.lead_grade_codes'))->get()
            : collect();
    }

    private function pic(PmTask $task, User $actor): Collection
    {
        return (int) $task->pic_user_id === (int) $actor->id ? collect() : collect([$task->pic()->first()]);
    }

    private function subject(PmTask $task): string
    {
        $task->loadMissing('schedule', 'equipment');

        return "{$task->schedule->name} — {$task->equipment->code} {$task->equipment->name}";
    }

    private function when(PmTask $task): string
    {
        return $task->due_at->timezone(config('app.timezone'))->translatedFormat('j M Y H:i');
    }

    private function send(Collection $users, PmTask $task, string $event, string $title, string $body, bool $alarm = false): void
    {
        $users = $users->filter(fn (?User $u) => $u && $u->is_active)->unique('id')->values();
        if ($users->isEmpty()) {
            return;
        }

        Notification::send($users, new DocumentNotification($event, PmTask::MORPH_ALIAS, $task->id, $title, $body, $alarm));
    }
}
