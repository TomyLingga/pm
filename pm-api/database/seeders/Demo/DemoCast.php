<?php

namespace Database\Seeders\Demo;

use App\Models\ExecutorUnit;
use App\Models\OrgUnit;
use App\Models\ServiceCategory;
use App\Models\User;
use App\Services\Org\ExecutorDirectory;
use App\Services\Org\ServiceCategoryService;
use App\Services\ServiceRequests\ServiceRequestService;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * The people and units the demo story is played with.
 *
 * Prefers the real organisation synced from Portal (seksi IT and Maintenance, their own lead, the Kasubag /
 * Kabag above them, technicians, and requesters from other units with their Portal atasan). When that is not
 * available (empty database) a small demo organisation is created instead.
 */
class DemoCast
{
    /** flavour => seksi Portal code candidates + categories */
    private const FLAVOURS = [
        'it' => [
            'org_codes' => ['SEK-IT'],
            'match' => '/\bIT\b|TEKNOLOGI|SISTEM/i',
            'categories' => ['Hardware', 'Software', 'Network', 'Akses', ServiceCategoryService::OTHER],
        ],
        'mtc' => [
            'org_codes' => ['SEK-MAINTENANC', 'SEK-MAINTENANCE', 'SEK-MTC'],
            'match' => '/MAINTEN|PEMELIHARAAN|BENGKEL/i',
            'categories' => ['Mechanical', 'Electrical', 'Fabrikasi', ServiceCategoryService::OTHER],
        ],
    ];

    /** @var array<string, array{unit: ExecutorUnit, lead: User, upper: User, techs: User[], categories: array<string, ServiceCategory>}> */
    public array $units = [];

    /** @var User[] */
    public array $requesters = [];

    /** @var array<int, User> requester id => Atasan YBS */
    public array $superiors = [];

    public bool $createdDemoOrganisation = false;

    public function __construct(
        private ExecutorDirectory $directory,
        private ServiceCategoryService $categories,
        private ServiceRequestService $requests,
    ) {
    }

    public function resolve(): self
    {
        foreach (array_keys(self::FLAVOURS) as $flavour) {
            $unit = $this->findUnit($flavour);
            if ($unit && ($cast = $this->castFor($flavour, $unit))) {
                $this->units[$flavour] = $cast;
            }
        }
        $this->pickRequesters();

        if (count($this->units) < 2 || count($this->requesters) < 4) {
            $this->units = [];
            $this->requesters = [];
            $this->superiors = [];
            $this->createDemoOrganisation();
            foreach (array_keys(self::FLAVOURS) as $flavour) {
                $this->units[$flavour] = $this->castFor($flavour, $this->findUnit($flavour, demo: true))
                    ?? throw new RuntimeException("Organisasi demo untuk {$flavour} tidak lengkap.");
            }
            $this->pickRequesters();
        }

        return $this;
    }

    public function category(string $flavour, string $name): ServiceCategory
    {
        return $this->units[$flavour]['categories'][$name];
    }

    // ── Units & staff ─────────────────────────────────────────────────────────

    private function findUnit(string $flavour, bool $demo = false): ?ExecutorUnit
    {
        $config = self::FLAVOURS[$flavour];
        $codes = $demo ? ['SEK-DEMO-'.strtoupper($flavour)] : $config['org_codes'];

        $seksi = OrgUnit::query()->where('type', OrgUnit::TYPE_SEKSI)->where('is_active', true)->whereIn('code', $codes)->first();
        if (! $seksi && ! $demo) {
            $unit = ExecutorUnit::query()->where('is_active', true)->with('orgUnit')->get()
                ->first(fn (ExecutorUnit $u) => preg_match($config['match'], $u->display_name.' '.$u->orgUnit?->name));
            $seksi = $unit?->orgUnit;
        }
        if (! $seksi) {
            return null;
        }

        $unit = $this->categories->ensureExecutorUnit($seksi);
        foreach ($config['categories'] as $name) {
            $exists = $unit->categories()->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])->where('is_active', true)->exists();
            if (! $exists) {
                $category = $this->categories->add(new User(), $seksi, ['name' => $name]);
                if ($name === ServiceCategoryService::OTHER) {
                    $category->forceFill(['requires_note' => true])->save();
                }
            }
        }

        return $unit->fresh();
    }

    private function castFor(string $flavour, ExecutorUnit $unit): ?array
    {
        $staff = $this->directory->staffQuery($unit)->orderByDesc('grade_level')->orderBy('id')->get();
        $seksiUnits = OrgUnit::selfAndDescendantIds($unit->org_unit_id);

        $inSeksi = $staff->filter(fn (User $u) => in_array($u->org_unit_id, $seksiUnits, true));
        $lead = $inSeksi->first(fn (User $u) => $this->directory->hasLeadGrade($u));
        // Nearest superior above the seksi first (Kasubag before Kabag).
        $upper = $staff->sortBy('grade_level')
            ->first(fn (User $u) => ! in_array($u->org_unit_id, $seksiUnits, true) && $this->directory->hasLeadGrade($u));
        $techs = $inSeksi->filter(fn (User $u) => $u->grade_code === 'BOM-4')->sortBy('id')->values();
        if ($techs->count() < 3) {
            $techs = $inSeksi->reject(fn (User $u) => $this->directory->hasLeadGrade($u))->sortBy('id')->values();
        }
        if (! $lead || $techs->count() < 3) {
            return null;
        }

        $categories = [];
        foreach ($unit->categories()->where('is_active', true)->get() as $category) {
            $categories[$category->name] = $category;
        }

        return [
            'unit' => $unit,
            'lead' => $lead,
            'upper' => $upper ?? $lead,
            'techs' => $techs->take(3)->all(),
            'categories' => $categories,
        ];
    }

    // ── Requesters ────────────────────────────────────────────────────────────

    private function pickRequesters(): void
    {
        $taken = [];
        foreach ($this->units as $cast) {
            $taken = array_merge($taken, $this->directory->staffQuery($cast['unit'])->pluck('id')->all());
        }

        $usedUnits = [];
        $candidates = User::query()
            ->where('is_active', true)
            ->whereNotNull('org_unit_id')
            ->whereIn('grade_code', ['BOM-4', 'BOM-3'])
            ->whereNotIn('id', $taken ?: [0])
            ->orderBy('id')
            ->limit(400)
            ->get();

        foreach ($candidates as $user) {
            if (count($this->requesters) >= 4 || in_array($user->org_unit_id, $usedUnits, true)) {
                continue;
            }
            $superior = $this->superiorFor($user);
            if (! $superior || in_array($superior->id, $taken, true)) {
                continue;
            }
            $this->requesters[] = $user;
            $this->superiors[$user->id] = $superior;
            $usedUnits[] = $user->org_unit_id;
        }
    }

    private function superiorFor(User $user): ?User
    {
        $default = $this->requests->defaultSuperior($user);
        if ($default && $this->requests->isEligibleSuperior($user, $default)) {
            return $default;
        }

        foreach (OrgUnit::selfAndAncestorIds($user->org_unit_id) as $orgUnitId) {
            $candidate = User::query()->where('is_active', true)->where('org_unit_id', $orgUnitId)
                ->where('grade_level', '>', (int) $user->grade_level)->whereKeyNot($user->id)
                ->orderBy('grade_level')->first();
            if ($candidate && $this->requests->isEligibleSuperior($user, $candidate)) {
                return $candidate;
            }
        }

        return null;
    }

    // ── Demo organisation (empty database only) ───────────────────────────────

    private function createDemoOrganisation(): void
    {
        $this->createdDemoOrganisation = true;
        $unit = fn (string $code, string $name, string $type, ?OrgUnit $parent = null) => OrgUnit::query()->firstOrCreate(
            ['code' => $code],
            ['portal_unit_id' => (string) Str::uuid(), 'name' => $name, 'type' => $type, 'parent_id' => $parent?->id, 'is_active' => true],
        );

        $tek = $unit('BAG-DEMO-TEK', 'Teknik', OrgUnit::TYPE_BAGIAN);
        $sit = $unit('SUB-DEMO-SIT', 'Sistem & IT', OrgUnit::TYPE_SUB_BAGIAN, $tek);
        $it = $unit('SEK-DEMO-IT', 'IT', OrgUnit::TYPE_SEKSI, $sit);
        $pml = $unit('SUB-DEMO-PML', 'Pemeliharaan', OrgUnit::TYPE_SUB_BAGIAN, $tek);
        $mtc = $unit('SEK-DEMO-MTC', 'Maintenance', OrgUnit::TYPE_SEKSI, $pml);
        $keu = $unit('BAG-DEMO-KEU', 'Keuangan & Umum', OrgUnit::TYPE_BAGIAN);
        $akt = $unit('SUB-DEMO-AKT', 'Akuntansi', OrgUnit::TYPE_SUB_BAGIAN, $keu);
        $pjk = $unit('SEK-DEMO-PJK', 'Pajak', OrgUnit::TYPE_SEKSI, $akt);
        $umum = $unit('SUB-DEMO-UMM', 'Umum', OrgUnit::TYPE_SUB_BAGIAN, $keu);
        $gdg = $unit('SEK-DEMO-GDG', 'Gudang', OrgUnit::TYPE_SEKSI, $umum);

        $n = 0;
        $person = function (string $name, OrgUnit $at, string $grade, string $position, ?User $superior = null) use (&$n): User {
            $n++;
            $levels = ['BOM-1' => 12, 'BOM-2' => 10, 'BOM-3' => 8, 'BOM-4' => 5];

            return User::query()->firstOrCreate(['nrk' => sprintf('DEMO%04d', $n)], [
                'portal_user_id' => (string) Str::uuid(),
                'portal_employee_id' => (string) Str::uuid(),
                'name' => $name,
                'email' => 'demo'.$n.'@example.test',
                'phone' => '0812000'.sprintf('%05d', $n),
                'employment_status' => 'Karyawan Tetap',
                'position' => $position,
                'grade_code' => $grade,
                'grade_level' => $levels[$grade],
                'org_unit_id' => $at->id,
                'superior_id' => $superior?->id,
                'is_active' => true,
            ]);
        };

        $kabagTek = $person('Hendra Saputra', $tek, 'BOM-1', 'Kepala Bagian Teknik');
        $kasubagSit = $person('Rina Marpaung', $sit, 'BOM-2', 'Kepala Sub Bagian Sistem & IT', $kabagTek);
        $kasieIt = $person('Yoga Pratama', $it, 'BOM-3', 'Supervisor IT', $kasubagSit);
        foreach (['Andi Nugroho', 'Bima Sitepu', 'Citra Lestari'] as $name) {
            $person($name, $it, 'BOM-4', 'Teknisi IT', $kasieIt);
        }
        $kasubagPml = $person('Joko Susilo', $pml, 'BOM-2', 'Kepala Sub Bagian Pemeliharaan', $kabagTek);
        $kasieMtc = $person('Fajar Simanjuntak', $mtc, 'BOM-3', 'Foreman Maintenance', $kasubagPml);
        foreach (['Dedi Harahap', 'Eko Wibowo', 'Gilang Ramadhan'] as $name) {
            $person($name, $mtc, 'BOM-4', 'Teknisi Maintenance', $kasieMtc);
        }
        $kabagKeu = $person('Sri Wahyuni', $keu, 'BOM-1', 'Kepala Bagian Keuangan & Umum');
        $kasubagAkt = $person('Maya Siregar', $akt, 'BOM-2', 'Kepala Sub Bagian Akuntansi', $kabagKeu);
        $kasubagUmum = $person('Agus Salim', $umum, 'BOM-2', 'Kepala Sub Bagian Umum', $kabagKeu);
        $person('Putri Ayu', $pjk, 'BOM-4', 'Staf Pajak', $kasubagAkt);
        $person('Rudi Hartono', $akt, 'BOM-4', 'Staf Akuntansi', $kasubagAkt);
        $person('Siti Aminah', $gdg, 'BOM-4', 'Staf Gudang', $kasubagUmum);
        $person('Wahyu Hidayat', $umum, 'BOM-3', 'Asisten Umum', $kasubagUmum);
    }
}
