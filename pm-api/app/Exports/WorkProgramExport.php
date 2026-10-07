<?php

namespace App\Exports;

use App\Models\User;
use App\Models\WorkProgram;
use App\Models\WorkProgramActivity;
use App\Models\WorkProgramItem;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/** One sheet: every activity of the programme, grouped by sub-item. */
class WorkProgramExport implements FromCollection, WithHeadings, ShouldAutoSize, WithStyles, WithTitle
{
    public function __construct(private WorkProgram $program)
    {
    }

    public function title(): string
    {
        return mb_substr("{$this->program->code} {$this->program->year}", 0, 31);
    }

    public function headings(): array
    {
        return ['Sub-Item', 'No', 'Project / Kegiatan', 'Action to be Taken', 'PIC Utama', 'PIC Pendukung', 'Target', 'Closed', 'Status', 'Progress %', 'Remarks'];
    }

    public function collection()
    {
        $rows = collect();
        $no = 0;
        foreach ($this->program->items as $item) {
            /** @var WorkProgramItem $item */
            foreach ($item->activities as $activity) {
                /** @var WorkProgramActivity $activity */
                $no++;
                $utama = $activity->pics->first(fn (User $u) => $u->pivot->role === WorkProgramActivity::PIC_UTAMA);
                $support = $activity->pics->filter(fn (User $u) => $u->pivot->role !== WorkProgramActivity::PIC_UTAMA)->pluck('name')->implode(', ');
                $rows->push([
                    "{$item->code} {$item->title}",
                    $no,
                    $activity->title,
                    $activity->action_plan,
                    $utama?->name,
                    $support,
                    $activity->target_date?->format('Y-m-d'),
                    $activity->closed_date?->format('Y-m-d'),
                    $activity->status->label(),
                    $activity->progress_pct,
                    $activity->remarks,
                ]);
            }
        }

        return $rows;
    }

    public function styles(Worksheet $sheet): array
    {
        return [1 => ['font' => ['bold' => true]]];
    }
}
