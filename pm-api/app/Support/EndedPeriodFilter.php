<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Builder;

/**
 * List date range that only narrows *finished* documents.
 *
 * Documents still in progress (WO diajukan/diterima/dikerjakan/selesai, Form Request draft/menunggu/diproses,
 * PM terjadwal/jatuh tempo/terlambat/dikerjakan) are always listed; finished ones (closed, batal, dialihkan,
 * ditolak, PM selesai/dilewati) are listed when the date they ended falls inside `from`..`to` (inclusive).
 */
final class EndedPeriodFilter
{
    /**
     * @param  string[]  $finalStatuses
     * @param  string[]  $endedColumns  candidates for "the date it ended", first non-null wins
     */
    public static function apply(Builder $query, array $finalStatuses, array $endedColumns, ?string $from, ?string $to): Builder
    {
        if (blank($from) && blank($to)) {
            return $query;
        }

        $table = $query->getModel()->getTable();
        $statusColumn = "{$table}.status";
        $ended = 'DATE(COALESCE('.implode(', ', array_map(fn (string $c) => "{$table}.{$c}", $endedColumns)).'))';

        return $query->where(fn (Builder $q) => $q
            ->whereNotIn($statusColumn, $finalStatuses)
            ->orWhere(function (Builder $finished) use ($statusColumn, $finalStatuses, $ended, $from, $to) {
                $finished->whereIn($statusColumn, $finalStatuses);
                if (filled($from)) {
                    $finished->whereRaw("{$ended} >= ?", [$from]);
                }
                if (filled($to)) {
                    $finished->whereRaw("{$ended} <= ?", [$to]);
                }
            }));
    }
}
