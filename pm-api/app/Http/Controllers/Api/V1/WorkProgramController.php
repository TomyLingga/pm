<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\WorkProgramActivityStatus;
use App\Exports\WorkProgramExport;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserBriefResource;
use App\Http\Resources\WorkProgramActivityResource;
use App\Http\Resources\WorkProgramResource;
use App\Models\OrgUnit;
use App\Models\User;
use App\Models\WorkProgram;
use App\Models\WorkProgramActivity;
use App\Models\WorkProgramItem;
use App\Services\Org\OrgVisibility;
use App\Services\Programs\WorkProgramService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Validation\Rule;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class WorkProgramController extends Controller
{
    private const DETAIL = ['orgUnit', 'createdBy', 'items.activities.pics', 'items.activities.dailyActivities', 'logs.user'];

    public function __construct(private WorkProgramService $service, private OrgVisibility $visibility)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'year' => ['nullable', 'integer', 'min:2000', 'max:2100'],
            'org_unit_id' => ['nullable', 'integer'],
            'status' => ['nullable', Rule::in([WorkProgram::STATUS_ACTIVE, WorkProgram::STATUS_CLOSED])],
            'q' => ['nullable', 'string', 'max:100'],
        ]);
        $user = $request->user();
        $visible = $this->service->visible($user);
        $years = (clone $visible)->toBase()->distinct()->orderByDesc('year')->pluck('year')->map(fn ($y) => (int) $y)->values();
        $year = (int) ($filters['year'] ?? ($years->first() ?? now()->year));

        $programs = (clone $visible)->where('year', $year)
            ->when(! empty($filters['org_unit_id']), fn (Builder $q) => $q->where('org_unit_id', $filters['org_unit_id']))
            ->when(! empty($filters['status']), fn (Builder $q) => $q->where('status', $filters['status']))
            ->when(! empty($filters['q']), fn (Builder $q) => $q->whereRaw('LOWER(title) LIKE ?', ['%'.mb_strtolower($filters['q']).'%']))
            ->with(['orgUnit', 'createdBy', 'activities'])->withCount('items')
            ->orderBy('org_unit_id')->orderBy('code')->get();

        $units = (clone $visible)->where('year', $year)->with('orgUnit')->get()->pluck('orgUnit')->filter()->unique('id')
            ->sortBy('name')->map(fn (OrgUnit $u) => ['id' => $u->id, 'code' => $u->code, 'name' => $u->name, 'type' => $u->type])->values();

        return response()->json([
            'data' => WorkProgramResource::collection($programs)->toArray($request),
            'meta' => [
                'year' => $year,
                'years' => $years->contains($year) ? $years : $years->push($year)->sortDesc()->values(),
                'org_units' => $units,
                'can_create' => $this->service->manageableUnits($user)->exists(),
            ],
        ]);
    }

    /** Org units the user may create a programme for. */
    public function units(Request $request): JsonResponse
    {
        $units = $this->service->manageableUnits($request->user())->get()
            ->map(fn (OrgUnit $u) => ['id' => $u->id, 'code' => $u->code, 'name' => $u->name, 'type' => $u->type]);

        return response()->json(['data' => $units->values()]);
    }

    /** PIC candidates: people in my branch of the org tree (admins: everyone). */
    public function people(Request $request): JsonResponse
    {
        $user = $request->user();
        $term = mb_strtolower(trim((string) $request->query('q', '')));
        $query = User::query()->where('is_active', true)->with('orgUnit')
            ->when(! $user->isAdmin(), fn (Builder $q) => $q->whereIn('org_unit_id', $this->visibility->chainIds($user) ?: [0]))
            ->when($term !== '', fn (Builder $q) => $q->where(fn (Builder $w) => $w
                ->whereRaw('LOWER(name) LIKE ?', ["%{$term}%"])->orWhereRaw('LOWER(nrk) LIKE ?', ["%{$term}%"])))
            ->orderBy('name')->limit(30);

        return response()->json(['data' => $query->get()->map(fn (User $u) => $this->person($u, $request))->values()]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'year' => ['required', 'integer', 'min:2000', 'max:2100'],
            'code' => ['required', 'string', 'max:10'],
            'title' => ['required', 'string', 'max:200'],
            'description' => ['nullable', 'string', 'max:2000'],
            'org_unit_id' => ['required', 'integer', Rule::exists('org_units', 'id')->where('is_active', true)],
        ]);
        abort_unless($request->user()->can('createFor', [WorkProgram::class, (int) $data['org_unit_id']]), 403,
            'Hanya pimpinan unit (atau pimpinan di atasnya) yang dapat membuat program kerja.');

        $program = $this->service->create($request->user(), $data);

        return $this->detail($program, $request)->response()->setStatusCode(201);
    }

    public function show(Request $request, WorkProgram $workProgram): JsonResource
    {
        $this->authorize('view', $workProgram);

        return $this->detail($workProgram, $request);
    }

    public function update(Request $request, WorkProgram $workProgram): JsonResource
    {
        $this->authorize('manage', $workProgram);
        $data = $request->validate([
            'code' => ['sometimes', 'required', 'string', 'max:10'],
            'title' => ['sometimes', 'required', 'string', 'max:200'],
            'description' => ['nullable', 'string', 'max:2000'],
            'status' => ['nullable', Rule::in([WorkProgram::STATUS_ACTIVE, WorkProgram::STATUS_CLOSED])],
        ]);

        return $this->detail($this->service->update($workProgram, $request->user(), $data), $request);
    }

    public function destroy(Request $request, WorkProgram $workProgram): JsonResponse
    {
        $this->authorize('manage', $workProgram);
        $this->service->delete($workProgram, $request->user());

        return response()->json(null, 204);
    }

    public function export(Request $request, WorkProgram $workProgram): BinaryFileResponse
    {
        $this->authorize('view', $workProgram);
        $workProgram->load(['orgUnit', 'items.activities.pics']);

        return Excel::download(new WorkProgramExport($workProgram), "program-kerja-{$workProgram->year}-{$workProgram->code}.xlsx");
    }

    // ── Items ─────────────────────────────────────────────────────────────────

    public function storeItem(Request $request, WorkProgram $workProgram): JsonResource
    {
        $this->authorize('manage', $workProgram);
        $data = $request->validate([
            'code' => ['required', 'string', 'max:15'],
            'title' => ['required', 'string', 'max:200'],
            'description' => ['nullable', 'string', 'max:2000'],
        ]);
        $this->service->addItem($workProgram, $request->user(), $data);

        return $this->detail($workProgram, $request);
    }

    public function updateItem(Request $request, WorkProgramItem $workProgramItem): JsonResource
    {
        $this->authorize('manage', $workProgramItem->program);
        $data = $request->validate([
            'code' => ['sometimes', 'required', 'string', 'max:15'],
            'title' => ['sometimes', 'required', 'string', 'max:200'],
            'description' => ['nullable', 'string', 'max:2000'],
        ]);
        $this->service->updateItem($workProgramItem, $request->user(), $data);

        return $this->detail($workProgramItem->program, $request);
    }

    public function destroyItem(Request $request, WorkProgramItem $workProgramItem): JsonResource
    {
        $program = $workProgramItem->program;
        $this->authorize('manage', $program);
        $this->service->deleteItem($workProgramItem, $request->user());

        return $this->detail($program, $request);
    }

    // ── Activities ────────────────────────────────────────────────────────────

    public function storeActivity(Request $request, WorkProgramItem $workProgramItem): JsonResponse
    {
        $this->authorize('manage', $workProgramItem->program);
        $data = $request->validate($this->activityRules(true));
        $activity = $this->service->addActivity($workProgramItem, $request->user(), $data);

        return $this->activity($activity, $request)->response()->setStatusCode(201);
    }

    public function showActivity(Request $request, WorkProgramActivity $workProgramActivity): JsonResource
    {
        $this->authorize('view', $workProgramActivity->item->program);

        return $this->activity($workProgramActivity, $request, true);
    }

    public function updateActivity(Request $request, WorkProgramActivity $workProgramActivity): JsonResource
    {
        $this->authorize('updateActivity', $workProgramActivity);
        $full = $request->user()->can('manage', $workProgramActivity->item->program);
        $data = $request->validate($full ? $this->activityRules(false) : [
            'remarks' => ['nullable', 'string', 'max:2000'],
            'progress_pct' => ['nullable', 'integer', 'min:0', 'max:100'],
        ]);

        return $this->activity($this->service->updateActivity($workProgramActivity, $request->user(), $data, $full), $request, true);
    }

    public function setActivityStatus(Request $request, WorkProgramActivity $workProgramActivity): JsonResource
    {
        $this->authorize('updateActivity', $workProgramActivity);
        $data = $request->validate([
            'status' => ['required', Rule::in(WorkProgramActivityStatus::values())],
            'notes' => ['nullable', 'string', 'max:1000'],
            'closed_date' => ['nullable', 'date_format:Y-m-d'],
        ]);

        return $this->activity(
            $this->service->setActivityStatus($workProgramActivity, $request->user(), $data['status'], $data['notes'] ?? null, $data['closed_date'] ?? null),
            $request,
            true,
        );
    }

    public function destroyActivity(Request $request, WorkProgramActivity $workProgramActivity): JsonResponse
    {
        $this->authorize('manage', $workProgramActivity->item->program);
        $this->service->deleteActivity($workProgramActivity, $request->user());

        return response()->json(null, 204);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function activityRules(bool $create): array
    {
        $req = $create ? 'required' : 'sometimes';

        return [
            'title' => [$req, 'string', 'max:250'],
            'action_plan' => ['nullable', 'string', 'max:5000'],
            'target_date' => ['nullable', 'date_format:Y-m-d'],
            'remarks' => ['nullable', 'string', 'max:2000'],
            'status' => ['nullable', Rule::in(WorkProgramActivityStatus::values())],
            'progress_pct' => ['nullable', 'integer', 'min:0', 'max:100'],
            'pics' => ['nullable', 'array', 'max:20'],
            'pics.*.user_id' => ['required', 'integer', 'distinct', Rule::exists('users', 'id')->where('is_active', true)],
            'pics.*.role' => ['nullable', Rule::in([WorkProgramActivity::PIC_UTAMA, WorkProgramActivity::PIC_PENDUKUNG])],
        ];
    }

    private function detail(WorkProgram $program, Request $request): WorkProgramResource
    {
        $siblings = $this->service->visible($request->user())
            ->where('org_unit_id', $program->org_unit_id)
            ->orderByDesc('year')->orderBy('code')
            ->get(['id', 'year', 'code', 'title', 'status'])
            ->map(fn (WorkProgram $p) => ['id' => $p->id, 'year' => (int) $p->year, 'code' => $p->code, 'title' => $p->title, 'status' => $p->status])
            ->values()->all();

        return (new WorkProgramResource($program->fresh()->load(self::DETAIL)))->detail()->withSiblings($siblings);
    }

    private function activity(WorkProgramActivity $activity, Request $request, bool $logs = false): WorkProgramActivityResource
    {
        $activity = $activity->fresh()->load(['pics', 'item.program'] + ($logs ? ['logs.user'] : []))->loadCount('dailyActivities');
        $resource = (new WorkProgramActivityResource($activity))
            ->withPermissions($request->user(), $request->user()->can('manage', $activity->item->program));

        return $logs ? $resource->withLogs() : $resource;
    }

    private function person(User $u, Request $request): array
    {
        return (new UserBriefResource($u))->toArray($request) + [
            'grade_code' => $u->grade_code,
            'org_unit' => $u->orgUnit ? ['id' => $u->orgUnit->id, 'name' => $u->orgUnit->name] : null,
        ];
    }
}
