<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ReasonRequest;
use App\Http\Requests\ServiceRequests\CompleteServiceRequestRequest;
use App\Http\Requests\ServiceRequests\DecisionRequest;
use App\Http\Requests\ServiceRequests\SuperiorRequest;
use App\Http\Resources\ServiceRequestResource;
use App\Models\ServiceRequest;
use App\Services\ServiceRequests\DocumentConversionService;
use App\Services\ServiceRequests\ServiceRequestService;

/** Approval-chain actions. Every endpoint returns the updated detail. */
class ServiceRequestActionController extends Controller
{
    public function __construct(private ServiceRequestService $service)
    {
    }

    public function submit(SuperiorRequest $request, ServiceRequest $serviceRequest): ServiceRequestResource
    {
        $this->authorize('submit', $serviceRequest);
        $superiorId = $request->filled('superior_id') ? (int) $request->input('superior_id') : null;

        return $this->detail($this->service->submit($serviceRequest, $request->user(), $superiorId));
    }

    public function changeSuperior(SuperiorRequest $request, ServiceRequest $serviceRequest): ServiceRequestResource
    {
        $this->authorize('changeSuperior', $serviceRequest);

        return $this->detail($this->service->changeSuperior(
            $serviceRequest, $request->user(), (int) $request->input('superior_id'), $request->input('reason')
        ));
    }

    public function approve(DecisionRequest $request, ServiceRequest $serviceRequest): ServiceRequestResource
    {
        $this->authorize('decide', $serviceRequest);
        $executorId = $request->filled('assigned_executor_id') ? (int) $request->input('assigned_executor_id') : null;

        return $this->detail($this->service->approve($serviceRequest, $request->user(), $request->input('notes'), $executorId));
    }

    public function reject(DecisionRequest $request, ServiceRequest $serviceRequest): ServiceRequestResource
    {
        $this->authorize('decide', $serviceRequest);

        return $this->detail($this->service->reject($serviceRequest, $request->user(), $request->input('notes')));
    }

    public function requestRevision(DecisionRequest $request, ServiceRequest $serviceRequest): ServiceRequestResource
    {
        $this->authorize('decide', $serviceRequest);

        return $this->detail($this->service->requestRevision($serviceRequest, $request->user(), $request->input('notes')));
    }

    public function complete(CompleteServiceRequestRequest $request, ServiceRequest $serviceRequest): ServiceRequestResource
    {
        $this->authorize('complete', $serviceRequest);

        return $this->detail($this->service->complete($serviceRequest, $request->user(), $request->input('executor_notes')));
    }

    public function cancel(ReasonRequest $request, ServiceRequest $serviceRequest): ServiceRequestResource
    {
        $this->authorize('cancel', $serviceRequest);

        return $this->detail($this->service->cancel($serviceRequest, $request->user(), $request->input('reason')));
    }

    public function convertToWorkOrder(ReasonRequest $request, ServiceRequest $serviceRequest, DocumentConversionService $conversion): ServiceRequestResource
    {
        $this->authorize('convert', $serviceRequest);
        $conversion->requestToWorkOrder($serviceRequest, $request->user(), $request->input('reason'));

        return $this->detail($serviceRequest);
    }

    private function detail(ServiceRequest $serviceRequest): ServiceRequestResource
    {
        return new ServiceRequestResource($serviceRequest->fresh(ServiceRequestResource::RELATIONS));
    }
}
