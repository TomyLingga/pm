<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserBriefResource;
use App\Models\OrgUnit;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * Hak akses (admin only). Two global roles exist: `admin` sees and manages everything; everybody else is a
 * regular user who only sees their own documents and their unit's. Executor roles come from Portal grades.
 */
class UserAccessController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'role' => ['nullable', 'in:admin,user'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = User::query()->with('orgUnit')->where('is_active', true)
            ->when(filled($filters['q'] ?? null), function (Builder $q) use ($filters) {
                $term = '%'.mb_strtolower(trim($filters['q'])).'%';
                $q->where(fn (Builder $w) => $w
                    ->whereRaw('LOWER(name) LIKE ?', [$term])
                    ->orWhereRaw('LOWER(nrk) LIKE ?', [$term])
                    ->orWhereRaw('LOWER(COALESCE(email, \'\')) LIKE ?', [$term]));
            })
            ->when(($filters['role'] ?? null) === 'admin', fn (Builder $q) => $q->role(User::ROLE_ADMIN))
            ->when(($filters['role'] ?? null) === 'user', fn (Builder $q) => $q->whereDoesntHave('roles', fn ($r) => $r->where('name', User::ROLE_ADMIN)))
            ->orderBy('name');

        $page = $query->paginate((int) ($filters['per_page'] ?? 20));
        $adminIds = User::query()->role(User::ROLE_ADMIN)->whereIn('id', $page->pluck('id'))->pluck('id')->all();

        return response()->json([
            'data' => collect($page->items())->map(fn (User $u) => $this->row($u, in_array($u->id, $adminIds, true), $request))->values(),
            // Same shape as Laravel resource-collection pagination (what the web client reads).
            'meta' => [
                'current_page' => $page->currentPage(),
                'from' => $page->firstItem(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'to' => $page->lastItem(),
                'total' => $page->total(),
                'admin_count' => User::query()->role(User::ROLE_ADMIN)->where('is_active', true)->count(),
            ],
        ]);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $this->authorizeAdmin($request);
        $data = $request->validate(['is_admin' => ['required', 'boolean']]);

        if ((int) $user->id === (int) $request->user()->id && ! $data['is_admin']) {
            throw ValidationException::withMessages(['is_admin' => ['Anda tidak dapat mencabut hak admin Anda sendiri.']]);
        }
        if (! $user->is_active && $data['is_admin']) {
            throw ValidationException::withMessages(['is_admin' => ['User nonaktif tidak dapat dijadikan admin.']]);
        }

        $data['is_admin'] ? $user->assignRole(User::ROLE_ADMIN) : $user->removeRole(User::ROLE_ADMIN);

        return response()->json(['data' => $this->row($user->fresh('orgUnit'), (bool) $data['is_admin'], $request)]);
    }

    private function authorizeAdmin(Request $request): void
    {
        abort_unless($request->user()->isAdmin(), 403, 'Hanya admin yang dapat mengatur hak akses.');
    }

    private function row(User $user, bool $isAdmin, Request $request): array
    {
        /** @var OrgUnit|null $unit */
        $unit = $user->orgUnit;

        return (new UserBriefResource($user))->toArray($request) + [
            'email' => $user->email,
            'grade_code' => $user->grade_code,
            'org_unit' => $unit ? ['id' => $unit->id, 'code' => $unit->code, 'name' => $unit->name, 'type' => $unit->type] : null,
            'is_admin' => $isAdmin,
            'is_me' => (int) $user->id === (int) $request->user()->id,
        ];
    }
}
