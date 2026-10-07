<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Pm\StoreChecklistTemplateRequest;
use App\Http\Resources\ChecklistTemplateResource;
use App\Models\ChecklistTemplate;
use App\Services\Org\ExecutorDirectory;
use App\Services\Pm\ChecklistTemplateService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class ChecklistTemplateController extends Controller
{
    public function __construct(private ChecklistTemplateService $service)
    {
    }

    public function index(Request $request, ExecutorDirectory $directory): AnonymousResourceCollection
    {
        $user = $request->user();

        $templates = ChecklistTemplate::query()
            ->with('executorUnit')->withCount(['items', 'schedules'])
            ->when(! $user->canSeeEverything(), fn (Builder $q) => $q->whereIn('executor_unit_id', $directory->unitIdsFor($user) ?: [0]))
            ->when($request->query('executor_unit_id'), fn (Builder $q, $id) => $q->where('executor_unit_id', $id))
            ->when($request->boolean('active'), fn (Builder $q) => $q->where('is_active', true))
            ->when($request->query('q'), fn (Builder $q, $term) => $q->whereRaw('LOWER(name) LIKE ?', ['%'.mb_strtolower(trim($term)).'%']))
            ->orderBy('name')
            ->limit(300)
            ->get();

        return ChecklistTemplateResource::collection($templates);
    }

    public function store(StoreChecklistTemplateRequest $request): JsonResponse
    {
        $this->authorize('manage', new ChecklistTemplate(['executor_unit_id' => $request->input('executor_unit_id')]));

        return $this->detail($this->service->create($request->validated()))->response()->setStatusCode(201);
    }

    public function show(ChecklistTemplate $checklistTemplate): ChecklistTemplateResource
    {
        $this->authorize('view', $checklistTemplate);

        return $this->detail($checklistTemplate);
    }

    public function update(StoreChecklistTemplateRequest $request, ChecklistTemplate $checklistTemplate): ChecklistTemplateResource
    {
        $this->authorize('manage', $checklistTemplate);

        return $this->detail($this->service->update($checklistTemplate, $request->validated()));
    }

    public function destroy(ChecklistTemplate $checklistTemplate): Response
    {
        $this->authorize('manage', $checklistTemplate);
        $this->service->delete($checklistTemplate);

        return response()->noContent();
    }

    public function duplicate(ChecklistTemplate $checklistTemplate): JsonResponse
    {
        $this->authorize('manage', $checklistTemplate);

        return $this->detail($this->service->duplicate($checklistTemplate))->response()->setStatusCode(201);
    }

    private function detail(ChecklistTemplate $template): ChecklistTemplateResource
    {
        return new ChecklistTemplateResource($template->fresh(['executorUnit', 'items'])->loadCount(['items', 'schedules']));
    }
}
