<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\PmTaskStatus;
use App\Enums\WorkOrderStatus;
use App\Exceptions\InvalidTransitionException;
use App\Exports\Templates\EquipmentTemplate;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreEquipmentRequest;
use App\Http\Resources\EquipmentResource;
use App\Models\Equipment;
use App\Services\Org\ExecutorDirectory;
use App\Services\Pm\EquipmentHistory;
use App\Services\Pm\EquipmentImporter;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/** Equipment master (minimal CRUD) and the maintenance history per equipment. */
class EquipmentController extends Controller
{
    private const LOOKUP_LIMIT = 50;

    /** Without `page` it is the lookup used by forms (max 50 rows); with `page` it is paginated. */
    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'executor_unit_id' => ['nullable', 'integer'],
            'status' => ['nullable', Rule::in(array_keys(Equipment::STATUSES))],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);
        $paginated = $request->has('page') || $request->has('per_page');

        $query = Equipment::query()->with(EquipmentResource::RELATIONS)
            ->when($filters['q'] ?? null, function (Builder $q, string $term) {
                $like = '%'.mb_strtolower(trim($term)).'%';
                $q->where(fn (Builder $w) => $w->whereRaw('LOWER(code) LIKE ?', [$like])->orWhereRaw('LOWER(name) LIKE ?', [$like]));
            })
            ->when($filters['executor_unit_id'] ?? null, fn (Builder $q, $id) => $q->where(
                // Form lookups also offer equipment that no unit has claimed yet.
                fn (Builder $w) => $paginated ? $w->where('executor_unit_id', $id) : $w->where('executor_unit_id', $id)->orWhereNull('executor_unit_id')
            ))
            ->when($filters['status'] ?? null, fn (Builder $q, $status) => $q->where('status', $status))
            ->when(! $paginated && empty($filters['status']), fn (Builder $q) => $q->where('status', '!=', 'disposed'))
            ->orderBy('code');

        return EquipmentResource::collection($paginated
            ? $query->paginate((int) ($filters['per_page'] ?? 20))->withQueryString()
            : $query->limit(self::LOOKUP_LIMIT)->get());
    }

    public function store(StoreEquipmentRequest $request): JsonResponse
    {
        $data = $request->validated();
        $data['status'] ??= 'active';
        $equipment = new Equipment($data);
        $this->authorize('manageEquipment', $equipment);
        $equipment->save();

        return $this->detail($equipment, $request)->response()->setStatusCode(201);
    }

    public function show(Request $request, Equipment $equipment): JsonResource
    {
        return $this->detail($equipment, $request);
    }

    public function update(StoreEquipmentRequest $request, Equipment $equipment): JsonResource
    {
        $this->authorize('manageEquipment', $equipment);
        $data = $request->validated();
        $data['status'] ??= $equipment->status;
        $equipment->fill($data);
        // Moving the equipment to another unit also needs lead rights there.
        $this->authorize('manageEquipment', $equipment);
        $equipment->save();

        return $this->detail($equipment, $request);
    }

    public function destroy(Equipment $equipment): Response
    {
        $this->authorize('manageEquipment', $equipment);
        if ($equipment->pmSchedules()->where('is_active', true)->exists()) {
            throw new InvalidTransitionException('Equipment masih dipakai jadwal PM aktif. Keluarkan dari jadwal terlebih dahulu.');
        }

        $equipment->delete();

        return response()->noContent();
    }

    /** Excel template for bulk entry (leads only): sheet "Data" to fill, Contoh, Petunjuk, Lokasi, Unit Pelaksana. */
    public function importTemplate(Request $request, ExecutorDirectory $directory): BinaryFileResponse
    {
        abort_unless($directory->isLeadAnywhere($request->user()), 403, 'Hanya pimpinan unit pelaksana yang dapat mengimpor equipment.');

        return Excel::download(new EquipmentTemplate(), 'template-equipment.xlsx');
    }

    /** Upload a filled template; rows are matched on No. Alat (create or update), all-or-nothing. */
    public function import(Request $request, EquipmentImporter $importer): JsonResponse
    {
        $request->validate(['file' => ['required', 'file', 'mimes:xlsx,xls,csv', 'max:5120']]);

        return response()->json(['data' => $importer->import($request->user(), $request->file('file')->getRealPath())]);
    }

    public function history(Equipment $equipment, EquipmentHistory $history): AnonymousResourceCollection
    {
        $this->authorize('viewHistory', $equipment);

        return JsonResource::collection($history->paginate($equipment));
    }

    private function detail(Equipment $equipment, Request $request): JsonResource
    {
        $equipment->load(EquipmentResource::RELATIONS);
        $canManage = Gate::forUser($request->user())->allows('manageEquipment', $equipment);
        $openTasks = [PmTaskStatus::Scheduled->value, PmTaskStatus::Due->value, PmTaskStatus::Overdue->value];
        $closedOrders = [WorkOrderStatus::Closed->value, WorkOrderStatus::Cancelled->value, WorkOrderStatus::Converted->value];
        $iso = fn ($value) => $value ? Carbon::parse($value)->toIso8601String() : null;

        return new JsonResource((new EquipmentResource($equipment))->toArray($request) + [
            'stats' => [
                'open_work_orders' => $equipment->workOrders()->whereNotIn('status', $closedOrders)->count(),
                'last_pm_completed_at' => $iso($equipment->pmTasks()->where('status', PmTaskStatus::Completed->value)->max('completed_at')),
                'next_pm_due_at' => $iso($equipment->pmTasks()->whereIn('status', $openTasks)->min('due_at')),
                'active_schedules' => $equipment->pmSchedules()->where('is_active', true)->count(),
            ],
            'permissions' => ['can_update' => $canManage, 'can_delete' => $canManage],
        ]);
    }
}
