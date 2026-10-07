<?php

namespace App\Exports;

use App\Models\DailyActivity;
use Illuminate\Database\Eloquent\Builder;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStyles;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class DailyActivitiesExport implements FromQuery, WithHeadings, WithMapping, ShouldAutoSize, WithStyles
{
    public function __construct(private Builder $query)
    {
    }

    public function query(): Builder
    {
        return $this->query;
    }

    public function headings(): array
    {
        return ['Tanggal', 'Minggu', 'Laporan Kegiatan', 'Uraian', 'Tindak Lanjut', 'Kendala', 'Status', 'Penanggung Jawab', 'Unit', 'Program Kerja', 'Work Order', 'Waktu Upload', 'Closed'];
    }

    /** @param  DailyActivity  $row */
    public function map($row): array
    {
        $program = $row->programActivity;

        return [
            $row->activity_date->format('Y-m-d'),
            'M'.$row->week_of_month,
            $row->title,
            $row->description,
            $row->follow_up,
            $row->obstacles,
            $row->status->label(),
            $row->user?->name,
            $row->orgUnit?->name,
            $program ? trim(($program->item?->code ?? '').' '.$program->title) : null,
            $row->workOrder?->wo_number,
            $row->created_at?->format('Y-m-d H:i'),
            $row->closed_at?->format('Y-m-d H:i'),
        ];
    }

    public function styles(Worksheet $sheet): array
    {
        return [1 => ['font' => ['bold' => true]]];
    }
}
