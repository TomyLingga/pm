<?php

namespace App\Exports\Templates;

use App\Models\User;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;

/**
 * Import template for Aktivitas Harian: sheet "Data" (fill this one), "Contoh", "Petunjuk", "Referensi PIC".
 * Column order is the contract of DailyActivityImporter.
 */
final class DailyActivityTemplate implements WithMultipleSheets
{
    public const HEADINGS = ['Tanggal (YYYY-MM-DD)', 'Laporan Kegiatan', 'Uraian', 'Tindak Lanjut', 'Kendala', 'Status', 'NRK PIC'];

    private const WIDTHS = ['A' => 20, 'B' => 40, 'C' => 55, 'D' => 32, 'E' => 32, 'F' => 14, 'G' => 14];

    /** @param  Collection<int, User>  $people  people the downloader may report for */
    public function __construct(private Collection $people)
    {
    }

    public function sheets(): array
    {
        $today = now()->toDateString();
        $examples = [
            [$today, 'Integrasi SAP dengan SmartWB: pengumpulan data', 'Pengumpulan TCode SAP dan data yang dibutuhkan bersama tim SISI.', 'Lanjut desain database', null, 'ON PROGRESS', null],
            [$today, 'Pengecekan access point area timbangan', 'Survey sinyal dan uji coba AP baru, hasil bagus.', null, 'Jadwal user belum pasti', 'CLOSED', null],
            [$today, 'Backup server mingguan', 'Backup database dan file server ke NAS, uji restore 1 file.', 'Uji restore bulanan', null, 'OPEN', $this->people->first()?->nrk],
        ];
        $instructions = [
            ['Isi sheet "Data" mulai baris 2; baris 1 (judul kolom) jangan diubah. Sheet lain hanya petunjuk.'],
            ['Kolom wajib: Tanggal, Laporan Kegiatan (judul, maks 250 karakter), Uraian (maks 5000 karakter).'],
            ['Tanggal: format YYYY-MM-DD (contoh 2026-10-07) atau DD/MM/YYYY; sel bertipe tanggal Excel juga diterima.'],
            ['Status: OPEN (belum mulai), ON PROGRESS (sedang dikerjakan), atau CLOSED (selesai). Kosong = OPEN.'],
            ['NRK PIC: kosongkan untuk laporan Anda sendiri. Pimpinan dapat mengisi NRK anggota unit di bawahnya (lihat sheet "Referensi PIC").'],
            ['Tindak Lanjut dan Kendala opsional, maks 2000 karakter.'],
            ['Semua baris diperiksa dulu; bila ada baris bermasalah, tidak ada data yang diimpor dan pesan per baris ditampilkan di aplikasi.'],
            ['Maksimal '.\App\Support\SpreadsheetRows::MAX_ROWS.' baris per file. Setiap laporan yang diimpor mendapat catatan riwayat "Diimpor dari Excel".'],
        ];
        $people = $this->people->map(fn (User $u) => [$u->nrk, $u->name, $u->orgUnit?->name])->values()->all();

        return [
            new SimpleSheet('Data', self::HEADINGS, [], self::WIDTHS),
            new SimpleSheet('Contoh', self::HEADINGS, $examples, self::WIDTHS, true),
            new SimpleSheet('Petunjuk', ['Petunjuk pengisian'], $instructions, ['A' => 120], true),
            new SimpleSheet('Referensi PIC', ['NRK', 'Nama', 'Unit'], $people, ['A' => 14, 'B' => 36, 'C' => 36]),
        ];
    }
}
