<?php

namespace Tests\Feature\Pm;

use App\Models\PmSchedule;
use App\Models\PmTask;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\PmFixtures;
use Tests\TestCase;

/** `pm:generate-tasks`: daily, idempotent task generation from the schedules. */
class PmGenerateTasksTest extends TestCase
{
    use PmFixtures;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpPm();
    }

    public function test_running_the_command_again_never_duplicates_tasks(): void
    {
        $schedule = $this->createSchedule();
        $this->assertSame(16, PmTask::query()->count());

        // Same day, again and again
        $this->artisan('pm:generate-tasks')->expectsOutput('0 tugas PM dibuat.')->assertExitCode(0);
        $this->artisan('pm:generate-tasks')->expectsOutput('0 tugas PM dibuat.');
        $this->assertSame(16, PmTask::query()->count());

        // Even when the bookkeeping is lost, the unique key (schedule, equipment, due_at) protects against doubles
        PmSchedule::query()->whereKey($schedule['id'])->update(['generated_until' => null]);
        $this->artisan('pm:generate-tasks')->expectsOutput('0 tugas PM dibuat.');
        $this->assertSame(16, PmTask::query()->count());
        $this->assertSame(
            16,
            PmTask::query()->selectRaw('count(distinct (equipment_id, due_at)) as n')->value('n'),
            'every (equipment, due date) pair exists exactly once'
        );
    }

    public function test_each_nightly_run_only_adds_what_entered_the_horizon(): void
    {
        $schedule = $this->createSchedule();

        // Next morning: horizon moved one day, no new Monday inside it yet
        $this->travelTo($this->wib('2026-10-06 00:05'));
        $this->artisan('pm:generate-tasks')->expectsOutput('0 tugas PM dibuat.');

        // A week later Monday 7 Dec enters the 60-day horizon → one task per equipment
        $this->travelTo($this->wib('2026-10-12 00:05'));
        $this->artisan('pm:generate-tasks')->expectsOutput('2 tugas PM dibuat.');
        $this->artisan('pm:generate-tasks')->expectsOutput('0 tugas PM dibuat.');

        $this->assertSame(18, PmTask::query()->count());
        $this->assertSame('2026-12-07 08:00', $this->tasksOf($schedule['id'])->last()->due_at->format('Y-m-d H:i'));
        $this->assertSame('2026-12-11 00:05', PmSchedule::query()->find($schedule['id'])->generated_until->format('Y-m-d H:i'));
    }

    public function test_inactive_schedules_and_the_schedule_end_are_respected(): void
    {
        $template = $this->createTemplate()['id'];
        $ending = $this->createSchedule(['end_at' => '2026-10-20T00:00:00+07:00'], $template);
        $inactive = $this->createSchedule(['name' => 'Nonaktif', 'is_active' => false], $template);

        $this->assertSame(
            ['2026-10-12 08:00', '2026-10-19 08:00'],
            $this->tasksOf($ending['id'])->pluck('due_at')->map->format('Y-m-d H:i')->unique()->values()->all()
        );
        $this->assertCount(0, $this->tasksOf($inactive['id']));

        $this->travelTo($this->wib('2026-11-30 00:05'));
        $this->artisan('pm:generate-tasks')->expectsOutput('0 tugas PM dibuat.');
    }

    public function test_hourly_schedules_use_a_short_horizon_and_open_exactly_at_their_due_time(): void
    {
        // Every 8 hours from today 06:00; "now" is 07:00
        $schedule = $this->createSchedule([
            'frequency_type' => 'hourly', 'frequency_interval' => 8, 'start_at' => '2026-10-05T06:00:00+07:00',
            'equipment_ids' => [$this->equipment->id], 'tolerance_hours' => 2,
        ]);

        $tasks = $this->tasksOf($schedule['id']);
        $this->assertCount(22, $tasks, '7-day horizon: 06:00 today … 06:00 on 12 Oct');
        $this->assertSame('2026-10-12 06:00', $tasks->last()->due_at->format('Y-m-d H:i'));

        [$current, $next] = $tasks->take(2)->all();
        $this->assertSame('2026-10-05 06:00', $current->due_window_at->format('Y-m-d H:i'), 'no H-2 window for a schedule tighter than 2 days');
        $this->assertSame('due', $current->status->value, 'the cycle that started at 06:00 is open');
        $this->assertSame('2026-10-05 08:00', $current->overdue_at->format('Y-m-d H:i'));
        $this->assertSame('2026-10-05 14:00', $next->due_at->format('Y-m-d H:i'));
        $this->assertSame('scheduled', $next->status->value, 'the next occurrence stays closed until its own due time');
        $this->assertSame('2026-10-05 14:00', $next->due_window_at->format('Y-m-d H:i'));
    }

    public function test_h_minus_2_window_applies_only_when_occurrences_are_further_apart(): void
    {
        $template = $this->createTemplate()['id'];
        $window = fn (array $overrides) => $this->tasksOf(
            $this->createSchedule(['equipment_ids' => [$this->equipment->id]] + $overrides, $template)['id']
        )->first();

        $every2Days = $window(['name' => 'A', 'frequency_type' => 'every_n_days', 'frequency_interval' => 2]);
        $this->assertTrue($every2Days->due_window_at->equalTo($every2Days->due_at), '48 h apart is not more than the 48 h window');

        $every3Days = $window(['name' => 'B', 'frequency_type' => 'every_n_days', 'frequency_interval' => 3]);
        $this->assertSame('2026-10-10 08:00', $every3Days->due_window_at->format('Y-m-d H:i'), 'H-2');

        $monthly = $window(['name' => 'C', 'frequency_type' => 'monthly', 'due_window_hours' => 168]);
        $this->assertSame('2026-10-05 08:00', $monthly->due_window_at->format('Y-m-d H:i'), 'custom window of 7 days');
    }

    public function test_first_generation_includes_the_cycle_that_started_today_but_not_older_ones(): void
    {
        $template = $this->createTemplate()['id'];
        $this->travelTo($this->wib('2026-10-05 10:00'));

        // Daily 08:00 since 1 Oct, created today at 10:00 → today's task exists, 1–4 Oct do not
        $daily = $this->createSchedule([
            'frequency_type' => 'daily', 'start_at' => '2026-10-01T08:00:00+07:00', 'equipment_ids' => [$this->equipment->id],
        ], $template);
        $dailyTasks = $this->tasksOf($daily['id']);
        $this->assertSame('2026-10-05 08:00', $dailyTasks->first()->due_at->format('Y-m-d H:i'));
        $this->assertSame('due', $dailyTasks->first()->status->value);
        $this->assertSame('2026-10-05 08:00', $dailyTasks->first()->due_window_at->format('Y-m-d H:i'), 'daily tasks open at their due time');
        $this->assertSame('scheduled', $dailyTasks->get(1)->status->value, "tomorrow's task is not open yet");
        $this->assertCount(61, $dailyTasks, '5 Oct … 4 Dec');

        // Monthly on the 1st: this month's cycle started days ago → first task is 1 Nov
        $monthly = $this->createSchedule([
            'name' => 'Bulanan', 'frequency_type' => 'monthly', 'start_at' => '2026-10-01T08:00:00+07:00',
            'equipment_ids' => [$this->equipment->id],
        ], $template);
        $this->assertSame(
            ['2026-11-01 08:00', '2026-12-01 08:00'],
            $this->tasksOf($monthly['id'])->pluck('due_at')->map->format('Y-m-d H:i')->all()
        );
    }
}
