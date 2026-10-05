<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;

/**
 * Mirror of Portal INTES `unit_organisasi`.
 */
class OrgUnit extends Model
{
    use HasFactory;

    public const TYPE_BAGIAN = 'bagian';
    public const TYPE_SUB_BAGIAN = 'sub_bagian';
    public const TYPE_SEKSI = 'seksi';

    protected $fillable = [
        'portal_unit_id',
        'code',
        'name',
        'type',
        'parent_id',
        'is_active',
        'synced_at',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'synced_at' => 'datetime',
    ];

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id');
    }

    /**
     * IDs of this unit and all of its ancestors (self first).
     *
     * @return int[]
     */
    public static function selfAndAncestorIds(int $id): array
    {
        $rows = DB::select(
            'WITH RECURSIVE chain AS (
                SELECT id, parent_id, 0 AS depth FROM org_units WHERE id = ?
                UNION ALL
                SELECT o.id, o.parent_id, chain.depth + 1 FROM org_units o JOIN chain ON o.id = chain.parent_id
                WHERE chain.depth < 20
            ) SELECT id FROM chain ORDER BY depth',
            [$id]
        );

        return array_map(fn ($row) => (int) $row->id, $rows);
    }

    /**
     * IDs of this unit and every unit below it.
     *
     * @return int[]
     */
    public static function selfAndDescendantIds(int $id): array
    {
        $rows = DB::select(
            'WITH RECURSIVE tree AS (
                SELECT id, 0 AS depth FROM org_units WHERE id = ?
                UNION ALL
                SELECT o.id, tree.depth + 1 FROM org_units o JOIN tree ON o.parent_id = tree.id
                WHERE tree.depth < 20
            ) SELECT id FROM tree',
            [$id]
        );

        return array_map(fn ($row) => (int) $row->id, $rows);
    }

    /** Nearest unit of the given type walking up from (and including) this unit. */
    public function ancestorOfType(string $type): ?self
    {
        if ($this->type === $type) {
            return $this;
        }

        $ids = self::selfAndAncestorIds($this->id);

        return self::query()->whereIn('id', $ids)->where('type', $type)->get()
            ->sortBy(fn (self $unit) => array_search($unit->id, $ids, true))
            ->first();
    }
}
