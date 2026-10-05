<?php

namespace App\Services\Approvals;

use App\Enums\ApprovalStepStatus;
use App\Exceptions\InvalidTransitionException;
use App\Models\ApprovalStep;
use App\Models\ExecutorUnit;
use App\Models\User;
use App\Services\Org\ExecutorDirectory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;

/**
 * Generic sequential approval chain stored in `approval_steps`, reusable by any document type.
 *
 * - A chain is a list of steps per round; "minta revisi" ends the round and the document starts a new one.
 * - Exactly one step is `pending` at a time; later steps are `waiting`.
 * - Who may act: a specific user, the leads of an executor unit, or any staff of an executor unit.
 * - The initiator never acts on their own document.
 *
 * The engine only records decisions; the document's own service maps them to document statuses.
 */
class ApprovalEngine
{
    public function __construct(private ExecutorDirectory $directory)
    {
    }

    /**
     * @param  StepDefinition[]  $definitions
     * @return Collection<int, ApprovalStep>
     */
    public function start(Model $document, int $round, array $definitions, User $initiator): Collection
    {
        $now = now();
        $activated = false;
        $steps = collect();

        foreach (array_values($definitions) as $order => $definition) {
            $step = new ApprovalStep([
                'round' => $round,
                'step_order' => $order,
                'step_key' => $definition->key,
                'step_label' => $definition->label,
                'kind' => $definition->kind,
                'assignee_type' => $definition->assigneeType,
                'assignee_user_id' => $definition->assigneeUserId,
                'executor_unit_id' => $definition->executorUnitId,
                'initiator_id' => $initiator->id,
            ]);

            if ($definition->kind === ApprovalStep::KIND_SUBMISSION) {
                $step->status = ApprovalStepStatus::Completed;
                $step->activated_at = $now;
                $this->stamp($step, $initiator, null);
            } elseif ($definition->skip) {
                $step->status = ApprovalStepStatus::Skipped;
                $step->notes = $definition->skipNote;
            } elseif (! $activated) {
                $step->status = ApprovalStepStatus::Pending;
                $step->activated_at = $now;
                $activated = true;
            } else {
                $step->status = ApprovalStepStatus::Waiting;
            }

            $step->approvable()->associate($document);
            $step->save();
            $steps->push($step);
        }

        return $steps;
    }

    /** The step currently waiting for a decision, if any. */
    public function current(Model $document): ?ApprovalStep
    {
        return $this->query($document)->where('status', ApprovalStepStatus::Pending->value)->first();
    }

    /** @return Collection<int, ApprovalStep> */
    public function steps(Model $document, ?int $round = null): Collection
    {
        return $this->query($document)
            ->when($round !== null, fn (Builder $q) => $q->where('round', $round))
            ->orderBy('round')->orderBy('step_order')
            ->get();
    }

    public function canAct(User $user, ?ApprovalStep $step): bool
    {
        if (! $step || ! $step->isPending() || (int) $step->initiator_id === (int) $user->id || ! $user->is_active) {
            return false;
        }

        return match ($step->assignee_type) {
            ApprovalStep::ASSIGNEE_USER => (int) $step->assignee_user_id === (int) $user->id,
            ApprovalStep::ASSIGNEE_EXECUTOR_LEAD => $this->directory->isStaff($user, (int) $step->executor_unit_id)
                && $this->directory->hasLeadGrade($user),
            ApprovalStep::ASSIGNEE_EXECUTOR_STAFF => $this->directory->isStaff($user, (int) $step->executor_unit_id),
            default => false,
        };
    }

    /**
     * Record a decision on the pending step.
     * Positive decisions (approved/completed) activate the next waiting step, which is returned;
     * negative ones (rejected/revision_requested/cancelled) close the rest of the round. Returns null when nothing is pending anymore.
     */
    public function decide(ApprovalStep $step, User $actor, ApprovalStepStatus $decision, ?string $notes = null): ?ApprovalStep
    {
        $step = ApprovalStep::query()->lockForUpdate()->findOrFail($step->id);
        if (! $step->isPending()) {
            throw new InvalidTransitionException('Langkah persetujuan ini sudah diproses.');
        }

        $step->status = $decision;
        $this->stamp($step, $actor, $notes);
        $step->save();

        $remaining = ApprovalStep::query()
            ->where('approvable_type', $step->approvable_type)
            ->where('approvable_id', $step->approvable_id)
            ->where('round', $step->round)
            ->where('status', ApprovalStepStatus::Waiting->value)
            ->orderBy('step_order')
            ->get();

        if (! $decision->isPositive()) {
            $remaining->each(fn (ApprovalStep $s) => $s->update(['status' => ApprovalStepStatus::Cancelled]));

            return null;
        }

        $next = $remaining->first();
        $next?->update(['status' => ApprovalStepStatus::Pending, 'activated_at' => now()]);

        return $next;
    }

    /** Point a not-yet-decided step at a specific user (e.g. the technician chosen by the lead, or a new superior). */
    public function assignUser(ApprovalStep $step, User $user): ApprovalStep
    {
        $step->update([
            'assignee_type' => ApprovalStep::ASSIGNEE_USER,
            'assignee_user_id' => $user->id,
            'last_reminded_at' => null,
        ]);

        return $step;
    }

    /** Close every open (pending/waiting) step of the document, e.g. when it is cancelled or converted. */
    public function cancelOpen(Model $document, ?User $actor = null, ?string $notes = null): void
    {
        $this->query($document)
            ->whereIn('status', [ApprovalStepStatus::Pending->value, ApprovalStepStatus::Waiting->value])
            ->get()
            ->each(function (ApprovalStep $step) use ($actor, $notes) {
                $step->status = ApprovalStepStatus::Cancelled;
                if ($actor && $step->isDirty('status') && $step->getOriginal('status') === ApprovalStepStatus::Pending) {
                    $this->stamp($step, $actor, $notes);
                }
                $step->save();
            });
    }

    /** Users who may act on a pending step (used for notifications and reminders). */
    public function actors(ApprovalStep $step): Collection
    {
        $users = match ($step->assignee_type) {
            ApprovalStep::ASSIGNEE_USER => User::query()->whereKey($step->assignee_user_id)->get(),
            ApprovalStep::ASSIGNEE_EXECUTOR_LEAD => $this->staff($step)
                ->whereIn('grade_code', config('pm.lead_grade_codes'))->get(),
            ApprovalStep::ASSIGNEE_EXECUTOR_STAFF => $this->staff($step)->get(),
            default => collect(),
        };

        return $users->filter(fn (User $u) => $u->is_active && (int) $u->id !== (int) $step->initiator_id)->values();
    }

    /** Pending steps the user may act on ("Menunggu Persetujuan Saya"). */
    public function pendingFor(User $user): Builder
    {
        $staffUnitIds = $this->directory->unitsFor($user)->pluck('id')->all();
        $leadUnitIds = $this->directory->hasLeadGrade($user) ? $staffUnitIds : [];

        return ApprovalStep::query()
            ->where('status', ApprovalStepStatus::Pending->value)
            ->where('initiator_id', '!=', $user->id)
            ->where(function (Builder $q) use ($user, $staffUnitIds, $leadUnitIds) {
                $q->where(fn (Builder $w) => $w->where('assignee_type', ApprovalStep::ASSIGNEE_USER)->where('assignee_user_id', $user->id))
                    ->orWhere(fn (Builder $w) => $w->where('assignee_type', ApprovalStep::ASSIGNEE_EXECUTOR_LEAD)->whereIn('executor_unit_id', $leadUnitIds ?: [0]))
                    ->orWhere(fn (Builder $w) => $w->where('assignee_type', ApprovalStep::ASSIGNEE_EXECUTOR_STAFF)->whereIn('executor_unit_id', $staffUnitIds ?: [0]));
            });
    }

    private function staff(ApprovalStep $step): Builder
    {
        $unit = ExecutorUnit::withTrashed()->find($step->executor_unit_id);

        return $unit ? $this->directory->staffQuery($unit) : User::query()->whereRaw('1 = 0');
    }

    private function query(Model $document): Builder
    {
        return ApprovalStep::query()
            ->where('approvable_type', $document->getMorphClass())
            ->where('approvable_id', $document->getKey());
    }

    /** Snapshot of the actor as printed in the "PENGESAHAN" block. */
    private function stamp(ApprovalStep $step, User $actor, ?string $notes): void
    {
        $step->fill([
            'acted_by_id' => $actor->id,
            'acted_at' => now(),
            'notes' => $notes,
            'actor_name' => $actor->name,
            'actor_nrk' => $actor->nrk,
            'actor_position' => $actor->position,
            'actor_phone' => $actor->phone,
        ]);
    }
}
