<?php

namespace App\Services\Activities;

use App\Exports\Templates\DailyActivityTemplate;
use App\Models\DailyActivity;
use App\Models\User;
use App\Support\SpreadsheetRows;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Bulk entry of Aktivitas Harian from the Excel template (DailyActivityTemplate::HEADINGS).
 * All rows are validated first; one bad row means nothing is imported (422 with `rows.<n>` messages).
 */
final class DailyActivityImporter
{
    private const STATUS_ALIASES = [
        'open' => 'open', 'belum mulai' => 'open',
        'on progress' => 'on_progress', 'on_progress' => 'on_progress', 'onprogress' => 'on_progress', 'progress' => 'on_progress', 'dikerjakan' => 'on_progress',
        'closed' => 'closed', 'close' => 'closed', 'selesai' => 'closed',
    ];

    public function __construct(private DailyActivityService $service)
    {
    }

    /** @return array{created: int} */
    public function import(User $by, string $path): array
    {
        $header = SpreadsheetRows::header($path);
        if (mb_strtolower(trim((string) ($header[0] ?? ''))) !== mb_strtolower(DailyActivityTemplate::HEADINGS[0])) {
            throw ValidationException::withMessages(['file' => ['Format file tidak sesuai template. Unduh template, isi sheet "Data", lalu unggah kembali.']]);
        }
        $rows = SpreadsheetRows::read($path);
        if ($rows === []) {
            throw ValidationException::withMessages(['file' => ['Sheet "Data" masih kosong. Isi minimal satu baris mulai baris 2.']]);
        }

        $errors = [];
        $payloads = [];
        $people = [];
        foreach ($rows as $number => $cells) {
            [$date, $title, $description, $followUp, $obstacles, $status, $nrk] = array_pad(array_values($cells), 7, null);
            $messages = [];

            $activityDate = SpreadsheetRows::parseDate($date);
            if (! $activityDate) {
                $messages[] = 'Tanggal wajib diisi dengan format YYYY-MM-DD.';
            }
            if (blank($title)) {
                $messages[] = 'Laporan Kegiatan (judul) wajib diisi.';
            } elseif (mb_strlen($title) > 250) {
                $messages[] = 'Laporan Kegiatan maksimal 250 karakter.';
            }
            if (blank($description)) {
                $messages[] = 'Uraian wajib diisi.';
            } elseif (mb_strlen($description) > 5000) {
                $messages[] = 'Uraian maksimal 5000 karakter.';
            }
            if (mb_strlen((string) $followUp) > 2000) {
                $messages[] = 'Tindak Lanjut maksimal 2000 karakter.';
            }
            if (mb_strlen((string) $obstacles) > 2000) {
                $messages[] = 'Kendala maksimal 2000 karakter.';
            }

            $statusValue = 'open';
            if (filled($status)) {
                $statusValue = self::STATUS_ALIASES[mb_strtolower(trim($status))] ?? null;
                if ($statusValue === null) {
                    $messages[] = 'Status harus OPEN, ON PROGRESS, atau CLOSED.';
                }
            }

            $userId = null;
            if (filled($nrk)) {
                $nrk = trim($nrk);
                $person = $people[$nrk] ??= User::query()->where('nrk', $nrk)->where('is_active', true)->first();
                if (! $person) {
                    $messages[] = "NRK {$nrk} tidak ditemukan atau tidak aktif.";
                } elseif (! $by->can('reportFor', [DailyActivity::class, $person])) {
                    $messages[] = "NRK {$nrk} ({$person->name}) bukan anggota unit di bawah Anda.";
                } else {
                    $userId = $person->id;
                }
            }

            if ($messages !== []) {
                $errors["rows.{$number}"] = $messages;

                continue;
            }
            $payloads[] = [
                'activity_date' => $activityDate,
                'title' => $title,
                'description' => $description,
                'follow_up' => $followUp,
                'obstacles' => $obstacles,
                'status' => $statusValue,
                'user_id' => $userId,
            ];
        }

        if ($errors !== []) {
            throw ValidationException::withMessages(
                ['file' => [count($errors).' baris bermasalah; tidak ada data yang diimpor. Perbaiki lalu unggah kembali.']] + $errors
            );
        }

        return DB::transaction(function () use ($by, $payloads) {
            foreach ($payloads as $payload) {
                $this->service->create($by, $payload, 'Diimpor dari Excel');
            }

            return ['created' => count($payloads)];
        });
    }
}
