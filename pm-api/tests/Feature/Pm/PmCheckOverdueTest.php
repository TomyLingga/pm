<?php

namespace Tests\Feature\Pm;

use App\Models\StatusLog;
use App\Notifications\DocumentNotification;
use App\Services\Pm\PmStatusRefresher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\PmFixtures;
use Tests\TestCase;

/** `pm:check-overdue`: time-based statuses plus the upcoming (H-2), due (H-0) and overdue reminders. */
class PmCheckOverdueTest extends TestCase
{
    use PmFixtures;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpPm();
    }

    private function statuses(int $scheduleId, string $dueDate): array
    {
        return $this->tasksOf($scheduleId)
            ->filter(fn ($t) => $t->due_at->format('Y-m-d') === $dueDate)
            ->map(fn ($t) => $t->status->value)->values()->all();
    }

    public function test_weekly_task_goes_through_upcoming_due_and_overdue_with_one_reminder_each(): void
    {
        $schedule = $this->createSchedule(); // Mondays 08:00, 2 equipment, PIC tech1, tolerance 24 h
        $id = $schedule['id'];

        // One minute before the window (H-2) nothing happens
        $this->checkOverdueAt('2026-10-10 07:59');
        $this->assertSame(['scheduled', 'scheduled'], $this->statuses($id, '2026-10-12'));
        Notification::assertNothingSent();

        // H-2: JATUH_TEMPO + one grouped alarm for the PIC (not one per equipment)
        $this->checkOverdueAt('2026-10-10 08:00');
        $this->assertSame(['due', 'due'], $this->statuses($id, '2026-10-12'));
        $this->assertSame(['scheduled', 'scheduled'], $this->statuses($id, '2026-10-19'));
        $this->assertSame(1, $this->sentCount($this->tech1, 'pm_task.upcoming'));
        Notification::assertSentTo($this->tech1, DocumentNotification::class, fn (DocumentNotification $n) => $n->event === 'pm_task.upcoming'
            && $n->alarm === true
            && $n->documentType === 'pm_task'
            && $n->title === 'PM mendekati jadwal: PM Mingguan Server Room (2 alat)'
            && str_contains($n->body, '12 Okt 2026 08:00'));
        Notification::assertNotSentTo([$this->itLead, $this->tech2], DocumentNotification::class);

        // Running again (every 15 minutes) does not repeat the reminder
        $this->checkOverdueAt('2026-10-10 08:15');
        $this->checkOverdueAt('2026-10-11 20:00');
        $this->assertSame(1, $this->sentCount($this->tech1, 'pm_task.upcoming'));
        $this->assertSame(0, $this->sentCount($this->tech1, 'pm_task.due'));

        // H-0
        $this->checkOverdueAt('2026-10-12 08:00');
        $this->checkOverdueAt('2026-10-12 08:15');
        $this->assertSame(1, $this->sentCount($this->tech1, 'pm_task.due'));
        $this->assertSame(['due', 'due'], $this->statuses($id, '2026-10-12'));

        // Past due + tolerance (24 h) → TERLAMBAT, PIC and leads are alerted
        $this->checkOverdueAt('2026-10-13 08:00');
        $this->assertSame(['due', 'due'], $this->statuses($id, '2026-10-12'), 'exactly at the limit is still on time');
        $this->checkOverdueAt('2026-10-13 08:01');
        $this->assertSame(['overdue', 'overdue'], $this->statuses($id, '2026-10-12'));
        $this->assertSame(1, $this->sentCount($this->tech1, 'pm_task.overdue'));
        $this->assertSame(1, $this->sentCount($this->itLead, 'pm_task.overdue'));
        $this->assertSame(0, $this->sentCount($this->tech2, 'pm_task.overdue'));
        Notification::assertSentTo($this->itLead, DocumentNotification::class,
            fn (DocumentNotification $n) => $n->event === 'pm_task.overdue' && $n->alarm && str_starts_with($n->title, 'PM TERLAMBAT'));

        // Overdue reminder repeats every 48 hours, not sooner
        $this->checkOverdueAt('2026-10-15 08:00');
        $this->assertSame(1, $this->sentCount($this->tech1, 'pm_task.overdue'));
        $this->checkOverdueAt('2026-10-15 08:01');
        $this->assertSame(2, $this->sentCount($this->tech1, 'pm_task.overdue'));
        $this->assertSame(2, $this->sentCount($this->itLead, 'pm_task.overdue'));

        // Audit trail written by the system
        $task = $this->tasksOf($id)->first();
        $logs = StatusLog::query()->where('loggable_type', 'pm_task')->where('loggable_id', $task->id)->orderBy('id')->get();
        $this->assertSame(['due', 'overdue'], $logs->pluck('action')->all());
        $this->assertSame([null, null], $logs->pluck('user_id')->all());
        $this->assertSame(['scheduled', 'due'], $logs->pluck('from_status')->all());
    }

    public function test_daily_schedule_has_no_early_reminder_and_old_tasks_are_skipped_by_the_system(): void
    {
        // Daily 08:00 from Tue 6 Oct, tolerance 4 h; occurrences are closer together than the H-2 window
        $schedule = $this->createSchedule([
            'frequency_type' => 'daily', 'start_at' => '2026-10-06T08:00:00+07:00',
            'equipment_ids' => [$this->equipment->id], 'tolerance_hours' => 4,
        ]);
        $id = $schedule['id'];

        $this->checkOverdueAt('2026-10-05 08:00');
        $this->checkOverdueAt('2026-10-06 07:59');
        $this->assertSame(['scheduled'], $this->statuses($id, '2026-10-06'), 'opens exactly at its due time, not a day or two earlier');
        Notification::assertNothingSent();

        $this->checkOverdueAt('2026-10-06 08:00');
        $this->assertSame(['due'], $this->statuses($id, '2026-10-06'));
        $this->assertSame(['scheduled'], $this->statuses($id, '2026-10-07'), "tomorrow's task stays closed");
        $this->assertSame(0, $this->sentCount($this->tech1, 'pm_task.upcoming'), 'no H-n reminder for daily PM');
        $this->assertSame(1, $this->sentCount($this->tech1, 'pm_task.due'));

        $this->checkOverdueAt('2026-10-06 12:01');
        $this->assertSame(['overdue'], $this->statuses($id, '2026-10-06'));
        $this->assertSame(1, $this->sentCount($this->tech1, 'pm_task.overdue'));

        // Next morning the new occurrence is due → yesterday's untouched task is DILEWATI by the system
        $this->checkOverdueAt('2026-10-07 08:00');
        $yesterday = $this->tasksOf($id)->first();
        $this->assertSame('skipped', $yesterday->status->value);
        $this->assertSame(PmStatusRefresher::AUTO_SKIP_REASON, $yesterday->skip_reason);
        $this->assertNull($yesterday->skipped_by_id);
        $this->assertNotNull($yesterday->skipped_at);
        $this->assertSame('auto_skip', StatusLog::query()->where('loggable_id', $yesterday->id)->where('loggable_type', 'pm_task')->latest('id')->value('action'));
        $this->assertSame(['due'], $this->statuses($id, '2026-10-07'));
        $this->assertSame(2, $this->sentCount($this->tech1, 'pm_task.due'));

        // A task somebody is working on is never skipped automatically
        $today = $this->tasksOf($id)->get(1);
        $this->pmAction($this->tech1, $today->id, 'start')->assertOk();
        $this->checkOverdueAt('2026-10-08 08:00');
        $this->checkOverdueAt('2026-10-09 08:00');
        $this->assertSame('in_progress', $today->fresh()->status->value);
        $this->assertSame(['skipped'], $this->statuses($id, '2026-10-08'), 'the untouched one in between was skipped');
    }

    public function test_without_tolerance_the_overdue_alert_replaces_the_due_reminder(): void
    {
        $schedule = $this->createSchedule(['tolerance_hours' => 0, 'equipment_ids' => [$this->equipment->id]]);

        $this->checkOverdueAt('2026-10-10 08:00');
        $this->checkOverdueAt('2026-10-12 08:05'); // first run after the due time is already past the (zero) tolerance

        $this->assertSame(['overdue'], $this->statuses($schedule['id'], '2026-10-12'));
        $this->assertSame(1, $this->sentCount($this->tech1, 'pm_task.upcoming'));
        $this->assertSame(0, $this->sentCount($this->tech1, 'pm_task.due'));
        $this->assertSame(1, $this->sentCount($this->tech1, 'pm_task.overdue'));
    }

    public function test_custom_window_of_three_days_gives_an_h_minus_3_reminder(): void
    {
        $schedule = $this->createSchedule(['due_window_hours' => 72, 'equipment_ids' => [$this->equipment->id]]);
        $this->assertSame('2026-10-09 08:00', $this->tasksOf($schedule['id'])->first()->due_window_at->format('Y-m-d H:i'));

        $this->checkOverdueAt('2026-10-09 08:00');
        $this->assertSame(['due'], $this->statuses($schedule['id'], '2026-10-12'));
        $this->assertSame(1, $this->sentCount($this->tech1, 'pm_task.upcoming'));
    }

    public function test_completed_and_skipped_tasks_are_left_alone(): void
    {
        $schedule = $this->createSchedule(['equipment_ids' => [$this->equipment->id]]);
        $this->checkOverdueAt('2026-10-10 08:00');
        $task = $this->tasksOf($schedule['id'])->first();
        $this->pmAction($this->itLead, $task->id, 'skip', ['reason' => 'Server dimatikan untuk relokasi'])->assertOk();

        $this->checkOverdueAt('2026-10-12 08:00');
        $this->checkOverdueAt('2026-10-14 09:00');

        $this->assertSame('skipped', $task->fresh()->status->value);
        $this->assertSame(0, $this->sentCount($this->tech1, 'pm_task.due'));
        $this->assertSame(0, $this->sentCount($this->tech1, 'pm_task.overdue'));
    }
}
