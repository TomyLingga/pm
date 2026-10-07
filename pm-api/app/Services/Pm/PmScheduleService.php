<?php

namespace App\Services\Pm;

use App\Models\ChecklistTemplate;
use App\Models\ExecutorUnit;
use App\Models\PmSchedule;
use App\Models\User;
use App\Services\Org\ExecutorDirectory;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** CRUD of PM schedules; every change keeps the generated tasks in step (Q-15). */
class PmScheduleService
{
    private const FIELDS = [
        'name', 'executor_unit_id', 'checklist_template_id', 'frequency_type', 'frequency_interval',
        'start_at', 'end_at', 'tolerance_hours', 'due_window_hours', 'estimated_minutes', 'pic_user_id', 'is_active',
    ];

    public function __construct(
        private PmTaskGenerator $generator,
        private ExecutorDirectory $directory,
    ) {
    }

    public function create(User $by, array $data): PmSchedule
    {
        return DB::transaction(function () use ($by, $data) {
            $schedule = new PmSchedule($this->attributes($data, $by));
            $schedule->created_by_id = $by->id;
            $schedule->save();
            $schedule->equipment()->sync($data['equipment_ids']);

            // Tasks are visible on the calendar right away, without waiting for the nightly run.
            $this->generator->generate($schedule);

            return $schedule;
        });
    }

    /** Tasks still TERJADWAL are dropped and generated again from the new definition. */
    public function update(PmSchedule $schedule, array $data, ?User $by = null): PmSchedule
    {
        if ((int) $data['executor_unit_id'] !== (int) $schedule->executor_unit_id) {
            throw ValidationException::withMessages(['executor_unit_id' => ['Unit pelaksana jadwal tidak dapat diubah. Buat jadwal baru.']]);
        }

        return DB::transaction(function () use ($schedule, $data, $by) {
            $schedule->fill($this->attributes($data, $by))->save();
            $schedule->equipment()->sync($data['equipment_ids']);

            $schedule->is_active
                ? $this->generator->regenerate($schedule)
                : $this->generator->removeScheduledTasks($schedule);

            return $schedule;
        });
    }

    public function delete(PmSchedule $schedule): void
    {
        DB::transaction(function () use ($schedule) {
            $this->generator->removeScheduledTasks($schedule);
            $schedule->delete();
        });
    }

    private function attributes(array $data, ?User $by = null): array
    {
        $unit = ExecutorUnit::query()->findOrFail($data['executor_unit_id']);

        $templateOk = ChecklistTemplate::query()->whereKey($data['checklist_template_id'])
            ->where('executor_unit_id', $unit->id)->exists();
        if (! $templateOk) {
            throw ValidationException::withMessages(['checklist_template_id' => ['Template checklist harus milik unit pelaksana yang sama.']]);
        }
        $pic = $this->directory->staffQuery($unit)->whereKey($data['pic_user_id'])->first();
        if (! $pic) {
            throw ValidationException::withMessages(['pic_user_id' => ["PIC harus anggota unit pelaksana {$unit->display_name}."]]);
        }
        if ($by && ! $this->directory->canDelegateTo($by, $pic)) {
            throw ValidationException::withMessages(['pic_user_id' => ['PIC hanya boleh grade di bawah Anda.']]);
        }

        $attributes = Arr::only($data, self::FIELDS);
        $attributes['start_at'] = Carbon::parse($data['start_at'])->timezone(config('app.timezone'));
        $attributes['end_at'] = empty($data['end_at']) ? null : Carbon::parse($data['end_at'])->timezone(config('app.timezone'));
        $attributes['due_window_hours'] = $data['due_window_hours'] ?? null;
        $attributes['estimated_minutes'] = $data['estimated_minutes'] ?? null;
        $attributes['is_active'] = (bool) ($data['is_active'] ?? true);

        return $attributes;
    }
}
