<?php

namespace App\Services\ServiceRequests;

use App\Models\ServiceRequest;
use App\Models\User;
use App\Services\Org\ExecutorDirectory;
use App\Support\EndedPeriodFilter;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Builder;

/** Filtered Form Request query shared by the list endpoint and the Excel export. */
class ServiceRequestQuery
{
    public const SCOPES = ['mine', 'unit', 'executor', 'all'];

    public const FINAL_STATUSES = ['completed', 'rejected', 'cancelled', 'converted'];

    public function __construct(private ExecutorDirectory $directory)
    {
    }

    public function build(User $user, array $filters): Builder
    {
        $query = ServiceRequest::query();

        match ($filters['scope'] ?? 'mine') {
            'unit' => $query->where('requester_org_unit_id', $user->org_unit_id ?? 0),
            // Executors only see requests that left the draft stage.
            'executor' => $query->whereIn('executor_unit_id', $this->directory->unitsFor($user)->pluck('id')->all() ?: [0])
                ->whereNotNull('submitted_at'),
            'all' => $user->canSeeEverything()
                ? $query->where(fn (Builder $q) => $q->whereNotNull('submitted_at')->orWhere('requester_id', $user->id))
                : throw new AuthorizationException('Hanya admin yang dapat melihat semua request.'),
            default => $query->where('requester_id', $user->id),
        };

        if (! empty($filters['status'])) {
            $query->whereIn('status', array_filter(explode(',', $filters['status'])));
        }
        foreach (['executor_unit_id', 'service_category_id', 'priority', 'office_id'] as $field) {
            if (! empty($filters[$field])) {
                $query->where($field, $filters[$field]);
            }
        }
        // Period for finished requests only (selesai / ditolak / dibatalkan / dialihkan, by the date they ended);
        // drafts and requests still waiting or in progress are always listed.
        EndedPeriodFilter::apply($query, self::FINAL_STATUSES, ['completed_at', 'rejected_at', 'cancelled_at', 'converted_at'],
            $filters['from'] ?? null, $filters['to'] ?? null);
        if (! empty($filters['q'])) {
            $term = '%'.mb_strtolower(trim($filters['q'])).'%';
            $query->where(fn (Builder $q) => $q->whereRaw('LOWER(request_number) LIKE ?', [$term])
                ->orWhereRaw('LOWER(purpose) LIKE ?', [$term]));
        }

        return $query->orderByDesc('created_at')->orderByDesc('id');
    }
}
