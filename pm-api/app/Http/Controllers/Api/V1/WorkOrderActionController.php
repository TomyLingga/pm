<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ReasonRequest;
use App\Services\ServiceRequests\DocumentConversionService;
use App\Http\Requests\WorkOrders\AcceptWorkOrderRequest;
use App\Http\Requests\WorkOrders\AssignWorkOrderRequest;
use App\Http\Requests\WorkOrders\CancelWorkOrderRequest;
use App\Http\Requests\WorkOrders\CompleteWorkOrderRequest;
use App\Http\Requests\WorkOrders\SaveLaboursRequest;
use App\Http\Requests\WorkOrders\SaveMaterialsRequest;
use App\Http\Resources\WorkOrderResource;
use App\Models\WorkOrder;
use App\Services\WorkOrders\WorkOrderService;
use Illuminate\Http\Request;

/** Status transitions and in-progress edits. Every endpoint returns the updated detail. */
class WorkOrderActionController extends Controller
{
    public function __construct(private WorkOrderService $service)
    {
    }

    public function cancel(CancelWorkOrderRequest $request, WorkOrder $workOrder): WorkOrderResource
    {
        $this->authorize('cancel', $workOrder);

        return $this->detail($this->service->cancel($workOrder, $request->user(), $request->input('reason')));
    }

    public function pick(Request $request, WorkOrder $workOrder): WorkOrderResource
    {
        $this->authorize('pick', $workOrder);

        return $this->detail($this->service->pick($workOrder, $request->user()));
    }

    public function receive(AssignWorkOrderRequest $request, WorkOrder $workOrder): WorkOrderResource
    {
        $this->authorize('receive', $workOrder);

        return $this->detail($this->service->receive(
            $workOrder,
            $request->user(),
            $request->input('assignee_ids'),
            (int) $request->input('lead_id'),
            $request->input('priority'),
        ));
    }

    public function assignees(AssignWorkOrderRequest $request, WorkOrder $workOrder): WorkOrderResource
    {
        $this->authorize('reassign', $workOrder);

        return $this->detail($this->service->reassign(
            $workOrder,
            $request->user(),
            $request->input('assignee_ids'),
            (int) $request->input('lead_id'),
        ));
    }

    public function start(Request $request, WorkOrder $workOrder): WorkOrderResource
    {
        $this->authorize('start', $workOrder);

        return $this->detail($this->service->start($workOrder, $request->user()));
    }

    public function materials(SaveMaterialsRequest $request, WorkOrder $workOrder): WorkOrderResource
    {
        $this->authorize('work', $workOrder);

        return $this->detail($this->service->saveMaterials($workOrder, $request->user(), $request->input('materials', [])));
    }

    public function labours(SaveLaboursRequest $request, WorkOrder $workOrder): WorkOrderResource
    {
        $this->authorize('work', $workOrder);

        return $this->detail($this->service->saveLabours($workOrder, $request->user(), $request->input('labours', [])));
    }

    public function complete(CompleteWorkOrderRequest $request, WorkOrder $workOrder): WorkOrderResource
    {
        $this->authorize('complete', $workOrder);

        return $this->detail($this->service->complete($workOrder, $request->user(), $request->validated()));
    }

    public function accept(AcceptWorkOrderRequest $request, WorkOrder $workOrder): WorkOrderResource
    {
        $this->authorize('accept', $workOrder);

        return $this->detail($this->service->accept($workOrder, $request->user(), $request->validated()));
    }

    /** Executor lead redirects the WO to the Form Request flow (Q-9); the requester gets a draft. */
    public function convertToRequest(ReasonRequest $request, WorkOrder $workOrder, DocumentConversionService $conversion): WorkOrderResource
    {
        $this->authorize('convert', $workOrder);
        $conversion->workOrderToRequest($workOrder, $request->user(), $request->input('reason'));

        return $this->detail($workOrder);
    }

    private function detail(WorkOrder $workOrder): WorkOrderResource
    {
        return new WorkOrderResource($workOrder->fresh(WorkOrderResource::RELATIONS));
    }
}
