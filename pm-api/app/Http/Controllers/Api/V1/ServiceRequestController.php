<?php

namespace App\Http\Controllers\Api\V1;

use App\Exports\ServiceRequestsExport;
use App\Http\Controllers\Controller;
use App\Http\Requests\ServiceRequests\StoreServiceRequestRequest;
use App\Http\Resources\ServiceRequestListResource;
use App\Http\Resources\ServiceRequestResource;
use App\Models\ServiceRequest;
use App\Services\ServiceRequests\ServiceRequestPdf;
use App\Services\ServiceRequests\ServiceRequestQuery;
use App\Services\ServiceRequests\ServiceRequestService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ServiceRequestController extends Controller
{
    public function __construct(private ServiceRequestService $service)
    {
    }

    public function index(Request $request, ServiceRequestQuery $query): AnonymousResourceCollection
    {
        $perPage = min((int) ($request->query('per_page') ?: 20), 100);

        $page = $query->build($request->user(), $this->filters($request))
            ->with(ServiceRequestListResource::RELATIONS)
            ->paginate($perPage)
            ->withQueryString();

        return ServiceRequestListResource::collection($page);
    }

    public function export(Request $request, ServiceRequestQuery $query): BinaryFileResponse
    {
        $builder = $query->build($request->user(), $this->filters($request))->with(ServiceRequestsExport::RELATIONS);

        return Excel::download(new ServiceRequestsExport($builder), 'form-requests-'.now()->format('Ymd-Hi').'.xlsx');
    }

    public function store(StoreServiceRequestRequest $request): JsonResponse
    {
        $serviceRequest = $this->service->createDraft($request->user(), $request->validated());

        return $this->detail($serviceRequest)->response()->setStatusCode(201);
    }

    public function show(ServiceRequest $serviceRequest): ServiceRequestResource
    {
        $this->authorize('view', $serviceRequest);

        return $this->detail($serviceRequest);
    }

    public function update(StoreServiceRequestRequest $request, ServiceRequest $serviceRequest): ServiceRequestResource
    {
        $this->authorize('update', $serviceRequest);

        return $this->detail($this->service->updateDraft($serviceRequest, $request->user(), $request->validated()));
    }

    public function destroy(ServiceRequest $serviceRequest): Response
    {
        $this->authorize('delete', $serviceRequest);
        $this->service->deleteDraft($serviceRequest);

        return response()->noContent();
    }

    public function pdf(ServiceRequest $serviceRequest, ServiceRequestPdf $pdf): Response
    {
        $this->authorize('view', $serviceRequest);
        $filename = str_replace('/', '-', $serviceRequest->displayNumber()).'.pdf';

        return response($pdf->render($serviceRequest), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.$filename.'"',
        ]);
    }

    private function detail(ServiceRequest $serviceRequest): ServiceRequestResource
    {
        return new ServiceRequestResource($serviceRequest->fresh(ServiceRequestResource::RELATIONS));
    }

    private function filters(Request $request): array
    {
        return $request->validate([
            'scope' => ['nullable', Rule::in(ServiceRequestQuery::SCOPES)],
            'status' => ['nullable', 'string', 'max:200'],
            'executor_unit_id' => ['nullable', 'integer'],
            'service_category_id' => ['nullable', 'integer'],
            'priority' => ['nullable', 'in:high,medium,low'],
            'office_id' => ['nullable', 'integer'],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
            'q' => ['nullable', 'string', 'max:100'],
        ]);
    }
}
