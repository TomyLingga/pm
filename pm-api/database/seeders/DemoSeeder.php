<?php

namespace Database\Seeders;

use App\Models\ChecklistTemplate;
use App\Models\Equipment;
use App\Models\Location;
use App\Models\Material;
use App\Models\Office;
use App\Models\PmSchedule;
use App\Models\PmTask;
use App\Models\PmTaskItem;
use App\Models\ServiceRequest;
use App\Models\User;
use App\Models\WorkOrder;
use App\Services\Org\ServiceCategoryService;
use App\Services\Pm\ChecklistTemplateService;
use App\Services\Pm\PmScheduleService;
use App\Services\Pm\PmStatusRefresher;
use App\Services\Pm\PmTaskGenerator;
use App\Services\Pm\PmTaskService;
use App\Services\ServiceRequests\DocumentConversionService;
use App\Services\ServiceRequests\ServiceRequestService;
use App\Services\WorkOrders\WorkOrderService;
use Carbon\CarbonImmutable;
use Database\Seeders\Demo\DemoCast;
use Database\Seeders\Demo\WorkProgramDemoSeeder;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;
use SplPriorityQueue;
use stdClass;

/**
 * Demo data covering every case and status of Work Order, Form Request and Preventive Maintenance.
 *
 *   php artisan db:seed --class=DemoSeeder        (dev / staging only)
 *
 * The clock is rewound about six weeks and the story is replayed in time order through the real services:
 * WO and Form Request actions, the hourly PM scheduler (generate, JATUH_TEMPO, TERLAMBAT, auto-skip) and WO
 * auto-accept. Numbers, status logs, QR signatures and timestamps therefore look like real usage; steps that
 * would happen after "now" are simply not done yet, which leaves documents in their in-between states.
 * Uses the synced Portal organisation when available (see DemoCast). No notification is sent.
 */
class DemoSeeder extends Seeder
{
    private const MARKER_EQUIPMENT = 'UPS-SRV-01';
    private const DAYS_BACK = 42;

    private CarbonImmutable $realNow;
    private SplPriorityQueue $queue;
    private int $sequence = 0;
    private bool $running = false;
    private DemoCast $cast;

    /** @var array<int, string> pm_schedule_id => story key */
    private array $scheduleKeys = [];
    /** @var array<int, true> */
    private array $plannedTasks = [];
    /** @var array<string, int> */
    private array $counts = ['wo' => 0, 'sr' => 0];

    public function __construct(
        private WorkOrderService $workOrders,
        private ServiceRequestService $requests,
        private DocumentConversionService $conversions,
        private PmTaskService $pmTasks,
        private PmScheduleService $schedules,
        private ChecklistTemplateService $templates,
        private PmTaskGenerator $generator,
        private PmStatusRefresher $refresher,
    ) {
    }

    public function run(): void
    {
        if (Equipment::withTrashed()->where('code', self::MARKER_EQUIPMENT)->exists()) {
            $this->command?->warn('Data demo sudah ada (equipment '.self::MARKER_EQUIPMENT.'). Untuk mengulang: '
                .'php artisan migrate:fresh --seed, php artisan portal:sync, lalu jalankan seeder ini lagi.');

            return;
        }
        if (! Office::query()->exists()) {
            $this->call(OfficeSeeder::class);
        }

        Notification::fake();
        $previousNow = [Carbon::getTestNow(), CarbonImmutable::getTestNow()];
        $this->realNow = CarbonImmutable::now()->startOfMinute();
        $this->queue = new SplPriorityQueue();

        try {
            $this->setClock($this->day(self::DAYS_BACK, '07:00'));
            $this->cast = app(DemoCast::class)->resolve();
            $this->masterData();

            $this->scheduler();
            $this->itWorkOrders();
            $this->maintenanceWorkOrders();
            $this->itRequests();
            $this->maintenanceRequests();
            $this->preventiveMaintenance();

            $this->running = true;
            while (! $this->queue->isEmpty()) {
                [$time, $step] = $this->queue->extract();
                $this->setClock($time);
                $step();
            }
        } finally {
            // Back to the clock we started with (real time, or a test's frozen time).
            Carbon::setTestNow($previousNow[0]);
            CarbonImmutable::setTestNow($previousNow[1]);
        }

        $this->report();
        $this->call(WorkProgramDemoSeeder::class);
    }

    // ── Timeline ──────────────────────────────────────────────────────────────

    private function setClock(CarbonImmutable $time): void
    {
        Carbon::setTestNow(Carbon::instance($time->toDateTime()));
        CarbonImmutable::setTestNow($time);
    }

    /** `$daysAgo` days before today at `$time` (Asia/Jakarta). */
    private function day(int $daysAgo, string $time): CarbonImmutable
    {
        return $this->realNow->startOfDay()->subDays($daysAgo)->setTimeFromTimeString($time);
    }

    /** Like day(), but never before the 1st of the current month, so "this month" always has finished documents. */
    private function thisMonth(int $daysAgo, string $time): CarbonImmutable
    {
        $day = $this->realNow->startOfDay()->subDays($daysAgo);

        return ($day->lessThan($this->realNow->startOfMonth()) ? $this->realNow->startOfMonth() : $day)->setTimeFromTimeString($time);
    }

    private function at(CarbonImmutable $time, callable $step): void
    {
        if ($time->greaterThan($this->realNow)) {
            return; // not happened yet
        }
        if ($this->running && $time->lessThan(CarbonImmutable::now())) {
            $time = CarbonImmutable::now(); // planned while replaying: never move the clock backwards
        }
        $this->queue->insert([$time, $step], [-$time->getTimestamp(), -(++$this->sequence)]);
    }

    /**
     * A document's story: steps at minutes after `$start` (or at absolute times), sharing one context.
     *
     * @param  array<int, array{0: int|CarbonImmutable, 1: callable(stdClass): mixed}>  $steps
     */
    private function story(CarbonImmutable $start, array $steps): void
    {
        $context = new stdClass();
        foreach ($steps as [$when, $step]) {
            $this->at($when instanceof CarbonImmutable ? $when : $start->addMinutes($when), fn () => $step($context));
        }
    }

    /** The jobs of the real scheduler: generate PM tasks nightly; PM statuses + WO auto-accept hourly. */
    private function scheduler(): void
    {
        $start = $this->day(self::DAYS_BACK, '00:00');
        for ($t = $start; $t->lessThanOrEqualTo($this->realNow); $t = $t->addHour()) {
            if ($t->hour === 0) {
                $this->at($t->addMinutes(5), fn () => $this->generator->generateAll(CarbonImmutable::now()));
            }
            $this->at($t->addMinutes(1), fn () => $this->hourlyJobs());
        }
        $this->at($this->realNow, fn () => $this->hourlyJobs());
    }

    private function hourlyJobs(): void
    {
        $now = CarbonImmutable::now();
        $this->refresher->run($now);

        WorkOrder::query()->where('status', 'completed')->where('acceptance_due_at', '<=', $now)->get()
            ->each(fn (WorkOrder $wo) => $this->workOrders->autoAccept($wo));

        PmTask::query()->whereIn('status', ['due', 'overdue'])->whereNotIn('id', array_keys($this->plannedTasks) ?: [0])
            ->orderBy('due_at')->get()
            ->each(fn (PmTask $task) => $this->planPmTask($task));
    }

    // ── Master data ───────────────────────────────────────────────────────────

    private function masterData(): void
    {
        foreach ([
            ['MAT-LAN', 'Kabel LAN Cat6', 'm'], ['MAT-RJ45', 'Konektor RJ45', 'pcs'], ['MAT-TONER', 'Toner Canon NPG-59', 'pcs'],
            ['MAT-BAT12', 'Baterai UPS 12V 9Ah', 'pcs'], ['MAT-PSU', 'Power supply PC 450W', 'pcs'], ['MAT-RAM8', 'RAM DDR4 8GB', 'pcs'],
            ['MAT-SEAL', 'Mechanical seal pompa', 'pcs'], ['MAT-OLI', 'Oli mesin SAE 15W-40', 'liter'], ['MAT-AKI', 'Aki 12V 100Ah', 'pcs'],
            ['MAT-BEARING', 'Bearing 6205', 'pcs'], ['MAT-PLAT', 'Plat besi 3 mm', 'lembar'], ['MAT-KRAN', 'Kran air 1/2"', 'pcs'],
        ] as [$code, $name, $unit]) {
            Material::query()->firstOrCreate(['code' => $code], ['name' => $name, 'unit' => $unit, 'is_active' => true]);
        }

        $location = fn (string $code, string $name) => Location::query()->firstOrCreate(['code' => $code], ['name' => $name, 'is_active' => true]);
        $srv = $location('HO-SRV', 'Head Office - Ruang Server');
        $ho2 = $location('HO-LT2', 'Head Office - Lantai 2');
        $gen = $location('PBK-GENSET', 'Pabrik - Rumah Genset');
        $pmp = $location('PBK-POMPA', 'Pabrik - Rumah Pompa');
        $ws = $location('PBK-WORKSHOP', 'Pabrik - Workshop');
        $tmb = $location('PBK-TIMBANGAN', 'Pabrik - Pos Timbangan');

        $it = $this->cast->units['it']['unit']->id;
        $mtc = $this->cast->units['mtc']['unit']->id;
        foreach ([
            [self::MARKER_EQUIPMENT, 'UPS Server 10 kVA', $srv, $it, 'APC', 'Smart-UPS SRT 10000'],
            ['SRV-FILE-01', 'Server File', $srv, $it, 'HPE', 'ProLiant DL380 Gen10'],
            ['SW-CORE-01', 'Switch Core', $srv, $it, 'Cisco', 'Catalyst 9300'],
            ['AC-SRV-01', 'AC Presisi Ruang Server', $srv, $it, 'Daikin', 'FTKC50'],
            ['PRN-HO-01', 'Printer Multifungsi Lt. 2', $ho2, $it, 'Canon', 'imageRUNNER 2625i'],
            ['GEN-01', 'Genset 500 kVA', $gen, $mtc, 'Cummins', 'C550D5'],
            ['PMP-01', 'Pompa Air Bersih', $pmp, $mtc, 'Grundfos', 'CR 32-2'],
            ['PMP-02', 'Pompa Hydrant', $pmp, $mtc, 'Ebara', 'FSA 100x80'],
            ['KMP-01', 'Kompresor Udara', $ws, $mtc, 'Atlas Copco', 'GA 22'],
            ['TMB-01', 'Timbangan Truk 60 Ton', $tmb, $mtc, 'Avery', 'WT-60'],
        ] as $i => [$code, $name, $loc, $unit, $brand, $model]) {
            Equipment::query()->create([
                'code' => $code, 'name' => $name, 'location_id' => $loc->id, 'executor_unit_id' => $unit,
                'brand' => $brand, 'model' => $model, 'serial_number' => sprintf('SN-%s-%04d', $code, 1000 + $i * 37), 'status' => 'active',
            ]);
        }
    }

    // ── Work order helpers (run at the current clock) ─────────────────────────

    private function eq(?string $code): ?Equipment
    {
        return $code ? Equipment::query()->where('code', $code)->first() : null;
    }

    private function newWorkOrder(stdClass $c, string $flavour, User $requester, string $description, string $category, string $priority,
        ?string $equipment = null, ?string $note = null): void
    {
        $eq = $this->eq($equipment);
        $c->wo = $this->workOrders->create($requester, [
            'executor_unit_id' => $this->cast->units[$flavour]['unit']->id,
            'service_category_id' => $this->cast->category($flavour, $category)->id,
            'category_note' => $note,
            'equipment_id' => $eq?->id,
            'location_id' => $eq?->location_id,
            'request_description' => $description,
            'priority' => $priority,
        ]);
        $c->requester = $requester;
        $c->labours = [];
        $this->counts['wo']++;
    }

    private function pick(stdClass $c, User $technician): void
    {
        $this->workOrders->pick($c->wo, $technician);
        $c->technician = $technician;
        $c->startedAt = now();
    }

    private function receive(stdClass $c, User $lead, array $technicians): void
    {
        $this->workOrders->receive($c->wo, $lead, array_map(fn (User $t) => $t->id, $technicians), $technicians[0]->id);
        $c->technician = $technicians[0];
        $c->team = $technicians;
    }

    private function start(stdClass $c): void
    {
        $this->workOrders->start($c->wo, $c->technician);
        $c->startedAt = now();
    }

    /** @param array<string, float> $materials material code => quantity */
    private function complete(stdClass $c, string $workDone, array $materials = []): void
    {
        foreach ($c->team ?? [$c->technician] as $person) {
            $c->labours[] = ['user_id' => $person->id, 'started_at' => $c->startedAt->toIso8601String(), 'finished_at' => now()->toIso8601String()];
        }
        $this->workOrders->complete($c->wo, $c->technician, [
            'work_done' => $workDone,
            'labours' => $c->labours,
            'materials' => collect($materials)->map(fn ($qty, $code) => [
                'material_id' => Material::query()->where('code', $code)->value('id'), 'quantity' => $qty,
            ])->values()->all(),
            'clearance' => $this->clearance(),
        ]);
    }

    private function accept(stdClass $c, ?float $breakdownHours = null, ?string $remarks = null): void
    {
        $this->workOrders->accept($c->wo, $c->requester, [
            'acceptance' => 'yes', 'clearance' => $this->clearance(), 'total_breakdown_hours' => $breakdownHours, 'remarks' => $remarks,
        ]);
    }

    private function reject(stdClass $c, string $reason): void
    {
        $this->workOrders->accept($c->wo, $c->requester, ['acceptance' => 'no', 'reason' => $reason]);
        $c->startedAt = now();
    }

    private function clearance(): array
    {
        return array_map(fn ($no) => ['item_no' => $no, 'result' => 'ok'], array_keys(config('pm.work_order.clearance_items')));
    }

    // ── Form request helpers ──────────────────────────────────────────────────

    private function newRequest(stdClass $c, string $flavour, User $requester, string $category, string $purpose, string $priority,
        ?int $cost = null, string $office = 'HO'): void
    {
        $c->requester = $requester;
        $c->superior = $this->cast->superiors[$requester->id];
        $c->sr = $this->requests->createDraft($requester, [
            'executor_unit_id' => $this->cast->units[$flavour]['unit']->id,
            'service_category_id' => $this->cast->category($flavour, $category)->id,
            'office_id' => $this->officeId($office),
            'purpose' => $purpose,
            'priority' => $priority,
            'estimated_cost' => $cost,
            'superior_id' => $c->superior->id,
        ]);
        $this->counts['sr']++;
    }

    private function officeId(string $code): int
    {
        return (int) (Office::query()->where('code', $code)->value('id') ?? Office::query()->value('id'));
    }

    private function submit(stdClass $c): void
    {
        $c->superior ??= $this->cast->superiors[$c->requester->id] ?? null;
        $this->requests->submit($c->sr, $c->requester, $c->superior?->id);
    }

    // ── IT work orders ────────────────────────────────────────────────────────

    private function itWorkOrders(): void
    {
        ['lead' => $lead, 'upper' => $upper, 'techs' => [$t0, $t1, $t2]] = $this->cast->units['it'];
        [$r0, $r1, $r2, $r3] = $this->cast->requesters;

        // Closed, accepted with breakdown hours (last month)
        $this->story($this->day(38, '08:10'), [
            [0, fn ($c) => $this->newWorkOrder($c, 'it', $r0, 'Printer multifungsi lantai 2 tidak bisa mencetak, muncul kode error E000007.', 'Hardware', 'high', 'PRN-HO-01')],
            [35, fn ($c) => $this->pick($c, $t0)],
            [150, fn ($c) => $this->complete($c, 'Unit fuser dibersihkan, roller pickup diganti, uji cetak 50 lembar normal.', ['MAT-TONER' => 1])],
            [1440, fn ($c) => $this->accept($c, 3.5, 'Sudah normal, terima kasih.')],
        ]);
        // Rejected once by the user (rework), then closed
        $this->story($this->day(33, '09:30'), [
            [0, fn ($c) => $this->newWorkOrder($c, 'it', $r1, 'Komputer kasir sering restart sendiri saat jam sibuk.', 'Hardware', 'medium')],
            [60, fn ($c) => $this->receive($c, $lead, [$t0, $t1])],
            [120, fn ($c) => $this->start($c)],
            [1500, fn ($c) => $this->complete($c, 'Power supply diganti dengan unit baru 450W.', ['MAT-PSU' => 1])],
            [2900, fn ($c) => $this->reject($c, 'Masih restart setelah dipakai sekitar 2 jam.')],
            [3100, fn ($c) => $this->complete($c, 'RAM diganti dan sistem diuji 4 jam tanpa restart.', ['MAT-RAM8' => 1])],
            [4400, fn ($c) => $this->accept($c, 0.5)],
        ]);
        // Cancelled by the requester (last month)
        $this->story($this->day(30, '13:00'), [
            [0, fn ($c) => $this->newWorkOrder($c, 'it', $r2, 'Pembuatan akun email untuk staf baru.', 'Akses', 'low')],
            [180, fn ($c) => $this->workOrders->cancel($c->wo, $r2, 'Sudah dibuatkan langsung oleh admin lewat Portal.')],
        ]);
        // Converted to a Form Request; the requester submits it and it is completed
        $this->story($this->day(27, '10:00'), [
            [0, fn ($c) => $this->newWorkOrder($c, 'it', $r3, 'Instalasi software akuntansi versi terbaru di 5 PC bagian keuangan.', 'Software', 'medium')],
            [120, function ($c) use ($lead) {
                $c->sr = $this->conversions->workOrderToRequest($c->wo, $lead, 'Membutuhkan pembelian lisensi; diproses lewat Form Request.');
                $this->counts['sr']++;
            }],
            [200, function ($c) {
                // The converted draft has no office yet: the requester completes it, then submits.
                $this->requests->updateDraft($c->sr, $c->requester, ['office_id' => $this->officeId('HO')]);
                $this->submit($c);
            }],
            [1500, fn ($c) => $this->requests->approve($c->sr, $c->superior, 'Disetujui, mohon segera diproses.')],
            [3000, fn ($c) => $this->requests->approve($c->sr, $lead, 'Lisensi diajukan ke pengadaan.', $t1->id)],
            [6000, fn ($c) => $this->requests->complete($c->sr, $t1, 'Lisensi terpasang di 5 PC dan sudah diaktivasi.')],
        ]);
        // Completed but never confirmed → closed automatically after 3 working days
        $this->story($this->day(17, '08:45'), [
            [0, fn ($c) => $this->newWorkOrder($c, 'it', $r0, 'Wi-Fi ruang rapat sering putus saat presentasi.', 'Network', 'high')],
            [30, fn ($c) => $this->pick($c, $t1)],
            [200, fn ($c) => $this->complete($c, 'Access point dipindah ke tengah ruangan dan firmware diperbarui.')],
        ]);
        // Received by the Kasubag/Kabag above the seksi, closed
        $this->story($this->day(12, '09:00'), [
            [0, fn ($c) => $this->newWorkOrder($c, 'it', $r1, 'Server file tidak bisa diakses dari jaringan kantor.', 'Network', 'high', 'SRV-FILE-01')],
            [20, fn ($c) => $this->receive($c, $upper, [$t0, $t1])],
            [40, fn ($c) => $this->start($c)],
            [240, fn ($c) => $this->complete($c, 'Layanan SMB dijalankan ulang dan kabel uplink diganti.', ['MAT-LAN' => 5, 'MAT-RJ45' => 2])],
            [1500, fn ($c) => $this->accept($c, 2.0, 'Terima kasih, akses sudah normal.')],
        ]);
        // Still open: submitted long ago (pool), received (not started), in progress
        $this->story($this->day(15, '14:00'), [
            [0, fn ($c) => $this->newWorkOrder($c, 'it', $r2, 'Scanner dokumen macet saat scan bolak-balik.', 'Hardware', 'low')],
        ]);
        $this->story($this->day(9, '10:30'), [
            [0, fn ($c) => $this->newWorkOrder($c, 'it', $r3, 'Pemasangan 4 titik kabel LAN di ruang arsip.', 'Network', 'medium')],
            [90, fn ($c) => $this->receive($c, $lead, [$t2])],
        ]);
        $this->story($this->day(8, '11:00'), [
            [0, fn ($c) => $this->newWorkOrder($c, 'it', $r0, 'Laptop sangat lambat setelah pembaruan Windows.', 'Software', 'medium')],
            [45, fn ($c) => $this->pick($c, $t2)],
        ]);
        $this->story($this->day(5, '10:00'), [
            [0, fn ($c) => $this->newWorkOrder($c, 'it', $r1, 'Relokasi kamera CCTV ke pos satpam depan.', ServiceCategoryService::OTHER, 'medium', null, 'Relokasi CCTV')],
            [60, fn ($c) => $this->receive($c, $lead, [$t1, $t2])],
            [120, fn ($c) => $this->start($c)],
        ]);
        // Rejected by the user the next day → back in progress (rework), before auto-accept could close it
        $this->story($this->day(7, '08:30'), [
            [0, fn ($c) => $this->newWorkOrder($c, 'it', $r1, 'Telepon IP ruang keuangan mati.', 'Network', 'medium')],
            [30, fn ($c) => $this->pick($c, $t0)],
            [180, fn ($c) => $this->complete($c, 'Adaptor PoE diganti.')],
            [1500, fn ($c) => $this->reject($c, 'Masih mati di jam sibuk.')],
        ]);
        // Finished this month: closed and cancelled
        $this->story($this->thisMonth(4, '09:15'), [
            [0, fn ($c) => $this->newWorkOrder($c, 'it', $r2, 'Monitor berkedip dan bergaris.', 'Hardware', 'medium')],
            [25, fn ($c) => $this->pick($c, $t1)],
            [120, fn ($c) => $this->complete($c, 'Kabel VGA diganti HDMI, monitor normal.')],
            [400, fn ($c) => $this->accept($c, 1.0)],
        ]);
        $this->story($this->thisMonth(3, '10:00'), [
            [0, fn ($c) => $this->newWorkOrder($c, 'it', $r0, 'UPS ruang server berbunyi alarm terus-menerus.', 'Hardware', 'high', self::MARKER_EQUIPMENT)],
            [15, fn ($c) => $this->pick($c, $t0)],
            [200, fn ($c) => $this->complete($c, 'Dua baterai UPS yang drop diganti, load test 30 menit normal.', ['MAT-BAT12' => 2])],
            [330, fn ($c) => $this->accept($c, 1.5)],
        ]);
        $this->story($this->thisMonth(3, '13:30'), [
            [0, fn ($c) => $this->newWorkOrder($c, 'it', $r3, 'Lupa password aplikasi absensi.', 'Akses', 'low')],
            [60, fn ($c) => $this->workOrders->cancel($c->wo, $r3, 'Sudah reset sendiri lewat Portal.')],
        ]);
        // Waiting for the user's confirmation
        $this->story($this->day(2, '15:00'), [
            [0, fn ($c) => $this->newWorkOrder($c, 'it', $r1, 'Mouse wireless tidak terdeteksi.', 'Hardware', 'low')],
            [20, fn ($c) => $this->pick($c, $t2)],
            [90, fn ($c) => $this->complete($c, 'Receiver USB dipindah ke port belakang dan baterai diganti.')],
        ]);
        // New, still in the pool
        $this->story($this->day(1, '09:00'), [
            [0, fn ($c) => $this->newWorkOrder($c, 'it', $r2, 'Beberapa tombol keyboard tidak berfungsi.', 'Hardware', 'low')],
        ]);
        $this->story($this->realNow->subHours(3), [
            [0, fn ($c) => $this->newWorkOrder($c, 'it', $r3, 'Proyektor ruang rapat utama tidak menampilkan gambar, rapat direksi jam 14.00.', 'Hardware', 'high')],
        ]);
    }

    // ── Maintenance work orders ───────────────────────────────────────────────

    private function maintenanceWorkOrders(): void
    {
        ['lead' => $lead, 'upper' => $upper, 'techs' => [$m0, $m1, $m2]] = $this->cast->units['mtc'];
        [$r0, $r1, $r2, $r3] = $this->cast->requesters;

        $this->story($this->day(36, '07:45'), [
            [0, fn ($c) => $this->newWorkOrder($c, 'mtc', $r1, 'Pompa air bersih bocor di sambungan seal.', 'Mechanical', 'high', 'PMP-01')],
            [20, fn ($c) => $this->pick($c, $m0)],
            [300, fn ($c) => $this->complete($c, 'Mechanical seal diganti, uji tekanan 4 bar tidak bocor.', ['MAT-SEAL' => 1])],
            [1440, fn ($c) => $this->accept($c, 6.0)],
        ]);
        $this->story($this->day(28, '10:00'), [
            [0, fn ($c) => $this->newWorkOrder($c, 'mtc', $r2, 'Lampu gudang bahan baku mati 3 titik.', 'Electrical', 'low')],
            [120, fn ($c) => $this->workOrders->cancel($c->wo, $r2, 'Sudah diganti oleh tim gudang.')],
        ]);
        $this->story($this->day(21, '08:00'), [
            [0, fn ($c) => $this->newWorkOrder($c, 'mtc', $r3, 'Genset tidak bisa start saat uji mingguan.', 'Electrical', 'high', 'GEN-01')],
            [30, fn ($c) => $this->receive($c, $lead, [$m0, $m1])],
            [60, fn ($c) => $this->start($c)],
            [420, fn ($c) => $this->complete($c, 'Aki starter diganti dan terminal dibersihkan, genset start normal.', ['MAT-AKI' => 1])],
            [1500, fn ($c) => $this->accept($c, 4.0)],
        ]);
        $this->story($this->day(19, '09:00'), [
            [0, fn ($c) => $this->newWorkOrder($c, 'mtc', $r1, 'Atap workshop bocor saat hujan deras.', 'Fabrikasi', 'medium')],
            [90, function ($c) use ($lead) {
                $this->conversions->workOrderToRequest($c->wo, $lead, 'Perlu anggaran material atap; dialihkan ke Form Request.');
                $this->counts['sr']++;
            }],
        ]);
        $this->story($this->day(14, '13:00'), [
            [0, fn ($c) => $this->newWorkOrder($c, 'mtc', $r1, 'Pintu rolling gudang macet di tengah.', 'Fabrikasi', 'medium')],
        ]);
        $this->story($this->day(4, '09:00'), [
            [0, fn ($c) => $this->newWorkOrder($c, 'mtc', $r2, 'Pagar pembatas area boiler berkarat dan patah.', 'Fabrikasi', 'low')],
            [60, fn ($c) => $this->receive($c, $upper, [$m2])],
        ]);
        $this->story($this->day(2, '08:00'), [
            [0, fn ($c) => $this->newWorkOrder($c, 'mtc', $r0, 'Kran wastafel kantor bocor.', 'Mechanical', 'low')],
            [30, fn ($c) => $this->pick($c, $m2)],
            [120, fn ($c) => $this->complete($c, 'Kran diganti baru.', ['MAT-KRAN' => 1])],
        ]);
        $this->story($this->thisMonth(2, '08:20'), [
            [0, fn ($c) => $this->newWorkOrder($c, 'mtc', $r0, 'Kompresor udara berbunyi kasar.', 'Mechanical', 'medium', 'KMP-01')],
            [40, fn ($c) => $this->pick($c, $m1)],
            [240, fn ($c) => $this->complete($c, 'Bearing motor diganti dan dilumasi.', ['MAT-BEARING' => 2])],
            [420, fn ($c) => $this->accept($c, 2.5)],
        ]);
        $this->story($this->day(1, '10:30'), [
            [0, fn ($c) => $this->newWorkOrder($c, 'mtc', $r3, 'Panel listrik workshop sering trip.', 'Electrical', 'high')],
            [20, fn ($c) => $this->pick($c, $m0)],
        ]);
    }

    // ── Form requests ─────────────────────────────────────────────────────────

    private function itRequests(): void
    {
        ['lead' => $lead, 'upper' => $upper, 'techs' => [$t0, $t1, $t2]] = $this->cast->units['it'];
        [$r0, $r1, $r2, $r3] = $this->cast->requesters;

        // Completed (last month)
        $this->story($this->day(35, '10:00'), [
            [0, fn ($c) => $this->newRequest($c, 'it', $r1, 'Akses', 'Pembuatan akun ERP untuk 2 staf baru bagian keuangan.', 'medium')],
            [5, fn ($c) => $this->submit($c)],
            [300, fn ($c) => $this->requests->approve($c->sr, $c->superior)],
            [1500, fn ($c) => $this->requests->approve($c->sr, $lead, null, $t0->id)],
            [3000, fn ($c) => $this->requests->complete($c->sr, $t0, 'Akun dibuat, kredensial diserahkan langsung ke staf.')],
        ]);
        // Rejected by the superior
        $this->story($this->day(31, '14:00'), [
            [0, fn ($c) => $this->newRequest($c, 'it', $r2, 'Hardware', 'Pengadaan monitor tambahan untuk analisa data.', 'low', 2500000)],
            [5, fn ($c) => $this->submit($c)],
            [600, fn ($c) => $this->requests->reject($c->sr, $c->superior, 'Belum masuk anggaran tahun ini.')],
        ]);
        // Rejected by the executing division
        $this->story($this->day(25, '09:00'), [
            [0, fn ($c) => $this->newRequest($c, 'it', $r0, 'Software', 'Instalasi aplikasi desain grafis di PC staf pemasaran.', 'medium')],
            [5, fn ($c) => $this->submit($c)],
            [240, fn ($c) => $this->requests->approve($c->sr, $c->superior)],
            [1700, fn ($c) => $this->requests->reject($c->sr, $lead, 'Lisensi tidak tersedia; gunakan aplikasi standar perusahaan.')],
        ]);
        // Revision requested, resubmitted, completed this month
        $this->story($this->day(20, '08:30'), [
            [0, fn ($c) => $this->newRequest($c, 'it', $r3, 'Hardware', 'Penggantian laptop kerja yang sudah berusia 6 tahun.', 'high', 12000000)],
            [5, fn ($c) => $this->submit($c)],
            [300, fn ($c) => $this->requests->requestRevision($c->sr, $c->superior, 'Lampirkan hasil pengecekan kondisi laptop dari IT.')],
            [1500, function ($c) {
                $this->requests->updateDraft($c->sr, $c->requester, ['purpose' => 'Penggantian laptop kerja yang sudah berusia 6 tahun. Hasil cek IT: baterai drop, engsel patah.']);
                $this->submit($c);
            }],
            [1800, fn ($c) => $this->requests->approve($c->sr, $c->superior)],
            [3000, fn ($c) => $this->requests->approve($c->sr, $upper, 'Gunakan stok laptop cadangan.', $t2->id)],
            [$this->thisMonth(1, '15:00'), fn ($c) => $this->requests->complete($c->sr, $t2, 'Laptop pengganti sudah diserahkan dan data dipindahkan.')],
        ]);
        // Cancelled while waiting for the superior
        $this->story($this->day(16, '10:00'), [
            [0, fn ($c) => $this->newRequest($c, 'it', $r1, 'Akses', 'Akses VPN untuk bekerja dari rumah.', 'medium')],
            [5, fn ($c) => $this->submit($c)],
            [200, fn ($c) => $this->requests->cancel($c->sr, $r1, 'Tidak jadi, kembali bekerja di kantor.')],
        ]);
        // Converted to a Work Order, which is then done
        $this->story($this->day(11, '09:30'), [
            [0, fn ($c) => $this->newRequest($c, 'it', $r2, 'Hardware', 'Perbaikan printer tinta di ruang HRD.', 'medium')],
            [5, fn ($c) => $this->submit($c)],
            [200, fn ($c) => $this->requests->approve($c->sr, $c->superior)],
            [600, function ($c) use ($lead) {
                $c->wo = $this->conversions->requestToWorkOrder($c->sr, $lead, 'Cukup ditangani lewat Work Order.');
                $c->labours = [];
                $this->counts['wo']++;
            }],
            [700, fn ($c) => $this->pick($c, $t1)],
            [900, fn ($c) => $this->complete($c, 'Head printer dibersihkan, cetak normal.')],
            [2000, fn ($c) => $this->accept($c, 0.0)],
        ]);
        // In progress (approved, executor assigned)
        $this->story($this->day(8, '10:00'), [
            [0, fn ($c) => $this->newRequest($c, 'it', $r0, 'Network', 'Penambahan access point di ruang training.', 'medium', 3500000)],
            [5, fn ($c) => $this->submit($c)],
            [180, fn ($c) => $this->requests->approve($c->sr, $c->superior)],
            [1440, fn ($c) => $this->requests->approve($c->sr, $lead, 'Menunggu barang datang.', $t1->id)],
        ]);
        // Waiting for the division / for the superior / still a draft
        $this->story($this->day(5, '13:00'), [
            [0, fn ($c) => $this->newRequest($c, 'it', $r3, 'Software', 'Pemasangan antivirus di 10 PC baru.', 'medium')],
            [5, fn ($c) => $this->submit($c)],
            [300, fn ($c) => $this->requests->approve($c->sr, $c->superior)],
        ]);
        $this->story($this->day(2, '10:00'), [
            [0, fn ($c) => $this->newRequest($c, 'it', $r1, 'Akses', 'Reset dan aktivasi ulang akun email direksi.', 'high')],
            [5, fn ($c) => $this->submit($c)],
        ]);
        $this->story($this->day(1, '16:00'), [
            [0, fn ($c) => $this->newRequest($c, 'it', $r2, 'Hardware', 'Permintaan headset untuk meeting online.', 'low', 350000)],
        ]);
        // Finished this month: completed and cancelled
        $this->story($this->thisMonth(3, '09:00'), [
            [0, fn ($c) => $this->newRequest($c, 'it', $r0, 'Hardware', 'Instalasi printer baru di ruang direksi.', 'medium')],
            [5, fn ($c) => $this->submit($c)],
            [120, fn ($c) => $this->requests->approve($c->sr, $c->superior)],
            [240, fn ($c) => $this->requests->approve($c->sr, $lead, null, $t0->id)],
            [600, fn ($c) => $this->requests->complete($c->sr, $t0, 'Printer terpasang dan terhubung ke jaringan.')],
        ]);
        $this->story($this->thisMonth(2, '11:00'), [
            [0, fn ($c) => $this->newRequest($c, 'it', $r3, 'Akses', 'Akses folder bersama proyek ekspansi.', 'low')],
            [5, fn ($c) => $this->submit($c)],
            [60, fn ($c) => $this->requests->cancel($c->sr, $r3, 'Sudah diberi akses oleh pemilik folder.')],
        ]);
    }

    private function maintenanceRequests(): void
    {
        ['lead' => $lead, 'upper' => $upper, 'techs' => [$m0, $m1, $m2]] = $this->cast->units['mtc'];
        [$r0, $r1, $r2, $r3] = $this->cast->requesters;

        $this->story($this->day(29, '09:00'), [
            [0, fn ($c) => $this->newRequest($c, 'mtc', $r0, 'Fabrikasi', 'Pembuatan rak besi untuk gudang arsip.', 'medium', 4000000, 'PBK')],
            [5, fn ($c) => $this->submit($c)],
            [240, fn ($c) => $this->requests->approve($c->sr, $c->superior)],
            [1500, fn ($c) => $this->requests->approve($c->sr, $lead, null, $m1->id)],
            [5000, fn ($c) => $this->requests->complete($c->sr, $m1, 'Rak besi 4 susun terpasang di gudang arsip.')],
        ]);
        $this->story($this->day(6, '08:00'), [
            [0, fn ($c) => $this->newRequest($c, 'mtc', $r1, 'Electrical', 'Penambahan stop kontak di ruang server.', 'high', null, 'PBK')],
            [5, fn ($c) => $this->submit($c)],
            [200, fn ($c) => $this->requests->approve($c->sr, $c->superior)],
            [900, fn ($c) => $this->requests->approve($c->sr, $upper, null, $m2->id)],
        ]);
        $this->story($this->day(1, '11:00'), [
            [0, fn ($c) => $this->newRequest($c, 'mtc', $r2, 'Fabrikasi', 'Pembuatan kanopi parkir motor karyawan.', 'low', 15000000, 'PBK')],
            [5, fn ($c) => $this->submit($c)],
        ]);
        // Waiting for the division (superior already approved)
        $this->story($this->day(2, '09:30'), [
            [0, fn ($c) => $this->newRequest($c, 'mtc', $r3, 'Mechanical', 'Perbaikan AC ruang meeting pabrik.', 'medium', null, 'PBK')],
            [5, fn ($c) => $this->submit($c)],
            [180, fn ($c) => $this->requests->approve($c->sr, $c->superior)],
        ]);
        // Rejected by the division lead
        $this->story($this->day(18, '10:00'), [
            [0, fn ($c) => $this->newRequest($c, 'mtc', $r0, 'Electrical', 'Pemasangan lampu sorot lapangan parkir.', 'low', 9000000, 'PBK')],
            [5, fn ($c) => $this->submit($c)],
            [240, fn ($c) => $this->requests->approve($c->sr, $c->superior)],
            [1500, fn ($c) => $this->requests->reject($c->sr, $lead, 'Masuk program CAPEX tahun depan, bukan pekerjaan maintenance.')],
        ]);
        // Cancelled by the requester while waiting
        $this->story($this->day(9, '14:00'), [
            [0, fn ($c) => $this->newRequest($c, 'mtc', $r1, 'Fabrikasi', 'Pembuatan meja kerja workshop tambahan.', 'low', 2500000, 'PBK')],
            [5, fn ($c) => $this->submit($c)],
            [600, fn ($c) => $this->requests->cancel($c->sr, $r1, 'Meja bekas dari gudang masih bisa dipakai.')],
        ]);
        // Converted to a Work Order by the lead, finished as a WO
        $this->story($this->day(13, '08:30'), [
            [0, fn ($c) => $this->newRequest($c, 'mtc', $r2, 'Mechanical', 'Perbaikan engsel pintu gudang bahan baku.', 'medium', null, 'PBK')],
            [5, fn ($c) => $this->submit($c)],
            [200, fn ($c) => $this->requests->approve($c->sr, $c->superior)],
            [500, function ($c) use ($lead) {
                $c->wo = $this->conversions->requestToWorkOrder($c->sr, $lead, 'Pekerjaan kecil, cukup lewat Work Order.');
                $c->labours = [];
                $this->counts['wo']++;
            }],
            [600, fn ($c) => $this->pick($c, $m0)],
            [800, fn ($c) => $this->complete($c, 'Engsel diganti dan pintu disetel ulang.')],
            [2200, fn ($c) => $this->accept($c, 0.0)],
        ]);
    }

    // ── Preventive maintenance ────────────────────────────────────────────────

    private function preventiveMaintenance(): void
    {
        $it = $this->cast->units['it'];
        $mtc = $this->cast->units['mtc'];
        [$t0, $t1, $t2] = $it['techs'];
        [$m0, $m1, $m2] = $mtc['techs'];

        $this->at($this->day(self::DAYS_BACK - 1, '08:00'), function () use ($it, $mtc) {
            $this->template('srv', $it, 'Pengecekan Harian Ruang Server', [
                ['Suhu ruang server', 'number', '°C', 18, 27],
                ['Indikator UPS normal (tidak ada alarm)', 'ok_nok_na'],
                ['Lampu status perangkat normal', 'ok_nok_na'],
                ['Catatan kondisi', 'text', null, null, null, false],
            ]);
            $this->template('prn', $it, 'PM Bulanan Printer', [
                ['Bersihkan roller pickup dan feeder', 'ok_nok_na'],
                ['Cek sisa toner dan drum', 'ok_nok_na'],
                ['Cetak halaman uji', 'ok_nok_na'],
            ]);
            $this->template('ac', $it, 'PM AC Presisi', [
                ['Bersihkan filter udara', 'ok_nok_na'],
                ['Suhu udara keluar', 'number', '°C', 14, 20],
                ['Cek kebocoran air kondensasi', 'ok_nok_na'],
            ]);
            $this->template('gen', $mtc, 'PM Mingguan Genset', [
                ['Level oli mesin', 'ok_nok_na'],
                ['Tegangan baterai starter', 'number', 'V', 12.2, 14.5],
                ['Uji start tanpa beban 10 menit', 'ok_nok_na'],
                ['Kebocoran oli / bahan bakar', 'ok_nok_na'],
            ]);
            $this->template('pmp', $mtc, 'PM Bulanan Pompa', [
                ['Tekanan output', 'number', 'bar', 2, 6],
                ['Getaran dan suara bearing', 'ok_nok_na'],
                ['Kebocoran seal', 'ok_nok_na'],
            ]);
            $this->template('kmp', $mtc, 'Pengecekan Kompresor per Shift', [
                ['Tekanan tangki', 'number', 'bar', 6, 8],
                ['Drain air kondensasi', 'ok_nok_na'],
            ]);
            $this->template('tmb', $mtc, 'Kalibrasi Tahunan Timbangan', [
                ['Uji beban standar 10 ton', 'number', 'kg', 9990, 10010],
                ['Sertifikat kalibrasi diperbarui', 'ok_nok_na'],
            ]);
        });

        $tomorrow = $this->realNow->startOfDay()->addDay();
        $schedule = fn (string $key, array $unit, string $name, array $equipment, User $pic, string $type, int $interval, CarbonImmutable $start, int $tolerance, int $minutes)
            => $this->at($start->subDay()->min($this->realNow)->max($this->day(self::DAYS_BACK - 1, '08:30')), function () use ($key, $unit, $name, $equipment, $pic, $type, $interval, $start, $tolerance, $minutes) {
                $created = $this->schedules->create($unit['lead'], [
                    'name' => $name,
                    'executor_unit_id' => $unit['unit']->id,
                    'checklist_template_id' => ChecklistTemplate::query()->where('name', $this->templateName($key))->value('id'),
                    'equipment_ids' => Equipment::query()->whereIn('code', $equipment)->pluck('id')->all(),
                    'pic_user_id' => $pic->id,
                    'frequency_type' => $type,
                    'frequency_interval' => $interval,
                    'start_at' => $start->toIso8601String(),
                    'tolerance_hours' => $tolerance,
                    'estimated_minutes' => $minutes,
                ]);
                $this->scheduleKeys[$created->id] = $key;
            });

        $schedule('srv', $it, 'Pengecekan Harian Server & Jaringan', [self::MARKER_EQUIPMENT, 'SRV-FILE-01', 'SW-CORE-01'], $t0, 'daily', 1, $this->day(35, '08:00'), 4, 20);
        $schedule('prn', $it, 'PM Bulanan Printer', ['PRN-HO-01'], $t1, 'monthly', 1, $tomorrow->subMonths(2)->setTime(9, 0), 72, 45);
        $schedule('ac', $it, 'PM AC Presisi 2 Mingguan', ['AC-SRV-01'], $t2, 'every_n_days', 14, $this->day(30, '10:00'), 48, 60);
        $schedule('gen', $mtc, 'PM Mingguan Genset', ['GEN-01'], $m0, 'weekly', 1, $tomorrow->subWeeks(5)->setTime(8, 0), 24, 45);
        $schedule('pmp', $mtc, 'PM Bulanan Pompa', ['PMP-01', 'PMP-02'], $m1, 'monthly', 1, $this->day(37, '09:00'), 48, 60);
        $schedule('kmp', $mtc, 'Pengecekan Kompresor per Shift', ['KMP-01'], $m2, 'hourly', 12, $this->realNow->subHours(30)->startOfHour(), 4, 10);
        $schedule('tmb', $mtc, 'Kalibrasi Tahunan Timbangan', ['TMB-01'], $m1, 'yearly', 1, $this->realNow->startOfDay()->addDays(20)->setTime(9, 0), 168, 240);
    }

    /** @var array<string, string> */
    private array $templateNames = [];

    private function templateName(string $key): string
    {
        return $this->templateNames[$key];
    }

    private function template(string $key, array $unit, string $name, array $items): void
    {
        $this->templateNames[$key] = $name;
        $this->templates->create([
            'executor_unit_id' => $unit['unit']->id,
            'name' => $name,
            'items' => array_map(fn (array $i) => [
                'description' => $i[0],
                'input_type' => $i[1],
                'unit' => $i[2] ?? null,
                'min_value' => $i[3] ?? null,
                'max_value' => $i[4] ?? null,
                'is_required' => $i[5] ?? true,
                'photo_required' => false,
            ], $items),
        ]);
    }

    /** What happens to a task once it is due (decided when it becomes JATUH_TEMPO). */
    private function planPmTask(PmTask $task): void
    {
        $this->plannedTasks[$task->id] = true;
        $key = $this->scheduleKeys[$task->pm_schedule_id] ?? null;
        if (! $key) {
            return;
        }

        $due = CarbonImmutable::instance($task->due_at);
        $overdue = CarbonImmutable::instance($task->overdue_at);
        $pic = User::query()->findOrFail($task->pic_user_id);
        $flavour = in_array($key, ['srv', 'prn', 'ac'], true) ? 'it' : 'mtc';
        $lead = $this->cast->units[$flavour]['lead'];
        $daysAgo = (int) $due->startOfDay()->diffInDays($this->realNow->startOfDay(), false);
        $code = Equipment::query()->whereKey($task->equipment_id)->value('code');

        $outcome = match (true) {
            $key === 'srv' && $daysAgo === 20 && $code === self::MARKER_EQUIPMENT => 'finding_wo',
            $key === 'gen' && $daysAgo >= 12 && $daysAgo <= 14 => 'finding_wo',
            $key === 'gen' && $daysAgo >= 5 && $daysAgo <= 7 => 'late',
            $key === 'ac' && $daysAgo >= 1 && $daysAgo <= 3 => 'in_progress',
            $key === 'ac' && $daysAgo >= 15 && $daysAgo <= 17 => 'late',
            $key === 'prn' && $daysAgo >= 25 && $daysAgo <= 35 => 'propose_then_skip',
            // MTC: the compressor check of the last shift is being worked on right now
            $key === 'kmp' && $due->between($this->realNow->subHours(12), $this->realNow) => 'in_progress',
            $key === 'pmp' && $daysAgo >= 3 && $daysAgo <= 10 && $code === 'PMP-02' => 'propose',
            $key === 'pmp' && $daysAgo >= 3 && $daysAgo <= 10 => 'finding',
            default => $this->usualOutcome($task),
        };

        $finding = [
            'srv' => ['Indikator UPS', ['result' => 'not_ok', 'notes' => 'Alarm baterai lemah, runtime turun ke 6 menit.']],
            'gen' => ['Tegangan baterai', ['value_number' => 11.4, 'notes' => 'Aki starter melemah.']],
            'pmp' => ['Tekanan output', ['value_number' => 1.6, 'notes' => 'Tekanan rendah, impeller perlu dicek.']],
        ][$key] ?? null;

        $work = fn (CarbonImmutable $startAt, CarbonImmutable $doneAt, ?array $override = null) => [
            $this->at($startAt, fn () => $this->pmTasks->start($task, $pic)),
            $this->at($doneAt, fn () => $this->pmTasks->complete($task, $pic, ['items' => $this->answers($task, $override), 'duration_minutes' => max(5, $startAt->diffInMinutes($doneAt))])),
        ];

        match ($outcome) {
            'on_time' => $work($due->addMinutes(20), $due->addMinutes(50)),
            'late' => $work($overdue->addMinutes(30), $overdue->addMinutes(75)),
            'finding' => $work($due->addMinutes(20), $due->addMinutes(55), $finding),
            'finding_wo' => [
                $work($due->addMinutes(20), $due->addMinutes(55), $finding),
                $this->at($due->addMinutes(65), fn () => $this->workOrderFromFinding($task, $pic, $flavour, $key === 'srv')),
            ],
            'in_progress' => [
                $this->at($due->addMinutes(60), fn () => $this->pmTasks->start($task, $pic)),
                $this->at($due->addMinutes(80), fn () => $this->pmTasks->saveItems($task, array_slice($this->answers($task), 0, 1))),
            ],
            'propose_then_skip' => [
                $this->at($due->addHour(), fn () => $this->pmTasks->proposeSkip($task, $pic, 'Printer sedang diperbaiki vendor.')),
                $this->at($due->addHours(4), fn () => $this->pmTasks->skip($task, $lead, 'Disetujui, printer di vendor sampai minggu depan.')),
            ],
            'propose' => $this->at($overdue->addHours(3), fn () => $this->pmTasks->proposeSkip($task, $pic, 'Pompa hydrant sedang diganti panel kontrolnya.')),
            'skip' => $this->at($due->addHours(2), fn () => $this->pmTasks->skip($task, $lead, 'Area ditutup sementara untuk renovasi.')),
            default => null, // 'ignore': left alone → TERLAMBAT, later skipped automatically
        };
    }

    /** Most tasks are done on time; a few late, forgotten (auto-skipped) or skipped by the lead. */
    private function usualOutcome(PmTask $task): string
    {
        $roll = crc32('pm-'.$task->id) % 100;

        return match (true) {
            $roll < 80 => 'on_time',
            $roll < 89 => 'late',
            $roll < 96 => 'ignore',
            default => 'skip',
        };
    }

    /** Checklist answers: OK / mid-range values, with an optional finding on one item. */
    private function answers(PmTask $task, ?array $finding = null): array
    {
        return PmTaskItem::query()->where('pm_task_id', $task->id)->orderBy('sort_order')->orderBy('id')->get()
            ->map(function (PmTaskItem $item) use ($finding) {
                if ($finding && str_contains($item->description, $finding[0])) {
                    return ['id' => $item->id] + $finding[1];
                }

                return match ($item->input_type->value ?? $item->input_type) {
                    'number' => ['id' => $item->id, 'value_number' => round(((float) $item->min_value + (float) $item->max_value) / 2 + (($item->id % 5) - 2) * 0.1, 1)],
                    'text' => ['id' => $item->id, 'value_text' => 'Kondisi normal.'],
                    default => ['id' => $item->id, 'result' => 'ok'],
                };
            })->all();
    }

    private function workOrderFromFinding(PmTask $task, User $pic, string $flavour, bool $followUp): void
    {
        $item = PmTaskItem::query()->where('pm_task_id', $task->id)->where('result', 'not_ok')->firstOrFail();
        $category = $flavour === 'it' ? 'Hardware' : 'Electrical';
        $wo = $this->pmTasks->createWorkOrderFromFinding($task, $item, $pic, [
            'service_category_id' => $this->cast->category($flavour, $category)->id,
            'priority' => 'high',
        ]);
        $this->counts['wo']++;

        if ($followUp) {
            $c = new stdClass();
            $c->wo = $wo;
            $c->requester = $pic;
            $c->labours = [];
            $other = $this->cast->units[$flavour]['techs'][1];
            $this->story(CarbonImmutable::now(), [
                [30, fn () => $this->pick($c, $other)],
                [180, fn () => $this->complete($c, 'Baterai UPS diganti, alarm hilang.', ['MAT-BAT12' => 4])],
                [1440, fn () => $this->accept($c, 0.0)],
            ]);
        }
    }

    // ── Summary ───────────────────────────────────────────────────────────────

    private function report(): void
    {
        $count = fn (string $model, string $column = 'status') => $model::query()->selectRaw("{$column} as s, count(*) as n")->groupBy($column)
            ->pluck('n', 's')->map(fn ($n, $s) => "{$s} {$n}")->implode(', ');

        $units = collect($this->cast->units)->map(fn ($u) => $u['unit']->display_name.' (pimpinan '.$u['lead']->name.', atasan '.$u['upper']->name.')')->implode('; ');
        $this->command?->info('Data demo dibuat'.($this->cast->createdDemoOrganisation ? ' dengan organisasi demo' : ' dengan organisasi dari Portal').'.');
        $this->command?->line('  Unit pelaksana : '.$units);
        $this->command?->line('  Pemohon        : '.collect($this->cast->requesters)->pluck('name')->implode(', '));
        $this->command?->line('  Work Order     : '.$count(WorkOrder::class));
        $this->command?->line('  Form Request   : '.$count(ServiceRequest::class));
        $this->command?->line('  Tugas PM       : '.$count(PmTask::class));
        foreach ($this->cast->units as $cast) {
            $unitId = $cast['unit']->id;
            $per = fn (string $model) => $model::query()->where('executor_unit_id', $unitId)->selectRaw('status as s, count(*) as n')->groupBy('status')
                ->pluck('n', 's')->map(fn ($n, $s) => "{$s} {$n}")->implode(', ');
            $this->command?->line('  '.$cast['unit']->display_name.' - WO: '.$per(WorkOrder::class).' | FR: '.$per(ServiceRequest::class).' | PM: '.$per(PmTask::class));
        }
        $this->command?->line('  Jadwal PM      : '.PmSchedule::query()->count().', equipment '.Equipment::query()->count());
    }
}
