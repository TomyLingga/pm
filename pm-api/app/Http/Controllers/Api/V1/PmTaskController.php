<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\InvalidTransitionException;
use App\Exports\PmTasksExport;
use App\Http\Controllers\Controller;
use App\Http\Requests\Pm\FindingWorkOrderRequest;
use App\Http\Requests\Pm\PmTaskAnswersRequest;
use App\Http\Requests\ReasonRequest;
use App\Http\Resources\AttachmentResource;
use App\Http\Resources\PmTaskListResource;
use App\Http\Resources\PmTaskResource;
use App\Models\PmTask;
use App\Models\PmTaskItem;
use App\Services\Documents\AttachmentService;
use App\Services\Pm\PmCalendar;
use App\Services\Pm\PmTaskQuery;
use App\Services\Pm\PmTaskService;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class PmTaskController extends Controller
{
    public function __construct(private PmTaskService $service)
    {
    }

    public function index(Request $request, PmTaskQuery $query): AnonymousResourceCollection
    {
        $page = $query->build($request->user(), $this->filters($request))
            ->with(PmTaskListResource::RELATIONS)->withCount('findings')
            ->paginate(min((int) ($request->query('per_page') ?: 20), 100))
            ->withQueryString();

        return PmTaskListResource::collection($page);
    }

    /** Counts for menu/tab badges. */
    public function summary(Request $request, PmTaskQuery $query): JsonResponse
    {
        return response()->json(['data' => [
            'mine' => $query->counts($request->user(), 'mine'),
            'unit' => $query->counts($request->user(), 'unit'),
        ]]);
    }

    public function calendar(Request $request, PmCalendar $calendar): JsonResponse
    {
        $data = $request->validate([
            'start' => ['required', 'date_format:Y-m-d'],
            'end' => ['required', 'date_format:Y-m-d', 'after_or_equal:start'],
            'scope' => ['nullable', Rule::in(PmTaskQuery::SCOPES)],
            'executor_unit_id' => ['nullable', 'integer'],
            'equipment_id' => ['nullable', 'integer'],
            'pic_user_id' => ['nullable', 'integer'],
        ]);

        $start = CarbonImmutable::parse($data['start'], config('app.timezone'))->startOfDay();
        $end = CarbonImmutable::parse($data['end'], config('app.timezone'))->endOfDay();
        if ($start->diffInDays($end) > PmCalendar::MAX_RANGE_DAYS) {
            throw ValidationException::withMessages(['end' => ['Rentang kalender maksimal '.PmCalendar::MAX_RANGE_DAYS.' hari.']]);
        }

        return response()->json(['data' => $calendar->events($request->user(), $start, $end, $data)]);
    }

    public function export(Request $request, PmTaskQuery $query): BinaryFileResponse
    {
        $builder = $query->build($request->user(), $this->filters($request))->with(PmTasksExport::RELATIONS)->withCount('findings');

        return Excel::download(new PmTasksExport($builder), 'tugas-pm-'.now()->format('Ymd-Hi').'.xlsx');
    }

    public function show(PmTask $pmTask): PmTaskResource
    {
        $this->authorize('view', $pmTask);

        return $this->detail($pmTask);
    }

    public function start(Request $request, PmTask $pmTask): PmTaskResource
    {
        $this->authorize('work', $pmTask);

        return $this->detail($this->service->start($pmTask, $request->user()));
    }

    public function items(PmTaskAnswersRequest $request, PmTask $pmTask): PmTaskResource
    {
        $this->authorize('work', $pmTask);

        return $this->detail($this->service->saveItems($pmTask, $request->validated()['items']));
    }

    public function materials(PmTaskAnswersRequest $request, PmTask $pmTask): PmTaskResource
    {
        $this->authorize('work', $pmTask);

        return $this->detail($this->service->saveMaterials($pmTask, $request->validated()['materials'] ?? []));
    }

    public function complete(PmTaskAnswersRequest $request, PmTask $pmTask): PmTaskResource
    {
        $this->authorize('work', $pmTask);

        return $this->detail($this->service->complete($pmTask, $request->user(), $request->validated()));
    }

    public function proposeSkip(ReasonRequest $request, PmTask $pmTask): PmTaskResource
    {
        $this->authorize('proposeSkip', $pmTask);

        return $this->detail($this->service->proposeSkip($pmTask, $request->user(), $request->input('reason')));
    }

    public function skip(ReasonRequest $request, PmTask $pmTask): PmTaskResource
    {
        $this->authorize('skip', $pmTask);

        return $this->detail($this->service->skip($pmTask, $request->user(), $request->input('reason')));
    }

    public function reassign(Request $request, PmTask $pmTask): PmTaskResource
    {
        $this->authorize('reassign', $pmTask);
        $data = $request->validate(['pic_user_id' => ['required', 'integer', 'exists:users,id']]);

        return $this->detail($this->service->reassign($pmTask, $request->user(), (int) $data['pic_user_id']));
    }

    /** Photo for the task or — with `item_id` — for one checklist item (camera upload from the phone). */
    public function attach(Request $request, PmTask $pmTask, AttachmentService $attachments): JsonResponse
    {
        $this->authorize('upload', $pmTask);
        $data = $request->validate([
            'file' => ['required', 'file', 'mimes:'.implode(',', config('pm.attachments.mimes')), 'max:'.config('pm.attachments.max_kb')],
            'item_id' => ['nullable', 'integer', Rule::exists('pm_task_items', 'id')->where('pm_task_id', $pmTask->id)],
        ]);
        if (! PmTaskService::statusAllows($pmTask, 'work')) {
            throw new InvalidTransitionException('Foto hanya dapat ditambahkan saat tugas sedang dikerjakan.');
        }

        $owner = empty($data['item_id']) ? $pmTask : PmTaskItem::query()->findOrFail($data['item_id']);
        $file = $request->file('file');
        $attachment = $attachments->store(
            $owner, $file, str_starts_with((string) $file->getMimeType(), 'image/') ? 'photo' : 'document', $request->user(),
            (int) config($owner instanceof PmTask ? 'pm.preventive.max_task_photos' : 'pm.preventive.max_item_photos')
        );

        return (new AttachmentResource($attachment->load('uploadedBy')))->response()->setStatusCode(201);
    }

    public function findingWorkOrder(FindingWorkOrderRequest $request, PmTask $pmTask, PmTaskItem $item): JsonResponse
    {
        $this->authorize('work', $pmTask);
        abort_unless((int) $item->pm_task_id === (int) $pmTask->id, 404);

        $this->service->createWorkOrderFromFinding($pmTask, $item, $request->user(), $request->validated());

        return $this->detail($pmTask)->response()->setStatusCode(201);
    }

    private function detail(PmTask $task): PmTaskResource
    {
        return new PmTaskResource($task->fresh(PmTaskResource::RELATIONS)->loadCount('findings'));
    }

    private function filters(Request $request): array
    {
        return $request->validate([
            'scope' => ['nullable', Rule::in(PmTaskQuery::SCOPES)],
            'status' => ['nullable', 'string', 'max:200'],
            'executor_unit_id' => ['nullable', 'integer'],
            'equipment_id' => ['nullable', 'integer'],
            'schedule_id' => ['nullable', 'integer'],
            'pic_user_id' => ['nullable', 'integer'],
            'due_from' => ['nullable', 'date_format:Y-m-d'],
            'due_to' => ['nullable', 'date_format:Y-m-d'],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
            'q' => ['nullable', 'string', 'max:100'],
            'sort' => ['nullable', 'in:due_at,-due_at'],
        ]);
    }
}
