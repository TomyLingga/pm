<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserBriefResource;
use App\Models\ApprovalStep;
use App\Models\ServiceRequest;
use App\Services\Approvals\ApprovalEngine;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/** "Menunggu Persetujuan Saya" across all document types using the approval engine. */
class ApprovalController extends Controller
{
    private const OVERDUE_HOURS = 24;

    public function pending(Request $request, ApprovalEngine $engine): JsonResponse
    {
        $steps = $engine->pendingFor($request->user())
            ->with(['approvable' => fn ($morph) => $morph->morphWith([
                ServiceRequest::class => ['requester', 'executorUnit'],
            ])])
            ->orderBy('activated_at')
            ->get();

        $items = $steps->map(fn (ApprovalStep $step) => $this->item($step, $request))->filter()->values();

        return response()->json(['data' => $items]);
    }

    public function pendingCount(Request $request, ApprovalEngine $engine): JsonResponse
    {
        return response()->json(['data' => ['count' => $engine->pendingFor($request->user())->count()]]);
    }

    private function item(ApprovalStep $step, Request $request): ?array
    {
        $document = $step->approvable;
        if (! $document instanceof ServiceRequest) {
            return null; // future document types plug in here
        }

        return [
            'step_id' => $step->id,
            'step_key' => $step->step_key,
            'step_label' => $step->step_label,
            'action' => $step->kind === ApprovalStep::KIND_COMPLETION ? 'complete' : 'approve',
            'document_type' => ServiceRequest::MORPH_ALIAS,
            'document_type_label' => 'Form Request',
            'document_id' => $document->id,
            'document_number' => $document->displayNumber(),
            'title' => Str::limit($document->purpose, 120),
            'requester' => (new UserBriefResource($document->requester))->toArray($request),
            'executor_unit' => [
                'id' => $document->executorUnit->id,
                'code' => $document->executorUnit->code,
                'display_name' => $document->executorUnit->display_name,
            ],
            'priority' => $document->priority->value,
            'priority_label' => $document->priority->requestLabel(),
            'waiting_since' => $step->activated_at?->toIso8601String(),
            'overdue' => (bool) $step->activated_at?->lte(now()->subHours(self::OVERDUE_HOURS)),
        ];
    }
}
