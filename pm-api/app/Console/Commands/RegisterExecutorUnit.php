<?php

namespace App\Console\Commands;

use App\Models\ExecutorUnit;
use App\Models\OrgUnit;
use App\Services\Org\ServiceCategoryService;
use Illuminate\Console\Command;

/**
 * Admin helper until the master-data UI exists: turn a Portal section into an executor unit.
 *
 * Example: php artisan pm:executor-unit IT --display="Sistem dan IT" --category=Software --category=Hardware --category=Network
 */
class RegisterExecutorUnit extends Command
{
    protected $signature = 'pm:executor-unit
        {org_code : Kode unit organisasi Portal (harus seksi)}
        {--code= : Kode untuk nomor WO/REQ (default = kode seksi tanpa awalan SEK-)}
        {--display= : Nama tampilan (default = nama seksi)}
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
        if ($orgUnit->type !== OrgUnit::TYPE_SEKSI) {
            $this->error("Unit pelaksana harus berupa seksi; {$orgUnit->name} adalah {$orgUnit->type}. Pimpinan sub bagian/bagian di atas seksi otomatis menjadi pimpinan unit pelaksana.");

            return self::FAILURE;
        }

        $existing = ExecutorUnit::withTrashed()->where('org_unit_id', $orgUnit->id)->first();
        $unit = ExecutorUnit::withTrashed()->updateOrCreate(
            ['org_unit_id' => $orgUnit->id],
            [
                'code' => $this->option('code') ?: ($existing?->code ?? ServiceCategoryService::codeFromOrgCode($orgUnit->code)),
                'display_name' => $this->option('display') ?: ($existing?->display_name ?? $orgUnit->name),
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

        // New categories are appended; existing ones keep their order. "Lain-lain" always exists and stays last.
        foreach (array_unique($this->option('category')) as $name) {
            $category = $unit->categories()->withTrashed()->firstOrNew(['name' => $name]);
            if (! $category->exists) {
                $category->sort_order = (int) $unit->categories()->withTrashed()->where('name', '!=', ServiceCategoryService::OTHER)->max('sort_order') + 1;
            }
            $category->is_active = true;
            $category->save();
            if ($category->trashed()) {
                $category->restore();
            }
        }
        $other = $unit->categories()->withTrashed()->firstOrNew(['name' => ServiceCategoryService::OTHER]);
        $other->fill([
            'requires_note' => true,
            'is_active' => true,
            'sort_order' => (int) $unit->categories()->withTrashed()->where('name', '!=', ServiceCategoryService::OTHER)->max('sort_order') + 1,
        ])->save();
        if ($other->trashed()) {
            $other->restore();
        }
        $categories = $unit->categories()->where('is_active', true)->orderBy('sort_order')->pluck('name')->all();

        $this->info("Unit pelaksana {$unit->display_name} ({$unit->code}) siap dengan kategori: ".implode(', ', $categories));

        return self::SUCCESS;
    }
}
