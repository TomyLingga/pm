<?php

namespace App\Services\Org;

use App\Models\ExecutorUnit;
use App\Models\OrgUnit;
use App\Models\ServiceCategory;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Service categories ("kategori layanan") per seksi pelaksana.
 *
 * Every member of a seksi may add categories for it; the seksi's executor unit is created on first use,
 * so a seksi becomes selectable in the WO / Form Request forms as soon as it has a category.
 * Renaming or deactivating a category is for the unit's leads (incl. Kasubag/Kabag above it) and admins.
 */
class ServiceCategoryService
{
    public const OTHER = 'Lain-lain';

    public function __construct(private ExecutorDirectory $directory)
    {
    }

    /**
     * Seksi whose categories the user may add to: their own seksi, every seksi below a sub bagian / bagian
     * they lead, seksi they were added to as `include` member, or all seksi (admin).
     *
     * @return Collection<int, OrgUnit>
     */
    public function sectionsFor(User $user): Collection
    {
        $query = OrgUnit::query()->where('type', OrgUnit::TYPE_SEKSI)->where('is_active', true);

        if (! $user->isAdmin()) {
            $ids = $this->directory->unitsFor($user)->pluck('org_unit_id')->all();
            $own = $user->org_unit_id ? OrgUnit::query()->find($user->org_unit_id) : null;
            if ($own) {
                $seksi = $own->ancestorOfType(OrgUnit::TYPE_SEKSI);
                if ($seksi) {
                    $ids[] = $seksi->id;
                }
                if ($this->directory->hasLeadGrade($user) && in_array($own->type, ExecutorDirectory::SUPERIOR_LEVELS, true)) {
                    $ids = array_merge($ids, OrgUnit::selfAndDescendantIds($own->id));
                }
            }
            $query->whereIn('id', array_unique($ids) ?: [0]);
        }

        return $query->orderBy('name')->get();
    }

    public function canAdd(User $user, OrgUnit $seksi): bool
    {
        return $this->sectionsFor($user)->contains('id', $seksi->id);
    }

    public function canManage(User $user, ?ExecutorUnit $unit): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        return $unit ? $this->directory->isLead($user, $unit) : $this->directory->hasLeadGrade($user);
    }

    /** The executor unit of a seksi, created on first use (code from the Portal code, name = seksi name). */
    public function ensureExecutorUnit(OrgUnit $seksi): ExecutorUnit
    {
        if ($seksi->type !== OrgUnit::TYPE_SEKSI) {
            throw ValidationException::withMessages(['org_unit_id' => ['Unit pelaksana harus berupa seksi, bukan bagian/sub bagian.']]);
        }

        $unit = ExecutorUnit::withTrashed()->where('org_unit_id', $seksi->id)->first();
        if ($unit) {
            if ($unit->trashed()) {
                $unit->restore();
                $unit->forceFill(['is_active' => true])->save();
            }

            return $unit;
        }

        return ExecutorUnit::query()->create([
            'org_unit_id' => $seksi->id,
            'code' => $this->uniqueCode($seksi->code),
            'display_name' => $seksi->name,
            'is_active' => true,
        ]);
    }

    /** "SEK-IT" → "IT", "SEK-MAINTENANC" → "MAINTENANC" (used in WO/REQ numbers). */
    public static function codeFromOrgCode(string $orgCode): string
    {
        $code = strtoupper((string) preg_replace('/^(SEKSI|SEK)[-_ ]*/i', '', $orgCode));
        $code = (string) preg_replace('/[^A-Z0-9]/', '', $code);

        return substr($code !== '' ? $code : 'UNIT', 0, 12);
    }

    public function add(User $by, OrgUnit $seksi, array $data): ServiceCategory
    {
        return DB::transaction(function () use ($seksi, $data) {
            $unit = $this->ensureExecutorUnit($seksi);
            $name = trim($data['name']);
            $flags = $this->flags($data, ['for_work_order' => true, 'for_request' => true, 'requires_note' => false]);

            $existing = $unit->categories()->withTrashed()->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])->first();
            if ($existing && ! $existing->trashed() && $existing->is_active) {
                throw ValidationException::withMessages(['name' => ["Kategori \"{$existing->name}\" sudah ada di {$unit->display_name}."]]);
            }
            if ($existing) {
                $existing->trashed() && $existing->restore();
                $existing->fill($flags + ['name' => $name, 'is_active' => true])->save();

                return $existing->refresh();
            }

            $last = $unit->categories()->withTrashed()->where('name', '!=', self::OTHER)->max('sort_order');
            $category = $unit->categories()->create($flags + [
                'name' => $name,
                'is_active' => true,
                'sort_order' => $last === null ? 0 : $last + 1,
            ]);
            // "Lain-lain" always stays last.
            $unit->categories()->where('name', self::OTHER)->update(['sort_order' => $category->sort_order + 1]);

            return $category->refresh();
        });
    }

    public function update(ServiceCategory $category, array $data): ServiceCategory
    {
        if (isset($data['name'])) {
            $name = trim($data['name']);
            $clash = ServiceCategory::query()
                ->where('executor_unit_id', $category->executor_unit_id)
                ->whereKeyNot($category->id)
                ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
                ->exists();
            if ($clash) {
                throw ValidationException::withMessages(['name' => ["Kategori \"{$name}\" sudah ada."]]);
            }
            $category->name = $name;
        }

        $category->fill($this->flags($data, []));
        if (array_key_exists('is_active', $data)) {
            $category->is_active = (bool) $data['is_active'];
        }
        if (! $category->for_work_order && ! $category->for_request) {
            throw ValidationException::withMessages(['for_work_order' => ['Kategori harus dipakai minimal di Work Order atau Form Request.']]);
        }
        $category->save();

        return $category->refresh();
    }

    private function flags(array $data, array $defaults): array
    {
        $flags = $defaults;
        foreach (['for_work_order', 'for_request', 'requires_note'] as $key) {
            if (array_key_exists($key, $data) && $data[$key] !== null) {
                $flags[$key] = (bool) $data[$key];
            }
        }

        return $flags;
    }

    private function uniqueCode(string $orgCode): string
    {
        $base = self::codeFromOrgCode($orgCode);
        $code = $base;
        for ($i = 2; ExecutorUnit::withTrashed()->where('code', $code)->exists(); $i++) {
            $code = substr($base, 0, 10).$i;
        }

        return $code;
    }
}
