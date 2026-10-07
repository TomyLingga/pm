<?php

namespace App\Http\Resources;

use App\Models\DailyActivity;
use App\Models\StatusLog;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;

/**
 * @mixin DailyActivity
 */
class DailyActivityResource extends JsonResource
{
    public const RELATIONS = ['user', 'orgUnit', 'programActivity.item.program', 'workOrder', 'createdBy'];

    public const ACTION_LABELS = [
        'create' => 'Laporan dibuat',
        'update' => 'Laporan diubah',
        'status' => 'Status diubah',
        'delete' => 'Laporan dihapus',
    ];

    private bool $detail = false;

    public function detail(): static
    {
        $this->detail = true;

        return $this;
    }

    public function toArray($request): array
    {
        $program = $this->programActivity?->item?->program;
        $data = [
            'id' => $this->id,
            'activity_date' => $this->activity_date->toDateString(),
            'week_of_month' => $this->week_of_month,
            'title' => $this->title,
            'description' => $this->description,
            'follow_up' => $this->follow_up,
            'obstacles' => $this->obstacles,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'closed_at' => $this->closed_at?->toIso8601String(),
            'user' => new UserBriefResource($this->user),
            'org_unit' => $this->orgUnit ? ['id' => $this->orgUnit->id, 'code' => $this->orgUnit->code, 'name' => $this->orgUnit->name] : null,
            'program_activity' => $this->programActivity ? [
                'id' => $this->programActivity->id,
                'title' => $this->programActivity->title,
                'item_code' => $this->programActivity->item?->code,
                'item_title' => $this->programActivity->item?->title,
                'program_id' => $program?->id,
                'program_code' => $program?->code,
                'program_title' => $program?->title,
            ] : null,
            'work_order' => $this->workOrder ? [
                'id' => $this->workOrder->id,
                'wo_number' => $this->workOrder->wo_number,
                'status' => $this->workOrder->status?->value,
                'request_description' => Str::limit((string) $this->workOrder->request_description, 160),
            ] : null,
            'created_by' => $this->createdBy ? new UserBriefResource($this->createdBy) : null,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];

        if (! $this->detail) {
            return $data;
        }

        $user = $request->user();
        $data['logs'] = $this->logs->map(fn (StatusLog $log) => [
            'id' => $log->id,
            'action' => $log->action,
            'action_label' => self::ACTION_LABELS[$log->action] ?? $log->action,
            'from_status' => $log->from_status,
            'to_status' => $log->to_status,
            'notes' => $log->notes,
            'user' => $log->user ? new UserBriefResource($log->user) : null,
            'created_at' => $log->created_at?->toIso8601String(),
        ])->values();
        $data['permissions'] = [
            'can_update' => Gate::forUser($user)->allows('update', $this->resource),
            'can_delete' => Gate::forUser($user)->allows('delete', $this->resource),
        ];

        return $data;
    }
}
