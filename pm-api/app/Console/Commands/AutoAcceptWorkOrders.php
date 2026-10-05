<?php

namespace App\Console\Commands;

use App\Enums\WorkOrderStatus;
use App\Models\WorkOrder;
use App\Services\WorkOrders\WorkOrderService;
use Illuminate\Console\Command;

class AutoAcceptWorkOrders extends Command
{
    protected $signature = 'wo:auto-accept';

    protected $description = 'Close completed work orders the user did not answer within the acceptance window';

    public function handle(WorkOrderService $service): int
    {
        $closed = 0;

        WorkOrder::query()
            ->where('status', WorkOrderStatus::Completed->value)
            ->where('acceptance_due_at', '<=', now())
            ->orderBy('id')
            ->each(function (WorkOrder $workOrder) use ($service, &$closed) {
                if ($service->autoAccept($workOrder)) {
                    $closed++;
                }
            });

        $this->info("{$closed} WO diterima otomatis.");

        return self::SUCCESS;
    }
}
