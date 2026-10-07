<?php

namespace App\Exports\Templates;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/** One sheet of an import template: bold tinted header row, optional rows, fixed column widths. */
final class SimpleSheet implements FromArray, WithHeadings, WithTitle, WithStyles, WithColumnWidths
{
    /**
     * @param  array<int, array<int, mixed>>  $rows
     * @param  array<string, int>  $widths  column letter => width
     */
    public function __construct(
        private string $title,
        private array $headings,
        private array $rows = [],
        private array $widths = [],
        private bool $wrap = false,
    ) {
    }

    public function title(): string
    {
        return mb_substr($this->title, 0, 31);
    }

    public function headings(): array
    {
        return $this->headings;
    }

    public function array(): array
    {
        return $this->rows;
    }

    public function columnWidths(): array
    {
        return $this->widths;
    }

    public function styles(Worksheet $sheet): array
    {
        $sheet->freezePane('A2');
        if ($this->wrap) {
            $sheet->getStyle($sheet->calculateWorksheetDimension())->getAlignment()->setWrapText(true)->setVertical('top');
        }

        return [1 => [
            'font' => ['bold' => true],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFD9EFEB']],
        ]];
    }
}
