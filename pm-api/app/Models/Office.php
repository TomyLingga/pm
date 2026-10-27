<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Form Request "Office": Portal "Penempatan Area" (Head Office INL Sei Mangkei, RO Medan, …), kept in sync by
 * `portal:sync`. Areas that disappear from Portal are deactivated, not deleted, so old requests keep their office.
 */
class Office extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = ['portal_area_id', 'code', 'name', 'is_active', 'synced_at'];

    protected $casts = ['is_active' => 'boolean', 'synced_at' => 'datetime'];

    /**
     * Upsert from a Portal area (`{ id, kode, nama }` of `/api/sso/placements` or `employee.penempatanArea`).
     * An office created before the first sync (e.g. by OfficeSeeder) with the same code is taken over.
     */
    public static function fromPortalArea(?array $area): ?self
    {
        $code = trim((string) ($area['kode'] ?? ''));
        if (empty($area['id']) || $code === '') {
            return null;
        }

        $office = self::withTrashed()->where('portal_area_id', $area['id'])->first()
            ?? self::withTrashed()->whereNull('portal_area_id')->where('code', $code)->first()
            ?? new self();
        $office->fill([
            'portal_area_id' => $area['id'],
            'code' => $code,
            'name' => trim((string) ($area['nama'] ?? '')) ?: $code,
            'is_active' => true,
            'synced_at' => now(),
        ]);
        $office->deleted_at = null;
        $office->save();

        return $office;
    }
}
