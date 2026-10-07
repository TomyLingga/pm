<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\PmFrequency;
use App\Http\Controllers\Controller;
use App\Http\Requests\Pm\StorePmScheduleRequest;
use App\Http\Resources\PmScheduleResource;
use App\Models\PmSchedule;
use App\Services\Org\ExecutorDirectory;
use App\Services\Pm\PmScheduleService;
use App\Services\Pm\RecurrenceCalculator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;

class PmScheduleController extends Controller
{
    public function __construct(private PmScheduleService $service)
    {
    }

    public function index(Request $request, ExecutorDirectory $directory): AnonymousResourceCollection
    {
        $user = $request->user();

        $page = PmSchedule::query()
            ->with(PmScheduleResource::RELATIONS)
            ->when(! $user->canSeeEverything(), fn (Builder $q) => $q->whereIn('executor_unit_id', $directory->unitIdsFor($user) ?: [0]))
            ->when($request->query('executor_unit_id'), fn (Builder $q, $id) => $q->where('executor_unit_id', $id))
            ->when($request->query('pic_user_id'), fn (Builder $q, $id) => $q->where('pic_user_id', $id))
            ->when($request->query('equipment_id'), fn (Builder $q, $id) => $q->whereHas('equipment', fn (Builder $e) => $e->where('equipment.id', $id)))
            ->when($request->has('active') && $request->query('active') !== '', fn (Builder $q) => $q->where('is_active', $request->boolean('active')))
            ->when($request->query('q'), fn (Builder $q, $term) => $q->whereRaw('LOWER(name) LIKE ?', ['%'.mb_strtolower(trim($term)).'%']))
            ->orderBy('name')
            ->paginate(min((int) ($request->query('per_page') ?: 20), 100))
            ->withQueryString();

        return PmScheduleResource::collection($page);
    }

    public function store(StorePmScheduleRequest $request): JsonResponse
    {
        $this->authorize('manage', new PmSchedule(['executor_unit_id' => $request->input('executor_unit_id')]));

        return $this->detail($this->service->create($request->user(), $request->validated()))->response()->setStatusCode(201);
    }

    public function show(PmSchedule $pmSchedule): PmScheduleResource
    {
        $this->authorize('view', $pmSchedule);

        return $this->detail($pmSchedule);
    }

    public function update(StorePmScheduleRequest $request, PmSchedule $pmSchedule): PmScheduleResource
    {
        $this->authorize('manage', $pmSchedule);

        return $this->detail($this->service->update($pmSchedule, $request->validated()));
    }

    public function destroy(PmSchedule $pmSchedule): Response
    {
        $this->authorize('manage', $pmSchedule);
        $this->service->delete($pmSchedule);

        return response()->noContent();
    }

    /** Due dates a schedule definition would produce — for the form, nothing is stored. */
    public function preview(Request $request, RecurrenceCalculator $calculator): JsonResponse
    {
        $data = $request->validate(
            StorePmScheduleRequest::recurrenceRules($request->input('frequency_type')) + ['count' => ['nullable', 'integer', 'min:1', 'max:20']]
        );

        $type = PmFrequency::from($data['frequency_type']);
        $start = Carbon::parse($data['start_at'])->timezone(config('app.timezone'));
        $end = empty($data['end_at']) ? null : Carbon::parse($data['end_at'])->timezone(config('app.timezone'));
        $dates = $calculator->next($type, (int) $data['frequency_interval'], $start, $end, $start->copy()->subSecond(), (int) ($data['count'] ?? 8));

        return response()->json(['data' => [
            'frequency_label' => $type->label((int) $data['frequency_interval']),
            'dates' => array_map(fn ($date) => $date->toIso8601String(), $dates),
        ]]);
    }

    private function detail(PmSchedule $schedule): PmScheduleResource
    {
        return (new PmScheduleResource($schedule->fresh(PmScheduleResource::RELATIONS)))->detail();
    }
}
