<?php

namespace App\Exports\Templates;

use App\Models\Equipment;
use App\Models\ExecutorUnit;
use App\Models\Location;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;

/**
 * Import template for the equipment master: sheet "Data" (fill this one), "Contoh", "Petunjuk",
 * plus reference sheets with the valid location and executor-unit codes.
 * Column order is the contract of EquipmentImporter.
 */
final class EquipmentTemplate implements WithMultipleSheets
{
    public const HEADINGS = ['No. Alat', 'Nama Alat', 'Kode Lokasi', 'Kode Unit Pelaksana', 'Merek', 'Model', 'Nomor Seri', 'Status'];

    private const WIDTHS = ['A' => 16, 'B' => 36, 'C' => 16, 'D' => 20, 'E' => 16, 'F' => 18, 'G' => 20, 'H' => 18];

    public function sheets(): array
    {
        $locations = Location::query()->where('is_active', true)->orderBy('code')->get();
        $units = ExecutorUnit::query()->orderBy('code')->get();
        $firstLocation = $locations->first()?->code;
        $firstUnit = $units->first()?->code;

        $examples = [
            ['PRN-001', 'Printer HP LaserJet M404', $firstLocation, $firstUnit, 'HP', 'LaserJet M404dn', 'VNB3K12345', 'Aktif'],
            ['AC-012', 'AC Split 2 PK Ruang Server', $firstLocation, $firstUnit, 'Daikin', 'FTKC50', null, 'Dalam Perbaikan'],
            ['GEN-01', 'Genset 500 kVA', null, null, 'Perkins', '2506A', 'PK500-2019', null],
        ];
        $statuses = implode(' / ', Equipment::STATUSES);
        $instructions = [
            ['Isi sheet "Data" mulai baris 2; baris 1 (judul kolom) jangan diubah. Sheet lain hanya petunjuk dan referensi.'],
            ['Kolom wajib: No. Alat (unik, maks 50 karakter) dan Nama Alat (maks 150 karakter).'],
            ['No. Alat yang sudah ada akan diperbarui datanya (termasuk yang pernah dihapus); No. Alat baru akan ditambahkan.'],
            ['Kode Lokasi dan Kode Unit Pelaksana harus persis sesuai sheet "Lokasi" dan "Unit Pelaksana" (boleh kosong).'],
            ['Status: '.$statuses.'. Kosong = Aktif.'],
            ['Anda hanya dapat mengimpor equipment untuk unit pelaksana yang Anda pimpin.'],
            ['Semua baris diperiksa dulu; bila ada baris bermasalah, tidak ada data yang diimpor dan pesan per baris ditampilkan di aplikasi.'],
            ['Maksimal '.\App\Support\SpreadsheetRows::MAX_ROWS.' baris per file.'],
        ];

        return [
            new SimpleSheet('Data', self::HEADINGS, [], self::WIDTHS),
            new SimpleSheet('Contoh', self::HEADINGS, $examples, self::WIDTHS),
            new SimpleSheet('Petunjuk', ['Petunjuk pengisian'], $instructions, ['A' => 120], true),
            new SimpleSheet('Lokasi', ['Kode Lokasi', 'Nama Lokasi'], $locations->map(fn (Location $l) => [$l->code, $l->name])->values()->all(), ['A' => 18, 'B' => 40]),
            new SimpleSheet('Unit Pelaksana', ['Kode Unit', 'Nama Unit'], $units->map(fn (ExecutorUnit $u) => [$u->code, $u->display_name])->values()->all(), ['A' => 18, 'B' => 40]),
        ];
    }
}
