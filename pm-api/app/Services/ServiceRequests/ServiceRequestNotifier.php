<?php

namespace App\Services\ServiceRequests;

use App\Models\ApprovalStep;
use App\Models\ServiceRequest;
use App\Models\User;
use App\Models\WorkOrder;
use App\Notifications\DocumentNotification;
use App\Services\Approvals\ApprovalEngine;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;

/** Who hears about which Form Request event (in-app + Expo push). */
class ServiceRequestNotifier
{
    public function __construct(private ApprovalEngine $engine)
    {
    }

    /** The active step now waits for someone (after submit, change of superior, or the previous approval). */
    public function stepPending(ServiceRequest $request, ?ApprovalStep $step, string $event): void
    {
        if (! $step) {
            return;
        }
        $verb = $step->kind === ApprovalStep::KIND_COMPLETION ? 'perlu diselesaikan' : 'menunggu persetujuan Anda';

        $this->send($this->engine->actors($step), $request, $event,
            "Form Request {$request->displayNumber()} {$verb}",
            $this->requesterLine($request));
    }

    public function approved(ServiceRequest $request, User $approver, ?ApprovalStep $completionStep): void
    {
        $this->send($this->requester($request, $approver), $request, 'service_request.approved',
            "Request disetujui: {$request->displayNumber()}",
            "Disetujui {$approver->name}, sedang diproses {$request->executorUnit->display_name}.");

        $this->stepPending($request, $completionStep, 'service_request.step_pending');
    }

    public function rejected(ServiceRequest $request, User $approver, string $notes): void
    {
        $this->send($this->requester($request, $approver), $request, 'service_request.rejected',
            "Request DITOLAK: {$request->displayNumber()}",
            "{$approver->name}: ".Str::limit($notes, 120), true);
    }

    public function revisionRequested(ServiceRequest $request, User $approver, string $notes): void
    {
        $this->send($this->requester($request, $approver), $request, 'service_request.revision_requested',
            "Request perlu direvisi: {$request->displayNumber()}",
            "{$approver->name}: ".Str::limit($notes, 120), true);
    }

    public function completed(ServiceRequest $request, User $executor): void
    {
        $this->send($this->requester($request, $executor), $request, 'service_request.completed',
            "Request selesai: {$request->displayNumber()}",
            "Diselesaikan {$executor->name}.");
    }

    public function convertedToWorkOrder(ServiceRequest $request, WorkOrder $workOrder, User $lead): void
    {
        $this->send($this->requester($request, $lead), $request, 'service_request.converted',
            "Request dialihkan ke WO {$workOrder->wo_number}",
            "{$lead->name}: ".Str::limit((string) $request->conversion_reason, 120));
    }

    public function reminder(ApprovalStep $step, ServiceRequest $request): void
    {
        $this->send($this->engine->actors($step), $request, 'approval.reminder',
            "PENGINGAT: {$request->displayNumber()} menunggu Anda > 24 jam",
            $this->requesterLine($request), true);
    }

    private function requester(ServiceRequest $request, User $actor): Collection
    {
        return (int) $request->requester_id === (int) $actor->id
            ? collect()
            : collect([$request->requester()->first()])->filter();
    }

    private function requesterLine(ServiceRequest $request): string
    {
        $name = $request->requester_name ?? $request->requester()->value('name');

        return $name.' — '.Str::limit($request->purpose, 100);
    }

    private function send(Collection $users, ServiceRequest $request, string $event, string $title, string $body, bool $alarm = false): void
    {
        $users = $users->filter(fn (?User $u) => $u && $u->is_active)->values();
        if ($users->isEmpty()) {
            return;
        }

        Notification::send($users, new DocumentNotification($event, ServiceRequest::MORPH_ALIAS, $request->id, $title, $body, $alarm));
    }
}
