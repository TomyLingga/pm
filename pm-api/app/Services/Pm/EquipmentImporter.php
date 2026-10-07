<?php

namespace App\Services\Pm;

use App\Exports\Templates\EquipmentTemplate;
use App\Models\Equipment;
use App\Models\ExecutorUnit;
use App\Models\Location;
use App\Models\User;
use App\Services\Org\ExecutorDirectory;
use App\Support\SpreadsheetRows;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Bulk create / update of the equipment master from the Excel template (EquipmentTemplate::HEADINGS).
 * Rows are matched on No. Alat; all rows are validated first and nothing is saved when any row fails.
 */
final class EquipmentImporter
{
    public function __construct(private ExecutorDirectory $directory)
    {
    }

    /** @return array{created: int, updated: int} */
    public function import(User $by, string $path): array
    {
        if (! $this->directory->isLeadAnywhere($by)) {
            throw new AuthorizationException('Hanya pimpinan unit pelaksana yang dapat mengimpor equipment.');
        }
        $header = SpreadsheetRows::header($path);
        if (mb_strtolower(trim((string) ($header[0] ?? ''))) !== mb_strtolower(EquipmentTemplate::HEADINGS[0])) {
            throw ValidationException::withMessages(['file' => ['Format file tidak sesuai template. Unduh template, isi sheet "Data", lalu unggah kembali.']]);
        }
        $rows = SpreadsheetRows::read($path);
        if ($rows === []) {
            throw ValidationException::withMessages(['file' => ['Sheet "Data" masih kosong. Isi minimal satu baris mulai baris 2.']]);
        }

        $locations = Location::query()->get()->keyBy(fn (Location $l) => mb_strtolower($l->code));
        $units = ExecutorUnit::query()->get()->keyBy(fn (ExecutorUnit $u) => mb_strtolower($u->code));
        $statuses = [];
        foreach (Equipment::STATUSES as $key => $label) {
            $statuses[$key] = $key;
            $statuses[mb_strtolower($label)] = $key;
        }

        $errors = [];
        $plans = [];
        $seen = [];
        foreach ($rows as $number => $cells) {
            [$code, $name, $locationCode, $unitCode, $brand, $model, $serial, $status] = array_pad(array_values($cells), 8, null);
            $messages = [];

            if (blank($code)) {
                $messages[] = 'No. Alat wajib diisi.';
            } elseif (mb_strlen($code) > 50) {
                $messages[] = 'No. Alat maksimal 50 karakter.';
            } elseif (isset($seen[mb_strtolower($code)])) {
                $messages[] = "No. Alat {$code} ditulis lebih dari sekali (baris {$seen[mb_strtolower($code)]}).";
            } else {
                $seen[mb_strtolower($code)] = $number;
            }
            if (blank($name)) {
                $messages[] = 'Nama Alat wajib diisi.';
            } elseif (mb_strlen($name) > 150) {
                $messages[] = 'Nama Alat maksimal 150 karakter.';
            }
            foreach (['Merek' => $brand, 'Model' => $model, 'Nomor Seri' => $serial] as $label => $value) {
                if (mb_strlen((string) $value) > 100) {
                    $messages[] = "{$label} maksimal 100 karakter.";
                }
            }

            $location = null;
            if (filled($locationCode)) {
                $location = $locations[mb_strtolower(trim($locationCode))] ?? null;
                if (! $location) {
                    $messages[] = "Kode Lokasi {$locationCode} tidak ditemukan (lihat sheet \"Lokasi\").";
                }
            }
            $unit = null;
            if (filled($unitCode)) {
                $unit = $units[mb_strtolower(trim($unitCode))] ?? null;
                if (! $unit) {
                    $messages[] = "Kode Unit Pelaksana {$unitCode} tidak ditemukan (lihat sheet \"Unit Pelaksana\").";
                } elseif (! $this->directory->isLead($by, $unit)) {
                    $messages[] = "Anda bukan pimpinan unit pelaksana {$unit->code}.";
                }
            }
            $statusValue = 'active';
            if (filled($status)) {
                $statusValue = $statuses[mb_strtolower(trim($status))] ?? null;
                if ($statusValue === null) {
                    $messages[] = 'Status harus salah satu dari: '.implode(', ', Equipment::STATUSES).'.';
                }
            }

            $existing = filled($code) ? Equipment::withTrashed()->whereRaw('LOWER(code) = ?', [mb_strtolower($code)])->first() : null;
            if ($existing && $existing->executor_unit_id && ! $this->directory->isLead($by, (int) $existing->executor_unit_id)) {
                $messages[] = "Equipment {$existing->code} dikelola unit lain; Anda tidak dapat mengubahnya.";
            }

            if ($messages !== []) {
                $errors["rows.{$number}"] = $messages;

                continue;
            }
            $plans[] = [$existing, [
                'code' => $existing?->code ?? trim($code),
                'name' => trim($name),
                'location_id' => $location?->id,
                'executor_unit_id' => $unit?->id,
                'brand' => $brand,
                'model' => $model,
                'serial_number' => $serial,
                'status' => $statusValue,
            ]];
        }

        if ($errors !== []) {
            throw ValidationException::withMessages(
                ['file' => [count($errors).' baris bermasalah; tidak ada data yang diimpor. Perbaiki lalu unggah kembali.']] + $errors
            );
        }

        return DB::transaction(function () use ($plans) {
            $created = 0;
            $updated = 0;
            foreach ($plans as [$existing, $attributes]) {
                if ($existing) {
                    if ($existing->trashed()) {
                        $existing->restore();
                    }
                    $existing->fill($attributes)->save();
                    $updated++;
                } else {
                    Equipment::query()->create($attributes);
                    $created++;
                }
            }

            return ['created' => $created, 'updated' => $updated];
        });
    }
}
