<?php

namespace Tests\Feature\Pm;

use App\Models\ChecklistTemplate;
use App\Models\PmSchedule;
use App\Models\PmTask;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\PmFixtures;
use Tests\TestCase;

/** CRUD of checklist templates and PM schedules, and how schedule changes keep tasks in step. */
class PmTemplateAndScheduleTest extends TestCase
{
    use PmFixtures;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpPm();
    }

    public function test_lead_manages_checklist_templates(): void
    {
        $this->actingAsUser($this->tech1)->postJson('/api/v1/checklist-templates', $this->templatePayload())->assertForbidden();

        $template = $this->createTemplate();
        $this->assertSame('PM Mingguan Perangkat IT', $template['name']);
        $this->assertSame(4, $template['items_count']);
        $this->assertSame([0, 1, 2, 3], array_column($template['items'], 'sort_order'));
        $this->assertSame(['ok_nok_na', 'number', 'text', 'ok_nok_na'], array_column($template['items'], 'input_type'));
        $this->assertEquals([210, 230, 'V'], [$template['items'][1]['min_value'], $template['items'][1]['max_value'], $template['items'][1]['unit']]);
        $this->assertTrue($template['items'][3]['photo_required']);
        $this->assertTrue($template['permissions']['can_update']);

        // Update: keep item 0, drop item 1, move item 3 up, add a new one
        $items = $template['items'];
        $updated = $this->actingAsUser($this->itLead)->putJson("/api/v1/checklist-templates/{$template['id']}", $this->templatePayload([
            'name' => 'PM Mingguan (rev)',
            'items' => [
                ['id' => $items[3]['id'], 'description' => 'Kebersihan area', 'input_type' => 'ok_nok_na', 'is_required' => true, 'photo_required' => true],
                ['id' => $items[0]['id'], 'description' => 'Kondisi fisik perangkat', 'input_type' => 'ok_nok_na', 'unit' => 'V', 'min_value' => 1],
                ['description' => 'Arus beban', 'input_type' => 'number', 'unit' => 'A', 'max_value' => 16],
            ],
        ]))->assertOk()->json('data');

        $this->assertSame('PM Mingguan (rev)', $updated['name']);
        $this->assertSame([$items[3]['id'], $items[0]['id']], [$updated['items'][0]['id'], $updated['items'][1]['id']], 'ids are kept, order follows the array');
        $this->assertCount(3, $updated['items']);
        $this->assertNull($updated['items'][1]['unit'], 'unit/min/max only apply to number items');
        $this->assertNull($updated['items'][1]['min_value']);
        $this->assertSame('Arus beban', $updated['items'][2]['description']);

        // Visibility and list
        $this->actingAsUser($this->tech1)->getJson("/api/v1/checklist-templates/{$template['id']}")
            ->assertOk()->assertJsonPath('data.permissions.can_update', false);
        $this->actingAsUser($this->mtcTech)->getJson("/api/v1/checklist-templates/{$template['id']}")->assertForbidden();
        $this->actingAsUser($this->tech1)->getJson('/api/v1/checklist-templates?active=1')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.items_count', 3);
        $this->actingAsUser($this->mtcTech)->getJson('/api/v1/checklist-templates')->assertOk()->assertJsonCount(0, 'data');

        // Duplicate
        $copy = $this->actingAsUser($this->itLead)->postJson("/api/v1/checklist-templates/{$template['id']}/duplicate")
            ->assertCreated()->json('data');
        $this->assertSame('PM Mingguan (rev) (salinan)', $copy['name']);
        $this->assertCount(3, $copy['items']);
        $this->assertNotSame($updated['items'][0]['id'], $copy['items'][0]['id']);
    }

    public function test_template_validation_and_delete_rules(): void
    {
        $this->actingAsUser($this->itLead)->postJson('/api/v1/checklist-templates', $this->templatePayload(['items' => []]))
            ->assertStatus(422)->assertJsonValidationErrors('items');
        $this->actingAsUser($this->itLead)->postJson('/api/v1/checklist-templates', $this->templatePayload(['items' => [
            ['description' => 'Tegangan', 'input_type' => 'number', 'min_value' => 230, 'max_value' => 210],
            ['description' => '', 'input_type' => 'checkbox'],
        ]]))->assertStatus(422)->assertJsonValidationErrors(['items.0.max_value', 'items.1.description', 'items.1.input_type']);
        // A lead of IT cannot create templates for another unit
        $this->actingAsUser($this->itLead)->postJson('/api/v1/checklist-templates', $this->templatePayload(['executor_unit_id' => $this->mtc->id]))
            ->assertForbidden();

        $used = $this->createTemplate();
        $unused = $this->createTemplate(['name' => 'Tidak dipakai']);
        $this->createSchedule([], $used['id']);

        $this->actingAsUser($this->itLead)->deleteJson("/api/v1/checklist-templates/{$used['id']}")
            ->assertStatus(409)->assertJsonFragment(['message' => 'Template masih dipakai jadwal PM. Ganti template pada jadwal tersebut terlebih dahulu.']);
        $this->actingAsUser($this->tech1)->deleteJson("/api/v1/checklist-templates/{$unused['id']}")->assertForbidden();
        $this->actingAsUser($this->itLead)->deleteJson("/api/v1/checklist-templates/{$unused['id']}")->assertNoContent();
        $this->assertSoftDeleted('checklist_templates', ['id' => $unused['id']]);
    }

    public function test_creating_a_schedule_generates_tasks_up_to_the_horizon(): void
    {
        $schedule = $this->createSchedule();

        $this->assertSame('Mingguan', $schedule['frequency_label']);
        $this->assertSame(2, $schedule['equipment_count']);
        $this->assertSame(['SCN-01', 'UPS-02'], array_column($schedule['equipment'], 'code'));
        $this->assertSame(48, $schedule['due_window_hours'], 'default window = H-2');
        $this->assertSame($this->tech1->id, $schedule['pic']['id']);
        $this->assertSame('2026-10-12T08:00:00+07:00', $schedule['next_due_at']);
        $this->assertSame('2026-12-04T07:00:00+07:00', $schedule['generated_until'], 'now + 60 days');
        $this->assertSame(
            ['2026-10-12T08:00:00+07:00', '2026-10-19T08:00:00+07:00', '2026-10-26T08:00:00+07:00', '2026-11-02T08:00:00+07:00', '2026-11-09T08:00:00+07:00'],
            $schedule['upcoming']
        );
        // 8 Mondays (12 Oct … 30 Nov) × 2 equipment
        $this->assertSame(16, $schedule['task_counts']['scheduled']);
        $this->assertTrue($schedule['permissions']['can_update']);

        $tasks = $this->tasksOf($schedule['id']);
        $this->assertCount(16, $tasks);
        $first = $tasks->first();
        $this->assertSame('scheduled', $first->status->value);
        $this->assertSame('2026-10-12 08:00', $first->due_at->format('Y-m-d H:i'));
        $this->assertSame('2026-10-10 08:00', $first->due_window_at->format('Y-m-d H:i'), 'H-2');
        $this->assertSame('2026-10-13 08:00', $first->overdue_at->format('Y-m-d H:i'), 'due + 24 h tolerance');
        $this->assertSame($this->tech1->id, $first->pic_user_id);
        $this->assertSame($this->it->id, $first->executor_unit_id);
        $this->assertSame('2026-11-30 08:00', $tasks->last()->due_at->format('Y-m-d H:i'));

        // List + detail visibility
        $this->actingAsUser($this->tech1)->getJson('/api/v1/pm-schedules')
            ->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.name', 'PM Mingguan Server Room');
        $this->actingAsUser($this->tech1)->getJson("/api/v1/pm-schedules/{$schedule['id']}")
            ->assertOk()->assertJsonPath('data.permissions.can_update', false);
        $this->actingAsUser($this->mtcTech)->getJson("/api/v1/pm-schedules/{$schedule['id']}")->assertForbidden();
        $this->actingAsUser($this->mtcTech)->getJson('/api/v1/pm-schedules')->assertJsonPath('meta.total', 0);
        $this->actingAsUser($this->tech1)->getJson('/api/v1/pm-schedules?equipment_id='.$this->equipment2->id.'&active=1&q=server')
            ->assertJsonPath('meta.total', 1);
    }

    public function test_schedule_validation(): void
    {
        $template = $this->createTemplate();
        $foreign = ChecklistTemplate::query()->create(['executor_unit_id' => $this->mtc->id, 'name' => 'Template MTC']);
        $post = fn (array $overrides, $as = null) => $this->actingAsUser($as ?? $this->itLead)
            ->postJson('/api/v1/pm-schedules', $this->schedulePayload($template['id'], $overrides));

        $post([], $this->tech1)->assertForbidden();
        $post(['checklist_template_id' => $foreign->id])->assertStatus(422)->assertJsonValidationErrors('checklist_template_id');
        $post(['pic_user_id' => $this->mtcTech->id])->assertStatus(422)->assertJsonValidationErrors('pic_user_id');
        $post(['equipment_ids' => []])->assertStatus(422)->assertJsonValidationErrors('equipment_ids');
        $post(['frequency_type' => 'every_n_days', 'frequency_interval' => 1])->assertStatus(422)->assertJsonValidationErrors('frequency_interval');
        $post(['frequency_type' => 'hourly', 'frequency_interval' => 200])->assertStatus(422)->assertJsonValidationErrors('frequency_interval');
        $post(['frequency_type' => 'fortnightly'])->assertStatus(422)->assertJsonValidationErrors('frequency_type');
        $post(['end_at' => '2026-10-01T08:00:00+07:00'])->assertStatus(422)->assertJsonValidationErrors('end_at');
        $post(['tolerance_hours' => -1])->assertStatus(422)->assertJsonValidationErrors('tolerance_hours');
        $this->assertSame(0, PmSchedule::query()->count());

        // "Harian" has no interval: whatever is sent, it is stored as 1
        $daily = $post(['frequency_type' => 'daily', 'frequency_interval' => 9, 'start_at' => '2026-10-06T08:00:00+07:00'])
            ->assertCreated()->json('data');
        $this->assertSame(1, $daily['frequency_interval']);
        $this->assertSame('Harian', $daily['frequency_label']);
    }

    public function test_preview_shows_the_dates_without_saving(): void
    {
        $this->actingAsUser($this->itLead)->postJson('/api/v1/pm-schedules/preview', [
            'frequency_type' => 'monthly', 'frequency_interval' => 1, 'start_at' => '2026-01-31T08:00:00+07:00', 'count' => 4,
        ])->assertOk()
            ->assertJsonPath('data.frequency_label', 'Bulanan')
            ->assertJsonPath('data.dates', [
                '2026-01-31T08:00:00+07:00', '2026-02-28T08:00:00+07:00', '2026-03-31T08:00:00+07:00', '2026-04-30T08:00:00+07:00',
            ]);

        $this->actingAsUser($this->itLead)->postJson('/api/v1/pm-schedules/preview', [
            'frequency_type' => 'hourly', 'frequency_interval' => 8, 'start_at' => '2026-10-05T06:00:00+07:00',
            'end_at' => '2026-10-05T23:00:00+07:00',
        ])->assertOk()->assertJsonPath('data.frequency_label', 'Setiap 8 jam')->assertJsonCount(3, 'data.dates');

        $this->actingAsUser($this->itLead)->postJson('/api/v1/pm-schedules/preview', ['frequency_type' => 'weekly', 'frequency_interval' => 99])
            ->assertStatus(422)->assertJsonValidationErrors(['frequency_interval', 'start_at']);
        $this->assertSame(0, PmSchedule::query()->count());
    }

    public function test_updating_a_schedule_regenerates_only_untouched_tasks(): void
    {
        $schedule = $this->createSchedule();
        $template = $schedule['checklist_template']['id'];

        // Saturday: the tasks of Mon 12 Oct enter their window; tech1 starts one of them
        $this->checkOverdueAt('2026-10-10 08:00');
        [$started, $due] = $this->tasksOf($schedule['id'])->take(2)->all();
        $this->pmAction($this->tech1, $started->id, 'start')->assertOk();

        // Every 3 days instead of weekly, and only the first equipment
        $this->actingAsUser($this->tech1)->putJson("/api/v1/pm-schedules/{$schedule['id']}", $this->schedulePayload($template))->assertForbidden();
        $updated = $this->actingAsUser($this->itLead)->putJson("/api/v1/pm-schedules/{$schedule['id']}", $this->schedulePayload($template, [
            'frequency_type' => 'every_n_days', 'frequency_interval' => 3, 'equipment_ids' => [$this->equipment->id],
        ]))->assertOk()->json('data');

        $this->assertSame('Setiap 3 hari', $updated['frequency_label']);
        $this->assertSame('in_progress', $started->fresh()->status->value, 'work in progress is kept');
        $this->assertSame('due', $due->fresh()->status->value, 'a task that is already due is kept, even for a removed equipment');
        // 12 Oct + 3k days up to the horizon (9 Dec 08:00) = 20 dates; 12 Oct already exists for the first equipment
        $scheduled = PmTask::query()->where('pm_schedule_id', $schedule['id'])->where('status', 'scheduled')->get();
        $this->assertCount(19, $scheduled);
        $this->assertSame([$this->equipment->id], $scheduled->pluck('equipment_id')->unique()->values()->all());
        $this->assertSame('2026-10-15 08:00', $scheduled->sortBy('due_at')->first()->due_at->format('Y-m-d H:i'));
        $this->assertSame(21, PmTask::query()->where('pm_schedule_id', $schedule['id'])->count());

        // The executor unit of a schedule cannot change
        $this->actingAsUser($this->itLead)->putJson("/api/v1/pm-schedules/{$schedule['id']}", $this->schedulePayload($template, ['executor_unit_id' => $this->mtc->id]))
            ->assertStatus(422)->assertJsonValidationErrors('executor_unit_id');

        // Deactivate → untouched tasks disappear; reactivate → they come back
        $this->actingAsUser($this->itLead)->putJson("/api/v1/pm-schedules/{$schedule['id']}", $this->schedulePayload($template, [
            'frequency_type' => 'every_n_days', 'frequency_interval' => 3, 'equipment_ids' => [$this->equipment->id], 'is_active' => false,
        ]))->assertOk()->assertJsonPath('data.is_active', false)->assertJsonPath('data.upcoming', []);
        $this->assertSame(2, PmTask::query()->where('pm_schedule_id', $schedule['id'])->count());

        $this->actingAsUser($this->itLead)->putJson("/api/v1/pm-schedules/{$schedule['id']}", $this->schedulePayload($template, [
            'frequency_type' => 'every_n_days', 'frequency_interval' => 3, 'equipment_ids' => [$this->equipment->id], 'is_active' => true,
        ]))->assertOk();
        $this->assertSame(21, PmTask::query()->where('pm_schedule_id', $schedule['id'])->count());

        // Delete → soft delete, untouched tasks removed, history kept
        $this->actingAsUser($this->tech1)->deleteJson("/api/v1/pm-schedules/{$schedule['id']}")->assertForbidden();
        $this->actingAsUser($this->itLead)->deleteJson("/api/v1/pm-schedules/{$schedule['id']}")->assertNoContent();
        $this->assertSoftDeleted('pm_schedules', ['id' => $schedule['id']]);
        $this->assertSame(2, PmTask::query()->where('pm_schedule_id', $schedule['id'])->count());
        $this->actingAsUser($this->itLead)->getJson("/api/v1/pm-schedules/{$schedule['id']}")->assertNotFound();
        $this->actingAsUser($this->tech1)->getJson("/api/v1/pm-tasks/{$started->id}")
            ->assertOk()->assertJsonPath('data.schedule.name', 'PM Mingguan Server Room');
    }
}
