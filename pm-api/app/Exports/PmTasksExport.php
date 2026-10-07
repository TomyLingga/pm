<?php

namespace App\Exports;

use App\Models\PmTask;
use Illuminate\Database\Eloquent\Builder;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStyles;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/** Excel export of PM tasks (same filters as the list endpoint). */
class PmTasksExport implements FromQuery, WithHeadings, WithMapping, ShouldAutoSize, WithStyles
{
    public const RELATIONS = ['schedule', 'equipment.location', 'executorUnit', 'pic', 'completedBy'];

    public function __construct(private Builder $query)
    {
    }

    public function query(): Builder
    {
        return $this->query;
    }

    public function headings(): array
    {
        return [
            'No. Tugas', 'Jadwal', 'Frekuensi', 'No. Alat', 'Nama Alat', 'Lokasi', 'Unit Pelaksana', 'PIC',
            'Jatuh Tempo', 'Batas Toleransi', 'Status', 'Mulai', 'Selesai', 'Dikerjakan Oleh', 'Durasi (menit)',
            'Terlambat', 'Temuan Tidak OK', 'Alasan Dilewati', 'Catatan',
        ];
    }

    /** @param PmTask $task */
    public function map($task): array
    {
        $date = fn ($d) => $d?->timezone(config('app.timezone'))->format('Y-m-d H:i');

        return [
            $task->number,
            $task->schedule?->name,
            $task->schedule?->frequencyLabel(),
            $task->equipment?->code,
            $task->equipment?->name,
            $task->equipment?->location?->name,
            $task->executorUnit?->display_name,
            $task->pic?->name,
            $date($task->due_at),
            $date($task->overdue_at),
            $task->status->label(),
            $date($task->started_at),
            $date($task->completed_at),
            $task->completedBy?->name,
            $task->duration_minutes,
            $task->is_late ? 'Ya' : 'Tidak',
            (int) $task->findings_count,
            $task->skip_reason,
            $task->notes,
        ];
    }

    public function styles(Worksheet $sheet): array
    {
        return [1 => ['font' => ['bold' => true]]];
    }
}
