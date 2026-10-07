<?php

namespace App\Http\Resources;

use App\Models\StatusLog;
use App\Models\User;
use App\Models\WorkProgram;
use App\Models\WorkProgramActivity;
use App\Models\WorkProgramItem;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Gate;

/**
 * List shape by default; `->detail()` adds items with their activities, logs and permissions.
 *
 * @mixin WorkProgram
 */
class WorkProgramResource extends JsonResource
{
    public const ACTION_LABELS = [
        'create' => 'Program dibuat',
        'update' => 'Program diubah',
        'close' => 'Program ditutup',
        'reopen' => 'Program dibuka kembali',
        'delete' => 'Program dihapus',
        'item_added' => 'Sub-item ditambah',
        'item_updated' => 'Sub-item diubah',
        'item_deleted' => 'Sub-item dihapus',
    ];

    private bool $detail = false;

    /** @var array<int, array{id: int, year: int, code: string, title: string, status: string}> */
    private array $siblings = [];

    /** Programmes of the same org unit the viewer may open (all years), for the year switcher. */
    public function withSiblings(array $siblings): static
    {
        $this->siblings = $siblings;

        return $this;
    }

    public function detail(): static
    {
        $this->detail = true;

        return $this;
    }

    public function toArray($request): array
    {
        $activities = $this->relationLoaded('items')
            ? $this->items->flatMap(fn (WorkProgramItem $i) => $i->activities)
            : $this->activities;
        $counts = $activities->countBy(fn (WorkProgramActivity $a) => $a->status->value);

        $data = [
            'id' => $this->id,
            'year' => $this->year,
            'code' => $this->code,
            'title' => $this->title,
            'description' => $this->description,
            'status' => $this->status,
            'status_label' => $this->status === WorkProgram::STATUS_CLOSED ? 'DITUTUP' : 'AKTIF',
            'org_unit' => $this->orgUnit ? [
                'id' => $this->orgUnit->id, 'code' => $this->orgUnit->code, 'name' => $this->orgUnit->name, 'type' => $this->orgUnit->type,
            ] : null,
            'items_count' => $this->relationLoaded('items') ? $this->items->count() : (int) ($this->items_count ?? 0),
            'activities_count' => $activities->count(),
            'counts' => [
                'open' => (int) ($counts['open'] ?? 0),
                'on_progress' => (int) ($counts['on_progress'] ?? 0),
                'closed' => (int) ($counts['closed'] ?? 0),
                'cancelled' => (int) ($counts['cancelled'] ?? 0),
            ],
            'progress_pct' => WorkProgram::progressOf($activities),
            'created_by' => $this->createdBy ? new UserBriefResource($this->createdBy) : null,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];

        if (! $this->detail) {
            return $data;
        }

        $user = $request->user();
        $canManage = Gate::forUser($user)->allows('manage', $this->resource);

        $data['items'] = $this->items->map(fn (WorkProgramItem $item) => [
            'id' => $item->id,
            'code' => $item->code,
            'title' => $item->title,
            'description' => $item->description,
            'sort_order' => $item->sort_order,
            'activities_count' => $item->activities->count(),
            'counts' => [
                'open' => $item->activities->where('status.value', 'open')->count(),
                'on_progress' => $item->activities->where('status.value', 'on_progress')->count(),
                'closed' => $item->activities->where('status.value', 'closed')->count(),
                'cancelled' => $item->activities->where('status.value', 'cancelled')->count(),
            ],
            'progress_pct' => WorkProgram::progressOf($item->activities),
            'activities' => $item->activities->map(fn (WorkProgramActivity $a) => (new WorkProgramActivityResource($a))->withPermissions($user, $canManage)->toArray($request))->values(),
        ])->values();
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
        $data['siblings'] = $this->siblings;
        $data['permissions'] = [
            'can_manage' => $canManage,
            'can_add_activity' => $canManage && $this->status === WorkProgram::STATUS_ACTIVE,
        ];

        return $data;
    }

    /** @param  User  $user */
    public static function picPayload(User $user, string $role): array
    {
        return (new UserBriefResource($user))->toArray(request()) + ['role' => $role];
    }
}
