<?php

namespace Tests\Concerns;

use App\Models\Equipment;
use App\Models\PmTask;
use App\Models\User;
use App\Notifications\DocumentNotification;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Notification;
use Illuminate\Testing\TestResponse;

/**
 * Preventive Maintenance fixtures on top of the Work Order organization.
 * The IT section is the executor: itLead (BOM-3) manages, tech1/tech2 (BOM-4) do the work.
 * "Now" starts on Monday 5 Oct 2026 07:00 WIB.
 */
trait PmFixtures
{
    use WorkOrderFixtures;

    protected Equipment $equipment2;

    protected function setUpPm(): void
    {
        $this->setUpOrganization();
        $this->equipment2 = Equipment::factory()->create([
            'code' => 'UPS-02', 'name' => 'UPS Server 10kVA',
            'location_id' => $this->location->id, 'executor_unit_id' => $this->it->id,
        ]);
        Notification::fake();
        $this->travelTo($this->wib('2026-10-05 07:00'));
    }

    protected function wib(string $dateTime): Carbon
    {
        return Carbon::parse($dateTime, 'Asia/Jakarta');
    }

    protected function templatePayload(array $overrides = []): array
    {
        return array_merge([
            'executor_unit_id' => $this->it->id,
            'name' => 'PM Mingguan Perangkat IT',
            'description' => 'Pemeriksaan rutin perangkat',
            'items' => [
                ['section' => 'Fisik', 'description' => 'Kondisi fisik perangkat', 'input_type' => 'ok_nok_na', 'is_required' => true],
                ['section' => 'Kelistrikan', 'description' => 'Tegangan input', 'input_type' => 'number', 'unit' => 'V', 'min_value' => 210, 'max_value' => 230, 'is_required' => true],
                ['section' => 'Kelistrikan', 'description' => 'Catatan suhu ruangan', 'input_type' => 'text', 'is_required' => false],
                ['section' => 'Fisik', 'description' => 'Kebersihan area perangkat', 'input_type' => 'ok_nok_na', 'is_required' => true, 'photo_required' => true],
            ],
        ], $overrides);
    }

    protected function createTemplate(array $overrides = []): array
    {
        return $this->actingAsUser($this->itLead)
            ->postJson('/api/v1/checklist-templates', $this->templatePayload($overrides))
            ->assertCreated()
            ->json('data');
    }

    /** Weekly on Mondays 08:00 from 12 Oct, both equipment, PIC tech1, tolerance 24 h. */
    protected function schedulePayload(int $templateId, array $overrides = []): array
    {
        return array_merge([
            'name' => 'PM Mingguan Server Room',
            'executor_unit_id' => $this->it->id,
            'checklist_template_id' => $templateId,
            'equipment_ids' => [$this->equipment->id, $this->equipment2->id],
            'frequency_type' => 'weekly',
            'frequency_interval' => 1,
            'start_at' => '2026-10-12T08:00:00+07:00',
            'tolerance_hours' => 24,
            'estimated_minutes' => 30,
            'pic_user_id' => $this->tech1->id,
        ], $overrides);
    }

    protected function createSchedule(array $overrides = [], ?int $templateId = null): array
    {
        $templateId ??= $this->createTemplate()['id'];

        return $this->actingAsUser($this->itLead)
            ->postJson('/api/v1/pm-schedules', $this->schedulePayload($templateId, $overrides))
            ->assertCreated()
            ->json('data');
    }

    protected function pmAction(User $user, int $taskId, string $action, array $body = [], string $method = 'postJson'): TestResponse
    {
        return $this->actingAsUser($user)->{$method}("/api/v1/pm-tasks/{$taskId}/{$action}", $body);
    }

    /** @return Collection<int, PmTask> tasks of a schedule ordered by due date then equipment */
    protected function tasksOf(int $scheduleId): Collection
    {
        return PmTask::query()->where('pm_schedule_id', $scheduleId)->orderBy('due_at')->orderBy('equipment_id')->get();
    }

    /** Move the clock and let the scheduler command update statuses / send reminders. */
    protected function checkOverdueAt(string $dateTime): void
    {
        $this->travelTo($this->wib($dateTime));
        $this->artisan('pm:check-overdue')->assertExitCode(0);
    }

    /** How many notifications of an event a user received so far. */
    protected function sentCount(User $user, string $event): int
    {
        return Notification::sent($user, DocumentNotification::class, fn (DocumentNotification $n) => $n->event === $event)->count();
    }

    /** The first task of a fresh weekly schedule, already JATUH_TEMPO (clock at Sat 10 Oct 09:00). */
    protected function dueTask(array $scheduleOverrides = []): PmTask
    {
        $schedule = $this->createSchedule($scheduleOverrides);
        $this->checkOverdueAt('2026-10-10 09:00');

        return $this->tasksOf($schedule['id'])->first();
    }
}
