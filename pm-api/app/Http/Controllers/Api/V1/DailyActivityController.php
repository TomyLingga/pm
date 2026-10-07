<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\DailyActivityStatus;
use App\Exports\DailyActivitiesExport;
use App\Exports\Templates\DailyActivityTemplate;
use App\Http\Controllers\Controller;
use App\Http\Resources\DailyActivityResource;
use App\Http\Resources\UserBriefResource;
use App\Models\DailyActivity;
use App\Models\User;
use App\Services\Activities\DailyActivityImporter;
use App\Services\Activities\DailyActivityService;
use App\Services\Org\OrgVisibility;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Validation\Rule;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class DailyActivityController extends Controller
{
    public function __construct(private DailyActivityService $service, private OrgVisibility $visibility)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $filters = $this->filters($request);
        $query = $this->service->filtered($request->user(), $filters);
        $summary = $this->service->summary($query);
        $page = (clone $query)->with(DailyActivityResource::RELATIONS)
            ->orderByDesc('activity_date')->orderByDesc('id')
            ->paginate((int) ($filters['per_page'] ?? 20));

        return response()->json([
            'data' => DailyActivityResource::collection($page->items())->toArray($request),
            'meta' => [
                'current_page' => $page->currentPage(),
                'from' => $page->firstItem(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'to' => $page->lastItem(),
                'total' => $page->total(),
                'summary' => $summary,
                'scope' => $filters['scope'] ?? 'mine',
                'available_scopes' => $this->availableScopes($request->user()),
                'can_report_for_others' => $this->visibility->isLead($request->user()),
            ],
        ]);
    }

    public function export(Request $request): BinaryFileResponse
    {
        $query = $this->service->filtered($request->user(), $this->filters($request))
            ->with(DailyActivityResource::RELATIONS)->orderByDesc('activity_date')->orderByDesc('id');

        return Excel::download(new DailyActivitiesExport($query), 'aktivitas-harian-'.now()->format('Ymd-Hi').'.xlsx');
    }

    /** People whose reports I may read / write on behalf of (leads: my subtree; admins: everyone). */
    public function people(Request $request): JsonResponse
    {
        $term = mb_strtolower(trim((string) $request->query('q', '')));
        $query = $this->reportablePeople($request->user())->limit(50)
            ->when($term !== '', fn (Builder $q) => $q->where(fn (Builder $w) => $w
                ->whereRaw('LOWER(name) LIKE ?', ["%{$term}%"])->orWhereRaw('LOWER(nrk) LIKE ?', ["%{$term}%"])));

        return response()->json(['data' => $query->get()->map(fn (User $u) => (new UserBriefResource($u))->toArray($request) + [
            'grade_code' => $u->grade_code,
            'org_unit' => $u->orgUnit ? ['id' => $u->orgUnit->id, 'name' => $u->orgUnit->name] : null,
        ])->values()]);
    }

    /** Excel template for bulk entry: sheet "Data" to fill, plus Contoh, Petunjuk and the NRK reference. */
    public function importTemplate(Request $request): BinaryFileResponse
    {
        $people = $this->reportablePeople($request->user())->limit(500)->get();

        return Excel::download(new DailyActivityTemplate($people), 'template-aktivitas-harian.xlsx');
    }

    /** Upload a filled template; all rows are validated first (422 with `rows.<n>` messages), then created. */
    public function import(Request $request, DailyActivityImporter $importer): JsonResponse
    {
        $request->validate(['file' => ['required', 'file', 'mimes:xlsx,xls,csv', 'max:5120']]);

        return response()->json(['data' => $importer->import($request->user(), $request->file('file')->getRealPath())]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules(true));
        if (! empty($data['user_id'])) {
            abort_unless($request->user()->can('reportFor', [DailyActivity::class, User::query()->findOrFail($data['user_id'])]), 403,
                'Anda hanya dapat melaporkan aktivitas untuk diri sendiri atau anggota unit di bawah Anda.');
        }
        $activity = $this->service->create($request->user(), $data);

        return $this->detail($activity, $request)->response()->setStatusCode(201);
    }

    public function show(Request $request, DailyActivity $dailyActivity): JsonResource
    {
        $this->authorize('view', $dailyActivity);

        return $this->detail($dailyActivity, $request);
    }

    public function update(Request $request, DailyActivity $dailyActivity): JsonResource
    {
        $this->authorize('update', $dailyActivity);
        $data = $request->validate($this->rules(false));

        return $this->detail($this->service->update($dailyActivity, $request->user(), $data), $request);
    }

    public function setStatus(Request $request, DailyActivity $dailyActivity): JsonResource
    {
        $this->authorize('update', $dailyActivity);
        $data = $request->validate([
            'status' => ['required', Rule::in(DailyActivityStatus::values())],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        return $this->detail($this->service->setStatus($dailyActivity, $request->user(), $data['status'], $data['notes'] ?? null), $request);
    }

    public function destroy(Request $request, DailyActivity $dailyActivity): JsonResponse
    {
        $this->authorize('delete', $dailyActivity);
        $this->service->delete($dailyActivity, $request->user());

        return response()->json(null, 204);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function filters(Request $request): array
    {
        return $request->validate([
            'scope' => ['nullable', Rule::in(DailyActivityService::SCOPES)],
            'year' => ['nullable', 'integer', 'min:2000', 'max:2100'],
            'month' => ['nullable', 'integer', 'min:1', 'max:12'],
            'week' => ['nullable', 'integer', 'min:1', 'max:5'],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
            'status' => ['nullable', 'string', 'max:60'],
            'user_id' => ['nullable', 'integer'],
            'work_program_activity_id' => ['nullable', 'integer'],
            'q' => ['nullable', 'string', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);
    }

    private function rules(bool $create): array
    {
        $req = $create ? 'required' : 'sometimes';

        return [
            'activity_date' => [$req, 'date_format:Y-m-d'],
            'title' => [$req, 'string', 'max:250'],
            'description' => [$req, 'string', 'max:5000'],
            'follow_up' => ['nullable', 'string', 'max:2000'],
            'obstacles' => ['nullable', 'string', 'max:2000'],
            'status' => $create ? ['nullable', Rule::in(DailyActivityStatus::values())] : ['prohibited'],
            'user_id' => $create ? ['nullable', 'integer', Rule::exists('users', 'id')->where('is_active', true)] : ['prohibited'],
            'work_program_activity_id' => ['nullable', 'integer', Rule::exists('work_program_activities', 'id')->whereNull('deleted_at')],
        ];
    }

    /** Active people I may report for: admins everyone, leads their subtree, others themselves. */
    private function reportablePeople(User $user): Builder
    {
        $query = User::query()->where('is_active', true)->with('orgUnit')->orderBy('name');
        if ($user->isAdmin()) {
            return $query;
        }

        return $this->visibility->isLead($user)
            ? $query->whereIn('org_unit_id', $this->visibility->subtreeIds($user) ?: [0])
            : $query->whereKey($user->id);
    }

    private function availableScopes(User $user): array
    {
        $scopes = ['mine'];
        if ($this->visibility->isLead($user)) {
            $scopes[] = 'team';
        }
        if ($user->isAdmin()) {
            $scopes[] = 'all';
        }

        return $scopes;
    }

    private function detail(DailyActivity $activity, Request $request): DailyActivityResource
    {
        return (new DailyActivityResource($activity->fresh()->load(DailyActivityResource::RELATIONS + ['logs.user'])))->detail();
    }
}
