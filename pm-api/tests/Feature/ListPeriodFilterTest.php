<?php

namespace Tests\Feature;

use App\Models\PmTask;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\PmFixtures;
use Tests\Concerns\ServiceRequestFixtures;
use Tests\TestCase;

/**
 * The list period (`from`..`to`) only narrows finished documents, by the date they ended.
 * Everything still running is always listed, however old it is.
 */
class ListPeriodFilterTest extends TestCase
{
    use PmFixtures, ServiceRequestFixtures {
        PmFixtures::setUpOrganization insteadof ServiceRequestFixtures;
        PmFixtures::actingAsUser insteadof ServiceRequestFixtures;
        PmFixtures::workOrderPayload insteadof ServiceRequestFixtures;
        PmFixtures::createWorkOrder insteadof ServiceRequestFixtures;
        PmFixtures::action insteadof ServiceRequestFixtures;
        PmFixtures::completionPayload insteadof ServiceRequestFixtures;
        PmFixtures::acceptPayload insteadof ServiceRequestFixtures;
        PmFixtures::completedWorkOrder insteadof ServiceRequestFixtures;
    }
    use RefreshDatabase;

    private const OCTOBER = 'from=2026-10-01&to=2026-10-31';

    private function ids(string $path, string $query): array
    {
        return collect($this->actingAsUser($this->requester)->getJson("/api/v1/{$path}?{$query}")->assertOk()->json('data'))
            ->pluck('id')->sort()->values()->all();
    }

    public function test_work_orders(): void
    {
        $this->setUpOrganization();
        $this->travelTo($this->wib('2026-09-10 09:00'));
        $oldSubmitted = $this->createWorkOrder(['request_description' => 'Lama, belum diambil']);
        $closedInSeptember = $this->createWorkOrder();
        $this->action($this->tech1, $closedInSeptember['id'], 'pick')->assertOk();
        $this->action($this->tech1, $closedInSeptember['id'], 'complete', $this->completionPayload())->assertOk();
        $this->action($this->requester, $closedInSeptember['id'], 'accept', $this->acceptPayload())->assertOk();
        $closedInOctober = $this->createWorkOrder();
        $this->action($this->tech1, $closedInOctober['id'], 'pick')->assertOk();
        $this->action($this->tech1, $closedInOctober['id'], 'complete', $this->completionPayload())->assertOk();
        $oldInProgress = $this->createWorkOrder();
        $this->action($this->tech2, $oldInProgress['id'], 'pick')->assertOk();
        $cancelledInSeptember = $this->createWorkOrder();
        $this->action($this->requester, $cancelledInSeptember['id'], 'cancel', ['reason' => 'Salah input'])->assertOk();

        $this->travelTo($this->wib('2026-10-02 10:00'));
        $this->action($this->requester, $closedInOctober['id'], 'accept', $this->acceptPayload())->assertOk(); // issued in Sept, closed in Oct
        $cancelledInOctober = $this->createWorkOrder();
        $this->action($this->requester, $cancelledInOctober['id'], 'cancel', ['reason' => 'Sudah beres sendiri'])->assertOk();

        $all = 'scope=mine&'.self::OCTOBER;
        $this->assertSame(collect([$oldSubmitted, $closedInOctober, $oldInProgress, $cancelledInOctober])->pluck('id')->sort()->values()->all(), $this->ids('work-orders', $all));
        $this->assertSame([$closedInOctober['id']], $this->ids('work-orders', $all.'&status=closed'));
        $this->assertSame([$closedInSeptember['id']], $this->ids('work-orders', 'scope=mine&status=closed&from=2026-09-01&to=2026-09-30'));
        $this->assertSame([$oldSubmitted['id']], $this->ids('work-orders', $all.'&status=submitted'), 'running WOs ignore the period');
        $this->assertCount(6, $this->ids('work-orders', 'scope=mine'), 'no period = everything');

        $this->actingAsUser($this->requester)->getJson('/api/v1/work-orders?from=2026-10-31&to=2026-10-01')->assertStatus(422);
    }

    public function test_service_requests(): void
    {
        $this->setUpServiceRequests();
        $this->travelTo($this->wib('2026-09-10 09:00'));
        $oldDraft = $this->createRequest(['purpose' => 'Draft lama']);
        $rejectedInSeptember = $this->submittedRequest();
        $this->requestAction($this->superior, $rejectedInSeptember['id'], 'reject', ['notes' => 'Tidak perlu'])->assertOk();
        $oldWaiting = $this->submittedRequest();
        $completedInOctober = $this->submittedRequest();
        $this->requestAction($this->superior, $completedInOctober['id'], 'approve')->assertOk();
        $this->requestAction($this->itLead, $completedInOctober['id'], 'approve', ['assigned_executor_id' => $this->tech1->id])->assertOk();

        $this->travelTo($this->wib('2026-10-03 10:00'));
        $this->requestAction($this->tech1, $completedInOctober['id'], 'complete', ['executor_notes' => 'Selesai dipasang'])->assertOk();

        $this->assertSame(collect([$oldDraft, $oldWaiting, $completedInOctober])->pluck('id')->sort()->values()->all(),
            $this->ids('service-requests', 'scope=mine&'.self::OCTOBER));
        $this->assertSame([$rejectedInSeptember['id']], $this->ids('service-requests', 'scope=mine&status=rejected&from=2026-09-01&to=2026-09-30'));
        $this->assertSame([], $this->ids('service-requests', 'scope=mine&status=rejected&'.self::OCTOBER));
    }

    public function test_pm_tasks(): void
    {
        $this->setUpPm(); // clock: Mon 5 Oct 2026 07:00
        $schedule = $this->createSchedule(['frequency_type' => 'weekly', 'frequency_interval' => 1, 'start_at' => '2026-09-21T08:00:00+07:00',
            'equipment_ids' => [$this->equipment->id], 'tolerance_hours' => 24]);
        // Due 21 Sep and 28 Sep were already past when the schedule was created; let the scheduler age them.
        $this->checkOverdueAt('2026-10-05 08:00');
        $tasks = $this->tasksOf($schedule['id'])->keyBy(fn (PmTask $t) => $t->due_at->toDateString());

        $this->pmAction($this->itLead, $tasks['2026-10-05']->id, 'skip', ['reason' => 'Libur'])->assertOk();
        $ids = fn (string $q) => collect($this->actingAsUser($this->itLead)->getJson("/api/v1/pm-tasks?scope=unit&per_page=100&{$q}")->assertOk()->json('data'))
            ->pluck('id')->sort()->values()->all();

        $all = $ids('');
        $october = $ids('from=2026-10-01&to=2026-10-31');
        $this->assertContains($tasks['2026-10-05']->id, $october, 'skipped in October');
        $this->assertContains($tasks['2026-10-12']->id, $october, 'scheduled tasks ignore the period');
        $this->assertSame([], $ids('status=skipped&from=2026-09-01&to=2026-09-30'));
        $this->assertSame([$tasks['2026-10-05']->id], $ids('status=skipped&from=2026-10-01&to=2026-10-31'));
        $this->assertSame(count($all), count($october), 'nothing ended before October');
    }
}
