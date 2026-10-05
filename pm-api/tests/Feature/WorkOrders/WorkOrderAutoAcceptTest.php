<?php

namespace Tests\Feature\WorkOrders;

use App\Models\Holiday;
use App\Models\StatusLog;
use App\Models\WorkOrder;
use App\Notifications\WorkOrderNotification;
use App\Services\Support\WorkingDayCalculator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\WorkOrderFixtures;
use Tests\TestCase;

class WorkOrderAutoAcceptTest extends TestCase
{
    use RefreshDatabase;
    use WorkOrderFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpOrganization();
        Notification::fake();
    }

    public function test_working_days_skip_weekends_and_holidays(): void
    {
        $calendar = app(WorkingDayCalculator::class);
        $friday = Carbon::parse('2026-10-02 10:00', 'Asia/Jakarta');

        $this->assertSame('2026-10-07 10:00', $calendar->addWorkingDays($friday, 3)->format('Y-m-d H:i'));

        Holiday::query()->create(['date' => '2026-10-05', 'name' => 'Libur contoh']);
        $this->assertSame('2026-10-08 10:00', $calendar->addWorkingDays($friday, 3)->format('Y-m-d H:i'));
    }

    public function test_completed_work_order_is_closed_after_three_working_days_without_answer(): void
    {
        Holiday::query()->create(['date' => '2026-10-05', 'name' => 'Libur contoh']);
        $this->travelTo(Carbon::parse('2026-10-02 10:00', 'Asia/Jakarta')); // Friday

        $wo = $this->completedWorkOrder();
        $this->assertSame('2026-10-08T10:00:00+07:00', $wo['acceptance_due_at']);

        // Not yet due
        $this->travelTo(Carbon::parse('2026-10-08 09:59', 'Asia/Jakarta'));
        $this->artisan('wo:auto-accept')->assertExitCode(0);
        $this->assertSame('completed', WorkOrder::query()->find($wo['id'])->status->value);

        // Due
        $this->travelTo(Carbon::parse('2026-10-08 10:00', 'Asia/Jakarta'));
        $this->artisan('wo:auto-accept')->expectsOutput('1 WO diterima otomatis.')->assertExitCode(0);

        $closed = WorkOrder::query()->find($wo['id']);
        $this->assertSame('closed', $closed->status->value);
        $this->assertTrue($closed->auto_accepted);
        $this->assertNull($closed->accepted_by_id);
        $this->assertNotNull($closed->closed_at);

        $log = StatusLog::query()->where('action', 'auto_accept')->sole();
        $this->assertNull($log->user_id, 'performed by the system');
        $this->assertSame('completed', $log->from_status);
        Notification::assertSentTo($this->tech1, WorkOrderNotification::class,
            fn (WorkOrderNotification $n) => $n->event === 'work_order.closed');

        // Running again is harmless
        $this->artisan('wo:auto-accept')->expectsOutput('0 WO diterima otomatis.');
    }

    public function test_rejected_work_order_is_not_auto_accepted(): void
    {
        $this->travelTo(Carbon::parse('2026-10-02 10:00', 'Asia/Jakarta'));
        $wo = $this->completedWorkOrder();
        $this->action($this->requester, $wo['id'], 'accept', ['acceptance' => 'no', 'reason' => 'Belum beres'])->assertOk();

        $this->travelTo(Carbon::parse('2026-10-20 10:00', 'Asia/Jakarta'));
        $this->artisan('wo:auto-accept')->expectsOutput('0 WO diterima otomatis.');
        $this->assertSame('in_progress', WorkOrder::query()->find($wo['id'])->status->value);
    }
}
