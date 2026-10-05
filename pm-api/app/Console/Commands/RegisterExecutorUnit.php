<?php

namespace App\Console\Commands;

use App\Models\ExecutorUnit;
use App\Models\OrgUnit;
use Illuminate\Console\Command;

/**
 * Admin helper until the master-data UI exists: turn a Portal section into an executor unit.
 *
 * Example: php artisan pm:executor-unit IT --display="Sistem dan IT" --category=Software --category=Hardware --category=Network
 */
class RegisterExecutorUnit extends Command
{
    protected $signature = 'pm:executor-unit
        {org_code : Kode unit organisasi Portal (seksi pelaksana)}
        {--code= : Kode untuk nomor WO/REQ (default = kode unit)}
        {--display= : Nama tampilan (default = nama unit)}
        {--category=* : Kategori layanan; "Lain-lain" ditambahkan otomatis}
        {--rules= : Petunjuk dan Aturan Form Request (pisahkan baris dengan |)}
        {--footer= : Teks kontak di kaki Form Request}';

    protected $description = 'Register (or update) an executor unit based on a synced Portal org unit';

    public function handle(): int
    {
        $orgUnit = OrgUnit::query()->where('code', $this->argument('org_code'))->first();
        if (! $orgUnit) {
            $this->error('Unit organisasi tidak ditemukan. Jalankan `php artisan portal:sync` terlebih dahulu.');

            return self::FAILURE;
        }

        $unit = ExecutorUnit::withTrashed()->updateOrCreate(
            ['org_unit_id' => $orgUnit->id],
            [
                'code' => $this->option('code') ?: $orgUnit->code,
                'display_name' => $this->option('display') ?: $orgUnit->name,
                'is_active' => true,
            ]
        );
        if ($unit->trashed()) {
            $unit->restore();
        }
        if ($this->option('rules') !== null) {
            $unit->request_rules = str_replace('|', "\n", $this->option('rules'));
        }
        if ($this->option('footer') !== null) {
            $unit->contact_footer = $this->option('footer');
        }
        $unit->save();

        $categories = array_values(array_unique(array_merge($this->option('category'), ['Lain-lain'])));
        foreach ($categories as $i => $name) {
            $category = $unit->categories()->withTrashed()->updateOrCreate(
                ['name' => $name],
                ['sort_order' => $i, 'requires_note' => $name === 'Lain-lain', 'is_active' => true]
            );
            if ($category->trashed()) {
                $category->restore();
            }
        }

        $this->info("Unit pelaksana {$unit->display_name} ({$unit->code}) siap dengan kategori: ".implode(', ', $categories));

        return self::SUCCESS;
    }
}
