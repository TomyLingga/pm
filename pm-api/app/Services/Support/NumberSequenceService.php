<?php

namespace App\Services\Support;

use App\Models\NumberSequence;
use Illuminate\Support\Facades\DB;

/**
 * Gap-free document counters per (doc type, scope, year). Must run inside the caller's transaction.
 */
class NumberSequenceService
{
    public function next(string $docType, string $scopeCode, int $year): int
    {
        $key = ['doc_type' => $docType, 'scope_code' => $scopeCode, 'year' => $year];

        DB::table('number_sequences')->insertOrIgnore($key + [
            'last_number' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        /** @var NumberSequence $sequence */
        $sequence = NumberSequence::query()->where($key)->lockForUpdate()->firstOrFail();
        $sequence->increment('last_number');

        return (int) $sequence->last_number;
    }

    public static function romanMonth(int $month): string
    {
        return ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][$month - 1];
    }
}
