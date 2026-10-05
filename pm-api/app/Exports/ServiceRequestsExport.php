<?php

namespace App\Exports;

use App\Models\ServiceRequest;
use Illuminate\Database\Eloquent\Builder;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStyles;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/** Excel export of the Form Request list (same filters as the list endpoint). */
class ServiceRequestsExport implements FromQuery, WithHeadings, WithMapping, ShouldAutoSize, WithStyles
{
    public const RELATIONS = ['executorUnit', 'serviceCategory', 'office', 'requester', 'pendingStep.assigneeUser', 'pendingStep.executorUnit'];

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
            'No. Request', 'Dibuat', 'Diajukan', 'Status', 'Menunggu', 'Prioritas', 'Unit Pelaksana', 'Jenis Permintaan',
            'Office', 'Pemohon', 'NRK', 'Bagian', 'Sub Bagian', 'Atasan', 'Keperluan', 'Estimasi Biaya', 'Keterangan', 'Selesai', 'Revisi',
        ];
    }

    /** @param ServiceRequest $sr */
    public function map($sr): array
    {
        $date = fn ($d) => $d?->timezone(config('app.timezone'))->format('Y-m-d H:i');
        $step = $sr->pendingStep;

        return [
            $sr->displayNumber(),
            $date($sr->created_at),
            $date($sr->submitted_at),
            $sr->status->label(),
            $step ? "{$step->step_label} ({$step->assigneeLabel()})" : null,
            $sr->priority->requestLabel(),
            $sr->executorUnit?->display_name,
            $sr->serviceCategory?->name,
            $sr->office?->name,
            $sr->requester_name ?? $sr->requester?->name,
            $sr->requester_nrk ?? $sr->requester?->nrk,
            $sr->requester_bagian_name,
            $sr->requester_sub_bagian_name,
            $sr->superior_name,
            $sr->purpose,
            $sr->estimated_cost,
            $sr->executor_notes,
            $date($sr->completed_at),
            $sr->revision_no,
        ];
    }

    public function styles(Worksheet $sheet): array
    {
        return [1 => ['font' => ['bold' => true]]];
    }
}
