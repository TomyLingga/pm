<?php

namespace App\Http\Resources;

use App\Models\StatusLog;
use App\Models\User;
use App\Models\WorkProgramActivity;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One programme activity row. `withPermissions()` adds `permissions`; `withLogs()` adds the status trail.
 *
 * @mixin WorkProgramActivity
 */
class WorkProgramActivityResource extends JsonResource
{
    public const ACTION_LABELS = [
        'create' => 'Kegiatan dibuat',
        'update' => 'Kegiatan diubah',
        'status' => 'Status diubah',
        'delete' => 'Kegiatan dihapus',
    ];

    private ?User $viewer = null;
    private bool $canManage = false;
    private bool $includeLogs = false;

    public function withPermissions(User $viewer, bool $canManage): static
    {
        $this->viewer = $viewer;
        $this->canManage = $canManage;

        return $this;
    }

    public function withLogs(): static
    {
        $this->includeLogs = true;

        return $this;
    }

    public function toArray($request): array
    {
        $data = [
            'id' => $this->id,
            'work_program_item_id' => $this->work_program_item_id,
            'sequence' => $this->sequence,
            'title' => $this->title,
            'action_plan' => $this->action_plan,
            'target_date' => $this->target_date?->toDateString(),
            'closed_date' => $this->closed_date?->toDateString(),
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'progress_pct' => $this->progress_pct,
            'remarks' => $this->remarks,
            'pics' => $this->pics->map(fn (User $u) => (new UserBriefResource($u))->toArray($request) + ['role' => $u->pivot->role])->values(),
            'daily_activities_count' => $this->relationLoaded('dailyActivities') ? $this->dailyActivities->count() : (int) ($this->daily_activities_count ?? 0),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];

        if ($this->viewer) {
            $isPic = $this->pics->contains('id', $this->viewer->id);
            $data['permissions'] = [
                'can_edit' => $this->canManage,
                'can_update_progress' => ($this->canManage || $isPic) && ! $this->status->isFinal(),
                'can_change_status' => $this->canManage || $isPic,
                'can_delete' => $this->canManage,
            ];
        }
        if ($this->includeLogs) {
            $data['logs'] = $this->resource->logs->map(fn (StatusLog $log) => [
                'id' => $log->id,
                'action' => $log->action,
                'action_label' => self::ACTION_LABELS[$log->action] ?? $log->action,
                'from_status' => $log->from_status,
                'to_status' => $log->to_status,
                'notes' => $log->notes,
                'user' => $log->user ? new UserBriefResource($log->user) : null,
                'created_at' => $log->created_at?->toIso8601String(),
            ])->values();
        }

        return $data;
    }
}
