<?php

namespace App\Console\Commands;

use App\Enums\ApprovalStepStatus;
use App\Models\ApprovalStep;
use App\Models\ServiceRequest;
use App\Services\ServiceRequests\ServiceRequestNotifier;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Builder;

/** Alarm reminder for approvals waiting longer than `pm.service_request.reminder_hours` (repeats every interval). */
class RemindPendingApprovals extends Command
{
    protected $signature = 'approvals:remind';

    protected $description = 'Remind approvers of steps that have been pending for too long';

    public function handle(ServiceRequestNotifier $notifier): int
    {
        $threshold = now()->subHours(config('pm.service_request.reminder_hours'));
        $sent = 0;

        ApprovalStep::query()
            ->where('status', ApprovalStepStatus::Pending->value)
            ->where('activated_at', '<=', $threshold)
            ->where(fn (Builder $q) => $q->whereNull('last_reminded_at')->orWhere('last_reminded_at', '<=', $threshold))
            ->with('approvable')
            ->orderBy('id')
            ->each(function (ApprovalStep $step) use ($notifier, &$sent) {
                if ($step->approvable instanceof ServiceRequest) {
                    $notifier->reminder($step, $step->approvable);
                    $step->update(['last_reminded_at' => now()]);
                    $sent++;
                }
            });

        $this->info("{$sent} pengingat persetujuan dikirim.");

        return self::SUCCESS;
    }
}
