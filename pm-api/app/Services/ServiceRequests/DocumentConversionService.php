<?php

namespace App\Services\ServiceRequests;

use App\Enums\ServiceRequestStatus;
use App\Enums\WorkOrderStatus;
use App\Exceptions\InvalidTransitionException;
use App\Models\ServiceCategory;
use App\Models\ServiceRequest;
use App\Models\User;
use App\Models\WorkOrder;
use App\Notifications\DocumentNotification;
use App\Services\Approvals\ApprovalEngine;
use App\Services\Audit\StatusLogger;
use App\Services\WorkOrders\WorkOrderService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;

/**
 * Q-9: an executor lead redirects a document to the right channel —
 * a costly WO becomes a Form Request draft, a simple request becomes a Work Order.
 */
class DocumentConversionService
{
    public function __construct(
        private WorkOrderService $workOrders,
        private ServiceRequestService $requests,
        private ApprovalEngine $engine,
        private StatusLogger $logger,
        private ServiceRequestNotifier $requestNotifier,
    ) {
    }

    /** WO (submitted/received) → converted; the requester gets a Form Request draft to complete and submit. */
    public function workOrderToRequest(WorkOrder $workOrder, User $lead, string $reason): ServiceRequest
    {
        $request = DB::transaction(function () use ($workOrder, $lead, $reason) {
            $workOrder = WorkOrder::query()->lockForUpdate()->findOrFail($workOrder->id);
            if (! WorkOrderService::statusAllows($workOrder, 'convert')) {
                throw new InvalidTransitionException("WO {$workOrder->wo_number} berstatus {$workOrder->status->label()}; tidak dapat dialihkan.");
            }

            $category = ServiceCategory::query()->whereKey($workOrder->service_category_id)->where('for_request', true)->first()
                ?? ServiceCategory::query()->where('executor_unit_id', $workOrder->executor_unit_id)
                    ->where('for_request', true)->where('is_active', true)->orderBy('sort_order')->first();

            $requester = User::query()->findOrFail($workOrder->requester_id);
            $request = $this->requests->createDraft($requester, [
                'executor_unit_id' => $workOrder->executor_unit_id,
                'service_category_id' => $category?->id,
                'purpose' => trim($workOrder->request_description
                    .($workOrder->equipment_name ? "\nAlat: {$workOrder->equipment_code} {$workOrder->equipment_name}" : '')),
                'priority' => $workOrder->priority->value,
            ], ['source_work_order_id' => $workOrder->id]);

            // Photos travel along (same files, new attachment rows).
            foreach ($workOrder->attachments as $attachment) {
                $copy = $attachment->replicate(['attachable_type', 'attachable_id']);
                $copy->attachable()->associate($request);
                $copy->save();
            }

            $from = $workOrder->status;
            $workOrder->fill([
                'status' => WorkOrderStatus::Converted,
                'converted_service_request_id' => $request->id,
                'conversion_reason' => $reason,
                'converted_at' => now(),
            ])->save();
            $this->logger->log($workOrder, 'convert', $from, $workOrder->status, $lead, $reason, ['service_request_id' => $request->id]);

            return $request;
        });

        if ((int) $workOrder->requester_id !== (int) $lead->id) {
            Notification::send($workOrder->requester()->first(), new DocumentNotification(
                'work_order.converted', ServiceRequest::MORPH_ALIAS, $request->id,
                "WO {$workOrder->wo_number} dialihkan ke Form Request",
                "{$lead->name}: ".Str::limit($reason, 100).' — lengkapi dan ajukan draft Form Request.',
            ));
        }

        return $request;
    }

    /** Request waiting for the executor lead → converted; a Work Order is submitted on the requester's behalf. */
    public function requestToWorkOrder(ServiceRequest $request, User $lead, string $reason): WorkOrder
    {
        $workOrder = DB::transaction(function () use ($request, $lead, $reason) {
            $request = ServiceRequest::query()->lockForUpdate()->findOrFail($request->id);
            if (! ServiceRequestService::statusAllows($request, 'convert')) {
                throw new InvalidTransitionException("Request {$request->displayNumber()} berstatus {$request->status->label()}; tidak dapat dialihkan.");
            }

            $category = ServiceCategory::query()->whereKey($request->service_category_id)->where('for_work_order', true)->first()
                ?? ServiceCategory::query()->where('executor_unit_id', $request->executor_unit_id)
                    ->where('for_work_order', true)->where('is_active', true)->orderBy('sort_order')->first();
            if (! $category) {
                throw new InvalidTransitionException('Unit pelaksana belum memiliki kategori Work Order.');
            }

            $workOrder = $this->workOrders->create(User::query()->findOrFail($request->requester_id), [
                'executor_unit_id' => $request->executor_unit_id,
                'service_category_id' => $category->id,
                'request_description' => $request->purpose,
                'priority' => $request->priority->value,
            ], ['source_service_request_id' => $request->id], notify: false);

            $this->engine->cancelOpen($request, $lead, $reason);
            $from = $request->status;
            $request->fill([
                'status' => ServiceRequestStatus::Converted,
                'converted_work_order_id' => $workOrder->id,
                'conversion_reason' => $reason,
                'converted_at' => now(),
            ])->save();
            $this->logger->log($request, 'convert', $from, $request->status, $lead, $reason, ['work_order_id' => $workOrder->id]);

            return $workOrder;
        });

        $this->workOrders->notifyCreated($workOrder);
        $this->requestNotifier->convertedToWorkOrder($request->fresh(), $workOrder, $lead);

        return $workOrder;
    }
}
