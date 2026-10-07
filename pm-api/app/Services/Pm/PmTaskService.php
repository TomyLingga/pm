<?php

namespace App\Services\Pm;

use App\Enums\ChecklistInputType;
use App\Enums\ChecklistResult;
use App\Enums\PmTaskStatus;
use App\Exceptions\InvalidTransitionException;
use App\Models\ChecklistTemplateItem;
use App\Models\ExecutorUnit;
use App\Models\Material;
use App\Models\PmTask;
use App\Models\PmTaskItem;
use App\Models\User;
use App\Models\WorkOrder;
use App\Services\Audit\StatusLogger;
use App\Services\Org\ExecutorDirectory;
use App\Services\WorkOrders\WorkOrderService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * User-driven part of the PM task state machine (docs/STATE_MACHINES.md §3).
 * Who may act → PmTaskPolicy (403); when → this class (409).
 */
class PmTaskService
{
    private const ALLOWED = [
        'start' => [PmTaskStatus::Due, PmTaskStatus::Overdue],
        'work' => [PmTaskStatus::InProgress],
        'complete' => [PmTaskStatus::InProgress],
        'propose_skip' => [PmTaskStatus::Scheduled, PmTaskStatus::Due, PmTaskStatus::Overdue],
        'skip' => [PmTaskStatus::Scheduled, PmTaskStatus::Due, PmTaskStatus::Overdue],
        'reassign' => [PmTaskStatus::Scheduled, PmTaskStatus::Due, PmTaskStatus::Overdue, PmTaskStatus::InProgress],
        'create_work_order' => [PmTaskStatus::InProgress, PmTaskStatus::Completed],
    ];

    public function __construct(
        private StatusLogger $logger,
        private PmNotifier $notifier,
        private ExecutorDirectory $directory,
        private WorkOrderService $workOrders,
    ) {
    }

    public static function statusAllows(PmTask $task, string $action): bool
    {
        return in_array($task->status, self::ALLOWED[$action] ?? [], true);
    }

    /** JATUH_TEMPO / TERLAMBAT → DIKERJAKAN. The checklist is copied from the template at this moment. */
    public function start(PmTask $task, User $user): PmTask
    {
        return DB::transaction(function () use ($task, $user) {
            $task = $this->lock($task, 'start');
            $from = $task->status;

            $definitions = ChecklistTemplateItem::query()
                ->where('checklist_template_id', $task->checklist_template_id)
                ->orderBy('sort_order')->orderBy('id')->get();
            foreach ($definitions as $definition) {
                $task->items()->create(
                    $definition->only(ChecklistTemplateItem::DEFINITION_COLUMNS) + ['checklist_template_item_id' => $definition->id]
                );
            }

            $task->fill([
                'status' => PmTaskStatus::InProgress,
                'started_at' => now(),
                'started_by_id' => $user->id,
            ])->save();
            $this->logger->log($task, 'start', $from, $task->status, $user);

            return $task;
        });
    }

    /** Partial save of checklist answers (auto-save from the phone). */
    public function saveItems(PmTask $task, array $rows): PmTask
    {
        return DB::transaction(function () use ($task, $rows) {
            $task = $this->lock($task, 'work');
            $this->applyAnswers($task, $rows);

            return $task;
        });
    }

    public function saveMaterials(PmTask $task, array $rows): PmTask
    {
        return DB::transaction(function () use ($task, $rows) {
            $task = $this->lock($task, 'work');
            $this->replaceMaterials($task, $rows);

            return $task;
        });
    }

    public function complete(PmTask $task, User $user, array $data): PmTask
    {
        // Answers sent along are saved first and stay saved even when completion is refused
        // (e.g. a mandatory photo is missing), so the technician never loses what was typed.
        DB::transaction(function () use ($task, $data) {
            $locked = $this->lock($task, 'complete');
            if (! empty($data['items'])) {
                $this->applyAnswers($locked, $data['items']);
            }
            if (isset($data['materials'])) {
                $this->replaceMaterials($locked, $data['materials']);
            }
        });

        return DB::transaction(function () use ($task, $user, $data) {
            $task = $this->lock($task, 'complete');
            $from = $task->status;
            $this->assertChecklistComplete($task);

            $now = now();
            $task->fill([
                'status' => PmTaskStatus::Completed,
                'completed_at' => $now,
                'completed_by_id' => $user->id,
                'duration_minutes' => $data['duration_minutes'] ?? max(1, (int) $task->started_at->diffInMinutes($now)),
                'notes' => $data['notes'] ?? $task->notes,
                'is_late' => $now->greaterThan($task->overdue_at),
            ])->save();

            $findings = $task->findings()->count();
            $this->logger->log($task, 'complete', $from, $task->status, $user, null, array_filter([
                'findings' => $findings,
                'late' => $task->is_late,
            ]));

            return $task;
        });
    }

    /** Technicians cannot skip; they propose and a lead decides (Q-16). */
    public function proposeSkip(PmTask $task, User $user, string $reason): PmTask
    {
        $task = DB::transaction(function () use ($task, $user, $reason) {
            $task = $this->lock($task, 'propose_skip');
            $task->fill([
                'skip_proposal' => $reason,
                'skip_proposed_by_id' => $user->id,
                'skip_proposed_at' => now(),
            ])->save();
            $this->logger->log($task, 'propose_skip', $task->status, $task->status, $user, $reason);

            return $task;
        });

        $this->notifier->skipProposed($task, $user);

        return $task;
    }

    public function skip(PmTask $task, User $lead, string $reason): PmTask
    {
        $task = DB::transaction(function () use ($task, $lead, $reason) {
            $task = $this->lock($task, 'skip');
            $from = $task->status;
            $task->fill([
                'status' => PmTaskStatus::Skipped,
                'skip_reason' => $reason,
                'skipped_by_id' => $lead->id,
                'skipped_at' => now(),
            ])->save();
            $this->logger->log($task, 'skip', $from, $task->status, $lead, $reason);

            return $task;
        });

        $this->notifier->skipped($task, $lead);

        return $task;
    }

    public function reassign(PmTask $task, User $lead, int $picUserId): PmTask
    {
        $task = DB::transaction(function () use ($task, $lead, $picUserId) {
            $task = $this->lock($task, 'reassign');
            $unit = ExecutorUnit::withTrashed()->findOrFail($task->executor_unit_id);
            $pic = $this->directory->staffQuery($unit)->whereKey($picUserId)->first();
            if (! $pic) {
                throw ValidationException::withMessages(['pic_user_id' => ["PIC harus anggota unit pelaksana {$unit->display_name}."]]);
            }
            if (! $this->directory->canDelegateTo($lead, $pic)) {
                throw ValidationException::withMessages(['pic_user_id' => ['Penugasan hanya ke grade di bawah Anda.']]);
            }

            $previous = $task->pic()->value('name');
            $task->pic_user_id = $pic->id;
            $task->save();
            $this->logger->log($task, 'reassign', $task->status, $task->status, $lead, null, ['from' => $previous, 'to' => $pic->name]);

            return $task;
        });

        $this->notifier->reassigned($task, $lead);

        return $task;
    }

    /** "Buat WO dari temuan": a Work Order for a "Tidak OK" item, pre-filled with the equipment. */
    public function createWorkOrderFromFinding(PmTask $task, PmTaskItem $item, User $user, array $data): WorkOrder
    {
        $workOrder = DB::transaction(function () use ($task, $item, $user, $data) {
            $task = $this->lock($task, 'create_work_order');
            $item = PmTaskItem::query()->where('pm_task_id', $task->id)->lockForUpdate()->findOrFail($item->id);

            if ($item->result !== ChecklistResult::NotOk->value) {
                throw ValidationException::withMessages(['item' => ['Work Order hanya dapat dibuat dari butir dengan hasil Tidak OK.']]);
            }
            if ($item->workOrder()->exists()) {
                throw new InvalidTransitionException('Work Order untuk temuan ini sudah dibuat.');
            }

            $description = $data['request_description']
                ?? trim("Temuan PM {$task->number}: {$item->description}".($item->notes ? " — {$item->notes}" : ''));

            $workOrder = $this->workOrders->create($user, [
                'executor_unit_id' => $data['executor_unit_id'] ?? $task->executor_unit_id,
                'service_category_id' => $data['service_category_id'],
                'category_note' => $data['category_note'] ?? null,
                'equipment_id' => $task->equipment_id,
                'request_description' => $description,
                'priority' => $data['priority'],
            ], ['pm_task_id' => $task->id, 'pm_task_item_id' => $item->id], notify: false);

            $this->logger->log($task, 'create_work_order', $task->status, $task->status, $user, $item->description, [
                'work_order_id' => $workOrder->id,
                'wo_number' => $workOrder->wo_number,
            ]);

            return $workOrder;
        });

        $this->workOrders->notifyCreated($workOrder);

        return $workOrder;
    }

    private function lock(PmTask $task, string $action): PmTask
    {
        $locked = PmTask::query()->lockForUpdate()->findOrFail($task->id);
        if (self::statusAllows($locked, $action)) {
            return $locked;
        }

        if ($action === 'start' && $locked->status === PmTaskStatus::Scheduled) {
            $from = $locked->due_window_at->timezone(config('app.timezone'))->translatedFormat('j M Y H:i');
            throw new InvalidTransitionException("Tugas {$locked->number} baru dapat dikerjakan mulai {$from}.");
        }

        throw new InvalidTransitionException("Tugas {$locked->number} berstatus {$locked->status->label()}; aksi ini tidak dapat dilakukan.");
    }

    /** @param array<int, array{id: int, result?: ?string, value_number?: mixed, value_text?: ?string, notes?: ?string}> $rows */
    private function applyAnswers(PmTask $task, array $rows): void
    {
        $items = $task->items()->get()->keyBy('id');

        foreach (array_values($rows) as $i => $row) {
            /** @var PmTaskItem|null $item */
            $item = $items->get($row['id'] ?? 0);
            if (! $item) {
                throw ValidationException::withMessages(["items.{$i}.id" => ['Butir checklist tidak ditemukan pada tugas ini.']]);
            }

            if (array_key_exists('value_number', $row)) {
                $item->value_number = $row['value_number'];
            }
            if (array_key_exists('value_text', $row)) {
                $item->value_text = $row['value_text'];
            }
            if (array_key_exists('notes', $row)) {
                $item->notes = $row['notes'];
            }
            $item->result = $this->evaluate($item, $row);
            $item->save();
        }
    }

    /** Result of one answer: chosen by the technician for OK/Tidak OK/N-A items, derived for numbers and text. */
    private function evaluate(PmTaskItem $item, array $row): ?string
    {
        $chosen = array_key_exists('result', $row) ? $row['result'] : $item->result;
        if ($chosen === ChecklistResult::Na->value) {
            return $chosen;
        }

        return match (ChecklistInputType::from($item->input_type)) {
            ChecklistInputType::OkNokNa => $chosen,
            ChecklistInputType::Number => $item->value_number === null ? null : ($this->withinRange($item) ? 'ok' : 'not_ok'),
            ChecklistInputType::Text => filled($item->value_text) ? 'ok' : null,
        };
    }

    private function withinRange(PmTaskItem $item): bool
    {
        return ($item->min_value === null || $item->value_number >= $item->min_value)
            && ($item->max_value === null || $item->value_number <= $item->max_value);
    }

    private function assertChecklistComplete(PmTask $task): void
    {
        $errors = [];
        foreach ($task->items()->withCount('attachments')->get() as $item) {
            if ($item->is_required && $item->result === null) {
                $errors["items.{$item->id}"][] = 'Butir wajib ini belum diisi.';
            }
            if ($item->photo_required && $item->result !== ChecklistResult::Na->value && $item->attachments_count === 0) {
                $errors["items.{$item->id}"][] = 'Butir ini wajib dilengkapi foto.';
            }
        }

        if ($errors) {
            throw ValidationException::withMessages($errors);
        }
    }

    private function replaceMaterials(PmTask $task, array $rows): void
    {
        $task->materials()->delete();
        $masters = Material::query()->whereIn('id', array_filter(array_column($rows, 'material_id')))->get()->keyBy('id');

        foreach ($rows as $row) {
            $master = isset($row['material_id']) ? $masters->get($row['material_id']) : null;
            $task->materials()->create([
                'material_id' => $master?->id,
                'material_name' => ($row['material_name'] ?? null) ?: $master?->name,
                'quantity' => $row['quantity'],
                'unit' => ($row['unit'] ?? null) ?: $master?->unit,
            ]);
        }
    }
}
