<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\InvalidTransitionException;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreAttachmentRequest;
use App\Http\Resources\AttachmentResource;
use App\Models\Attachment;
use App\Models\ServiceRequest;
use App\Models\WorkOrder;
use App\Services\Documents\AttachmentService;
use App\Services\ServiceRequests\ServiceRequestService;
use App\Services\WorkOrders\WorkOrderService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** Attachments of Work Orders and Form Requests; access follows the owning document's policy. */
class AttachmentController extends Controller
{
    public function __construct(private AttachmentService $attachments)
    {
    }

    public function store(StoreAttachmentRequest $request, WorkOrder $workOrder): JsonResponse
    {
        $this->authorize('upload', $workOrder);
        if (! WorkOrderService::statusAllows($workOrder, 'upload')) {
            throw new InvalidTransitionException('Lampiran tidak dapat ditambahkan pada WO yang sudah '.$workOrder->status->label().'.');
        }

        return $this->created($workOrder, $request);
    }

    public function storeForRequest(StoreAttachmentRequest $request, ServiceRequest $serviceRequest): JsonResponse
    {
        $this->authorize('upload', $serviceRequest);
        if (! ServiceRequestService::statusAllows($serviceRequest, 'upload')) {
            throw new InvalidTransitionException('Lampiran tidak dapat ditambahkan pada request yang sudah '.$serviceRequest->status->label().'.');
        }

        return $this->created($serviceRequest, $request);
    }

    public function show(Attachment $attachment): StreamedResponse
    {
        $this->authorize('view', $this->owner($attachment));

        return Storage::disk($attachment->disk)->response($attachment->path, $attachment->original_name, [
            'Content-Type' => $attachment->mime_type,
            'Cache-Control' => 'private, max-age=3600',
        ]);
    }

    public function destroy(Attachment $attachment): Response
    {
        $owner = $this->owner($attachment);
        $this->authorize('deleteAttachment', [$owner, $attachment]);
        if ($owner->status->isFinal()) {
            throw new InvalidTransitionException('Lampiran pada dokumen yang sudah final tidak dapat dihapus.');
        }

        // A converted document may share the same stored file; keep it while still referenced.
        $shared = Attachment::query()->where('path', $attachment->path)->whereKeyNot($attachment->id)->exists();
        $shared ? $attachment->delete() : $this->attachments->delete($attachment);

        return response()->noContent();
    }

    private function created(Model $owner, StoreAttachmentRequest $request): JsonResponse
    {
        $attachment = $this->attachments->store($owner, $request->file('file'), $request->input('collection'), $request->user());

        return (new AttachmentResource($attachment->load('uploadedBy')))->response()->setStatusCode(201);
    }

    private function owner(Attachment $attachment): WorkOrder|ServiceRequest
    {
        $owner = $attachment->attachable;
        abort_unless($owner instanceof WorkOrder || $owner instanceof ServiceRequest, 404);

        return $owner;
    }
}
