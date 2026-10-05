<?php

namespace App\Exports;

use App\Models\WorkOrder;
use Illuminate\Database\Eloquent\Builder;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStyles;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/** Excel export of the Work Order list with the same filters as the list endpoint. */
class WorkOrdersExport implements FromQuery, WithHeadings, WithMapping, ShouldAutoSize, WithStyles
{
    public const RELATIONS = ['executorUnit', 'serviceCategory', 'location', 'requester', 'activeAssignments.user'];

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
            'No. WO', 'Tanggal Terbit', 'Status', 'Prioritas', 'Unit Pelaksana', 'Kategori',
            'Pemohon', 'NRK Pemohon', 'Bagian', 'Sub Bagian', 'No. Alat', 'Nama Alat', 'Lokasi',
            'Permintaan Pekerjaan', 'Teknisi', 'Diambil/Mulai', 'Selesai', 'Durasi SLA (jam)',
            'Ditutup', 'Diterima Otomatis', 'Pekerjaan Perbaikan Selesai', 'Total Breakdown (jam)', 'Dikerjakan Ulang',
        ];
    }

    /** @param WorkOrder $wo */
    public function map($wo): array
    {
        $date = fn ($d) => $d?->timezone(config('app.timezone'))->format('Y-m-d H:i');
        $sla = $wo->slaMinutes();

        return [
            $wo->wo_number,
            $date($wo->issued_at),
            $wo->status->label(),
            $wo->priority->label(),
            $wo->executorUnit?->display_name,
            trim($wo->serviceCategory?->name.' '.($wo->category_note ? '('.$wo->category_note.')' : '')),
            $wo->requester?->name,
            $wo->requester?->nrk,
            $wo->requester_bagian_name,
            $wo->requester_sub_bagian_name,
            $wo->equipment_code,
            $wo->equipment_name,
            $wo->location?->name ?? $wo->location_note,
            $wo->request_description,
            $wo->assigneeUsers()->pluck('name')->join(', '),
            $date($wo->picked_at),
            $date($wo->completed_at),
            $sla === null ? null : round($sla / 60, 2),
            $date($wo->closed_at),
            $wo->auto_accepted ? 'Ya' : 'Tidak',
            $wo->work_done,
            $wo->total_breakdown_hours,
            $wo->rework_count,
        ];
    }

    public function styles(Worksheet $sheet): array
    {
        return [1 => ['font' => ['bold' => true]]];
    }
}
