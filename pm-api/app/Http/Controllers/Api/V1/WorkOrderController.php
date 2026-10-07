<?php

namespace App\Http\Controllers\Api\V1;

use App\Exports\WorkOrdersExport;
use App\Http\Controllers\Controller;
use App\Http\Requests\WorkOrders\StoreWorkOrderRequest;
use App\Http\Resources\WorkOrderListResource;
use App\Http\Resources\WorkOrderResource;
use App\Models\WorkOrder;
use App\Services\WorkOrders\WorkOrderPdf;
use App\Services\WorkOrders\WorkOrderQuery;
use App\Services\WorkOrders\WorkOrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class WorkOrderController extends Controller
{
    public function __construct(private WorkOrderService $service)
    {
    }

    public function index(Request $request, WorkOrderQuery $query): AnonymousResourceCollection
    {
        $filters = $this->filters($request);
        $perPage = min((int) ($request->query('per_page') ?: 20), 100);

        $page = $query->build($request->user(), $filters)
            ->with(WorkOrderListResource::RELATIONS)
            ->paginate($perPage)
            ->withQueryString();

        return WorkOrderListResource::collection($page);
    }

    public function export(Request $request, WorkOrderQuery $query): BinaryFileResponse
    {
        $builder = $query->build($request->user(), $this->filters($request))->with(WorkOrdersExport::RELATIONS);

        return Excel::download(new WorkOrdersExport($builder), 'work-orders-'.now()->format('Ymd-Hi').'.xlsx');
    }

    public function store(StoreWorkOrderRequest $request): JsonResponse
    {
        $workOrder = $this->service->create($request->user(), $request->validated());

        return $this->detail($workOrder)->response()->setStatusCode(201);
    }

    public function show(WorkOrder $workOrder): WorkOrderResource
    {
        $this->authorize('view', $workOrder);

        return $this->detail($workOrder);
    }

    public function update(StoreWorkOrderRequest $request, WorkOrder $workOrder): WorkOrderResource
    {
        $this->authorize('update', $workOrder);

        return $this->detail($this->service->update($workOrder, $request->user(), $request->validated()));
    }

    public function pdf(WorkOrder $workOrder, WorkOrderPdf $pdf): Response
    {
        $this->authorize('view', $workOrder);
        $filename = str_replace('/', '-', $workOrder->wo_number).'.pdf';

        return response($pdf->render($workOrder), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.$filename.'"',
        ]);
    }

    private function detail(WorkOrder $workOrder): WorkOrderResource
    {
        return new WorkOrderResource($workOrder->fresh(WorkOrderResource::RELATIONS));
    }

    private function filters(Request $request): array
    {
        return $request->validate([
            'scope' => ['nullable', Rule::in(WorkOrderQuery::SCOPES)],
            'status' => ['nullable', 'string', 'max:200'],
            'executor_unit_id' => ['nullable', 'integer'],
            'priority' => ['nullable', 'in:high,medium,low'],
            'service_category_id' => ['nullable', 'integer'],
            'location_id' => ['nullable', 'integer'],
            'equipment_id' => ['nullable', 'integer'],
            'issued_from' => ['nullable', 'date_format:Y-m-d'],
            'issued_to' => ['nullable', 'date_format:Y-m-d'],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
            'q' => ['nullable', 'string', 'max:100'],
            'sort' => ['nullable', 'in:-issued_at,issued_at,-priority'],
        ]);
    }
}
