<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Dashboard\DashboardScope;
use App\Services\Dashboard\DashboardService;
use App\Services\Dashboard\LiveBoardService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class DashboardController extends Controller
{
    public function show(Request $request, DashboardService $dashboard): JsonResponse
    {
        $filters = $request->validate([
            'scope' => ['nullable', Rule::in(DashboardScope::SCOPES)],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
            'executor_unit_id' => ['nullable', 'integer'],
            'location_id' => ['nullable', 'integer'],
            'service_category_id' => ['nullable', 'integer'],
        ]);

        if (! empty($filters['from']) && ! empty($filters['to'])) {
            $days = \Carbon\CarbonImmutable::parse($filters['from'])->diffInDays(\Carbon\CarbonImmutable::parse($filters['to']));
            if ($days > config('pm.dashboard.max_period_days')) {
                throw ValidationException::withMessages(['to' => ['Periode dashboard maksimal '.config('pm.dashboard.max_period_days').' hari.']]);
            }
        }

        return response()->json(['data' => $dashboard->build($request->user(), $filters)]);
    }

    /** Live board (polled every 30 s): WO waiting to be picked up, requests awaiting approval, PM due soon. */
    public function live(Request $request, LiveBoardService $board): JsonResponse
    {
        $filters = $request->validate(['scope' => ['nullable', Rule::in(DashboardScope::SCOPES)]]);

        return response()->json(['data' => $board->build($request->user(), $filters['scope'] ?? null, $request)])
            ->header('Cache-Control', 'no-store');
    }
}
