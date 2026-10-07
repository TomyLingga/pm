<?php

namespace Tests\Feature;

use App\Enums\PmTaskStatus;
use App\Enums\ServiceRequestStatus;
use App\Enums\WorkOrderStatus;
use App\Models\PmTask;
use App\Models\ServiceRequest;
use App\Models\StatusLog;
use App\Models\WorkOrder;
use Database\Seeders\DemoSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/** The demo seeder (empty database → demo organisation) covers every status and special case. */
class DemoSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_demo_data_covers_every_status_and_case(): void
    {
        $this->travelTo(Carbon::parse('2026-10-14 13:30', 'Asia/Jakarta'));
        $this->seed(RoleSeeder::class);
        $this->seed(DemoSeeder::class);

        $statuses = fn (string $model) => $model::query()->distinct()->pluck('status')->map(fn ($s) => $s->value ?? $s)->sort()->values()->all();
        $values = fn (array $cases) => collect($cases)->map->value->sort()->values()->all();

        $this->assertSame($values(WorkOrderStatus::cases()), $statuses(WorkOrder::class));
        $this->assertSame($values(ServiceRequestStatus::cases()), $statuses(ServiceRequest::class));
        $this->assertSame($values(PmTaskStatus::cases()), $statuses(PmTask::class));

        $this->assertTrue(WorkOrder::query()->where('status', 'closed')->where('rework_count', '>', 0)->exists(), 'rework then closed');
        $this->assertTrue(WorkOrder::query()->where('status', 'in_progress')->where('rework_count', '>', 0)->exists(), 'rejected by the user');
        $this->assertTrue(WorkOrder::query()->where('auto_accepted', true)->exists(), 'closed by auto-accept');
        $this->assertTrue(WorkOrder::query()->whereNotNull('pm_task_id')->exists(), 'WO from a PM finding');
        $this->assertTrue(WorkOrder::query()->whereIn('status', ['closed', 'cancelled'])->where('updated_at', '>=', now()->startOfMonth())->exists(), 'finished this month');
        $this->assertTrue(ServiceRequest::query()->where('revision_no', '>', 0)->exists(), 'revision round');
        $this->assertTrue(PmTask::query()->where('is_late', true)->exists(), 'completed late');
        $this->assertTrue(PmTask::query()->where('status', 'skipped')->whereNull('skipped_by_id')->exists(), 'auto-skipped');
        $this->assertTrue(PmTask::query()->where('status', 'skipped')->whereNotNull('skipped_by_id')->exists(), 'skipped by a lead');
        $this->assertTrue(PmTask::query()->whereNotNull('skip_proposed_at')->whereIn('status', ['due', 'overdue'])->exists(), 'skip proposal pending');
        $this->assertSame(0, StatusLog::query()->where('created_at', '>', now())->count(), 'nothing happens in the future');

        // Running it again changes nothing
        $count = WorkOrder::query()->count();
        $this->seed(DemoSeeder::class);
        $this->assertSame($count, WorkOrder::query()->count());
    }
}
