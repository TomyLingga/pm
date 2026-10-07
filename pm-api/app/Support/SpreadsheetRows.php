<?php

namespace App\Support;

use Carbon\Carbon;
use DateTimeInterface;
use PhpOffice\PhpSpreadsheet\Cell\Cell;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use Throwable;

/**
 * Reads the first sheet of an uploaded xlsx / xls / csv for the Excel imports.
 *
 * Cells come back as trimmed strings (blank → null); date-formatted cells as `Y-m-d`.
 * Rows are keyed by their spreadsheet row number so validation messages can point at them.
 */
final class SpreadsheetRows
{
    public const MAX_ROWS = 1000;

    /** @return array<int, string|null> header cells (0-based columns) */
    public static function header(string $path, int $headerRow = 1): array
    {
        $sheet = self::sheet($path);

        return self::cells($sheet, $headerRow, self::lastColumn($sheet));
    }

    /** @return array<int, array<int, string|null>> spreadsheet row number => cells (0-based columns); empty rows skipped */
    public static function read(string $path, int $headerRow = 1): array
    {
        $sheet = self::sheet($path);
        $lastColumn = self::lastColumn($sheet);
        $highest = min($sheet->getHighestDataRow(), $headerRow + self::MAX_ROWS);
        $rows = [];
        for ($row = $headerRow + 1; $row <= $highest; $row++) {
            $cells = self::cells($sheet, $row, $lastColumn);
            if (array_filter($cells, fn ($value) => $value !== null) !== []) {
                $rows[$row] = $cells;
            }
        }

        return $rows;
    }

    /** Accepts `Y-m-d`, `d/m/Y`, `d-m-Y`, `d.m.Y`, `Y/m/d` (optionally followed by a time); returns `Y-m-d` or null. */
    public static function parseDate(?string $value): ?string
    {
        $value = trim((string) $value);
        if ($value === '') {
            return null;
        }
        $value = preg_replace('/[\sT].*$/', '', $value) ?? $value; // drop a trailing time
        foreach (['Y-m-d', 'd/m/Y', 'd-m-Y', 'd.m.Y', 'Y/m/d'] as $format) {
            try {
                $date = Carbon::createFromFormat('!'.$format, $value);
            } catch (Throwable) {
                continue;
            }
            if ($date && $date->format($format) === $value) {
                return $date->toDateString();
            }
        }

        return null;
    }

    private static function sheet(string $path): Worksheet
    {
        $reader = IOFactory::createReaderForFile($path);

        return $reader->load($path)->getSheet(0);
    }

    private static function lastColumn(Worksheet $sheet): int
    {
        return Coordinate::columnIndexFromString($sheet->getHighestDataColumn());
    }

    /** @return array<int, string|null> */
    private static function cells(Worksheet $sheet, int $row, int $lastColumn): array
    {
        $cells = [];
        for ($column = 1; $column <= $lastColumn; $column++) {
            $cells[$column - 1] = self::normalize($sheet->getCell([$column, $row]));
        }

        return $cells;
    }

    private static function normalize(Cell $cell): ?string
    {
        $value = $cell->getValue();
        if ($value === null) {
            return null;
        }
        if (is_string($value) && str_starts_with($value, '=')) {
            try {
                $value = $cell->getCalculatedValue();
            } catch (Throwable) {
                return null;
            }
        }
        if ($value instanceof DateTimeInterface) {
            return $value->format('Y-m-d');
        }
        if (is_numeric($value) && ExcelDate::isDateTime($cell)) {
            return ExcelDate::excelToDateTimeObject((float) $value)->format('Y-m-d');
        }
        if (is_bool($value)) {
            return $value ? '1' : '0';
        }
        if (is_float($value)) {
            $value = floor($value) === $value ? sprintf('%.0f', $value) : rtrim(rtrim(sprintf('%.6F', $value), '0'), '.');
        }
        $text = trim((string) $value);

        return $text === '' ? null : $text;
    }
}
