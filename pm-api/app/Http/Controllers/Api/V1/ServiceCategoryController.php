<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ExecutorUnit;
use App\Models\OrgUnit;
use App\Models\ServiceCategory;
use App\Models\User;
use App\Services\Org\ServiceCategoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Kategori layanan per seksi: every seksi member adds, leads/admin rename or deactivate. */
class ServiceCategoryController extends Controller
{
    public function __construct(private ServiceCategoryService $categories)
    {
    }

    /** The seksi I may add categories to, with their executor unit (if any) and all categories. */
    public function sections(Request $request): JsonResponse
    {
        $user = $request->user();
        $sections = $this->categories->sectionsFor($user)->load('parent.parent');
        $units = ExecutorUnit::query()->whereIn('org_unit_id', $sections->pluck('id'))
            ->with(['categories' => fn ($q) => $q->orderBy('sort_order')->orderBy('name')])
            ->get()->keyBy('org_unit_id');

        return response()->json(['data' => $sections->map(fn (OrgUnit $seksi) => $this->section($user, $seksi, $units[$seksi->id] ?? null))->values()]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'org_unit_id' => ['required', 'integer'],
            'name' => ['required', 'string', 'min:2', 'max:100'],
            'for_work_order' => ['nullable', 'boolean'],
            'for_request' => ['nullable', 'boolean'],
            'requires_note' => ['nullable', 'boolean'],
        ]);
        $seksi = OrgUnit::query()->findOrFail($data['org_unit_id']);
        abort_unless($this->categories->canAdd($request->user(), $seksi), 403, 'Anda hanya dapat menambah kategori untuk seksi Anda sendiri.');

        $category = $this->categories->add($request->user(), $seksi, $data);

        return response()->json(['data' => $this->category($category)], 201);
    }

    public function update(Request $request, ServiceCategory $serviceCategory): JsonResponse
    {
        $unit = ExecutorUnit::withTrashed()->findOrFail($serviceCategory->executor_unit_id);
        abort_unless($this->categories->canManage($request->user(), $unit), 403,
            'Hanya pimpinan unit pelaksana yang dapat mengubah atau menonaktifkan kategori.');

        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'min:2', 'max:100'],
            'for_work_order' => ['sometimes', 'boolean'],
            'for_request' => ['sometimes', 'boolean'],
            'requires_note' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        return response()->json(['data' => $this->category($this->categories->update($serviceCategory, $data))]);
    }

    private function section(User $user, OrgUnit $seksi, ?ExecutorUnit $unit): array
    {
        $path = [];
        for ($parent = $seksi->parent; $parent && count($path) < 2; $parent = $parent->parent) {
            $path[] = $parent->name;
        }

        return [
            'org_unit' => ['id' => $seksi->id, 'code' => $seksi->code, 'name' => $seksi->name, 'parents' => $path],
            'executor_unit' => $unit ? ['id' => $unit->id, 'code' => $unit->code, 'display_name' => $unit->display_name, 'is_active' => $unit->is_active] : null,
            'can_manage' => $this->categories->canManage($user, $unit),
            'categories' => $unit ? $unit->categories->map(fn (ServiceCategory $c) => $this->category($c))->values() : [],
        ];
    }

    private function category(ServiceCategory $c): array
    {
        return [
            'id' => $c->id,
            'executor_unit_id' => $c->executor_unit_id,
            'name' => $c->name,
            'for_work_order' => $c->for_work_order,
            'for_request' => $c->for_request,
            'requires_note' => $c->requires_note,
            'is_active' => $c->is_active,
            'sort_order' => $c->sort_order,
        ];
    }
}
