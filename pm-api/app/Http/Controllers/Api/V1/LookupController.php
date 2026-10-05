<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserBriefResource;
use App\Models\Equipment;
use App\Models\ExecutorUnit;
use App\Models\Location;
use App\Models\Material;
use App\Models\Office;
use App\Models\ServiceCategory;
use App\Models\User;
use App\Services\Org\ExecutorDirectory;
use App\Services\ServiceRequests\ServiceRequestService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Read-only master data for forms (dropdowns / search). */
class LookupController extends Controller
{
    private const LIMIT = 50;

    public function executorUnits(Request $request): JsonResponse
    {
        $forRequest = $request->query('for') === 'request';

        $units = ExecutorUnit::query()
            ->where('is_active', true)
            ->where($forRequest ? 'accepts_requests' : 'accepts_work_orders', true)
            ->with(['categories' => fn ($q) => $q->where('is_active', true)->where($forRequest ? 'for_request' : 'for_work_order', true)])
            ->orderBy('display_name')
            ->get();

        return response()->json(['data' => $units->map(fn (ExecutorUnit $u) => $this->executorUnit($u))->values()]);
    }

    /** "Petunjuk dan Aturan" + footer printed on the Form Request; edited by the unit's leads. */
    public function updateRequestSettings(Request $request, ExecutorUnit $executorUnit, ExecutorDirectory $directory): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->isAdmin() || ($directory->isStaff($user, $executorUnit) && $directory->hasLeadGrade($user)), 403,
            'Hanya pimpinan unit pelaksana yang dapat mengubah pengaturan ini.');

        $executorUnit->update($request->validate([
            'request_rules' => ['nullable', 'string', 'max:5000'],
            'contact_footer' => ['nullable', 'string', 'max:255'],
        ]));

        return response()->json(['data' => $this->executorUnit($executorUnit->load('categories'))]);
    }

    public function offices(): JsonResponse
    {
        return response()->json(['data' => Office::query()->where('is_active', true)->orderBy('name')->get(['id', 'code', 'name'])]);
    }

    /** Active users with a higher grade than me, for the "Atasan YBS" dropdown. */
    public function superiorCandidates(Request $request, ServiceRequestService $service): JsonResponse
    {
        $users = $service->superiorCandidates($request->user(), $request->query('q'))->limit(30)->get();

        return response()->json(['data' => $users->map(fn (User $u) => $this->superior($u, $request))->values()]);
    }

    /** Default superior (own last choice, else Portal atasan_id). */
    public function mySuperior(Request $request, ServiceRequestService $service): JsonResponse
    {
        $superior = $service->defaultSuperior($request->user());

        return response()->json(['data' => $superior ? $this->superior($superior, $request) : null]);
    }

    private function executorUnit(ExecutorUnit $u): array
    {
        return [
            'id' => $u->id,
            'code' => $u->code,
            'display_name' => $u->display_name,
            'request_rules' => $u->request_rules,
            'contact_footer' => $u->contact_footer,
            'categories' => $u->categories->map(fn (ServiceCategory $c) => [
                'id' => $c->id,
                'name' => $c->name,
                'requires_note' => $c->requires_note,
            ])->values(),
        ];
    }

    private function superior(User $user, Request $request): array
    {
        return array_merge((new UserBriefResource($user))->toArray($request), [
            'grade_code' => $user->grade_code,
            'grade_level' => $user->grade_level,
        ]);
    }

    /** Staff list for assigning technicians; only visible to that unit's staff. */
    public function staff(Request $request, ExecutorUnit $executorUnit, ExecutorDirectory $directory): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->isAdmin() || $directory->isStaff($user, $executorUnit), 403, 'Anda bukan anggota unit pelaksana ini.');

        $staff = $directory->staffQuery($executorUnit)->orderByDesc('grade_level')->orderBy('name')->get();

        return response()->json(['data' => $staff->map(fn (User $s) => array_merge(
            (new UserBriefResource($s))->toArray($request),
            ['grade_code' => $s->grade_code, 'is_lead' => $directory->hasLeadGrade($s)],
        ))->values()]);
    }

    public function locations(Request $request): JsonResponse
    {
        $rows = $this->search(Location::query()->where('is_active', true), $request->query('q'))
            ->orderBy('name')->limit(self::LIMIT)->get(['id', 'code', 'name']);

        return response()->json(['data' => $rows]);
    }

    public function equipment(Request $request): JsonResponse
    {
        $rows = $this->search(Equipment::query()->with('location:id,code,name'), $request->query('q'))
            ->when($request->query('executor_unit_id'), fn (Builder $q, $id) => $q->where(
                fn (Builder $w) => $w->where('executor_unit_id', $id)->orWhereNull('executor_unit_id')
            ))
            ->where('status', '!=', 'disposed')
            ->orderBy('code')->limit(self::LIMIT)->get();

        return response()->json(['data' => $rows->map(fn (Equipment $e) => [
            'id' => $e->id,
            'code' => $e->code,
            'name' => $e->name,
            'location' => $e->location ? ['id' => $e->location->id, 'code' => $e->location->code, 'name' => $e->location->name] : null,
        ])->values()]);
    }

    public function materials(Request $request): JsonResponse
    {
        $rows = $this->search(Material::query()->where('is_active', true), $request->query('q'))
            ->orderBy('name')->limit(self::LIMIT)->get(['id', 'code', 'name', 'unit']);

        return response()->json(['data' => $rows]);
    }

    private function search(Builder $query, ?string $term): Builder
    {
        if (blank($term)) {
            return $query;
        }
        $like = '%'.mb_strtolower(trim($term)).'%';

        return $query->where(fn (Builder $q) => $q->whereRaw('LOWER(code) LIKE ?', [$like])->orWhereRaw('LOWER(name) LIKE ?', [$like]));
    }
}
