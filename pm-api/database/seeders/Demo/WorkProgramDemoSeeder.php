<?php

namespace Database\Seeders\Demo;

use App\Models\DailyActivity;
use App\Models\ExecutorUnit;
use App\Models\OrgUnit;
use App\Models\User;
use App\Models\WorkProgram;
use App\Services\Activities\DailyActivityService;
use App\Services\Org\ExecutorDirectory;
use App\Services\Programs\WorkProgramService;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Notification;

/**
 * Program Kerja Tahunan + Aktivitas Harian demo data for the IT and Maintenance units
 * (called by DemoSeeder; safe to run alone after the units exist).
 */
class WorkProgramDemoSeeder extends Seeder
{
    public function __construct(
        private WorkProgramService $programs,
        private DailyActivityService $activities,
        private ExecutorDirectory $directory,
    ) {
    }

    public function run(): void
    {
        if (WorkProgram::query()->exists()) {
            $this->command?->warn('Program kerja demo sudah ada, dilewati.');

            return;
        }
        Notification::fake();
        $year = (int) now()->year;
        $created = 0;

        foreach ($this->casts() as $cast) {
            [$owner, $unit, $lead, $techs, $title, $items] = $cast;
            $program = $this->programs->create($owner, [
                'year' => $year, 'code' => 'A', 'title' => $title, 'org_unit_id' => $unit->id,
                'description' => "Program kerja {$unit->name} tahun {$year}.",
            ]);
            $created++;
            foreach ($items as $i => [$itemTitle, $itemDesc, $activities]) {
                $item = $this->programs->addItem($program, $owner, ['code' => 'A.'.($i + 1), 'title' => $itemTitle, 'description' => $itemDesc]);
                foreach ($activities as $j => [$actTitle, $plan, $target, $status, $progress, $remarks]) {
                    $pics = [['user_id' => $lead->id, 'role' => 'utama']];
                    foreach (array_slice($techs, $j % 2, 2) as $tech) {
                        $pics[] = ['user_id' => $tech->id, 'role' => 'pendukung'];
                    }
                    $activity = $this->programs->addActivity($item, $owner, [
                        'title' => $actTitle, 'action_plan' => $plan, 'target_date' => "{$year}-{$target}",
                        'remarks' => $remarks, 'pics' => $pics,
                    ]);
                    if ($status === 'on_progress') {
                        $this->programs->updateActivity($activity, $lead, ['progress_pct' => $progress, 'remarks' => $remarks], false);
                    } elseif ($status !== 'open') {
                        $this->programs->setActivityStatus($activity, $lead, $status, $status === 'closed' ? 'Selesai sesuai rencana.' : 'Dibatalkan, digabung ke kegiatan lain.');
                    }
                    $this->dailyReports($activity, $lead, $techs, $j);
                }
            }
        }

        $this->command?->info("Program kerja demo: {$created} program, ".DailyActivity::query()->count().' aktivitas harian.');
    }

    /** @return array<int, array{0: User, 1: OrgUnit, 2: User, 3: User[], 4: string, 5: array}> */
    private function casts(): array
    {
        $out = [];
        foreach ([['IT', 'ENABLING DIGITAL AND RELIABLE OPERATION', $this->itItems()], ['MTC', 'RELIABLE AND EFFICIENT PLANT MAINTENANCE', $this->mtcItems()]] as [$code, $title, $items]) {
            $unit = ExecutorUnit::query()->where('code', $code)->with('orgUnit')->first();
            if (! $unit) {
                continue;
            }
            $staff = $this->directory->staffQuery($unit)->orderByDesc('grade_level')->orderBy('id')->get();
            $seksiIds = OrgUnit::selfAndDescendantIds($unit->org_unit_id);
            $lead = $staff->first(fn (User $u) => in_array($u->org_unit_id, $seksiIds, true) && $this->directory->hasLeadGrade($u));
            $techs = $staff->filter(fn (User $u) => in_array($u->org_unit_id, $seksiIds, true) && ! $this->directory->hasLeadGrade($u))->values()->all();
            // The programme belongs to the sub bagian above the seksi (owned by its Kasubag) when there is one.
            $owner = $staff->sortBy('grade_level')->first(fn (User $u) => ! in_array($u->org_unit_id, $seksiIds, true) && $this->directory->hasLeadGrade($u));
            $ownerUnit = $owner ? OrgUnit::query()->find($owner->org_unit_id) : $unit->orgUnit;
            if (! $lead || count($techs) < 2) {
                continue;
            }
            $out[] = [$owner ?? $lead, $ownerUnit, $lead, $techs, $title, $items];
        }

        return $out;
    }

    private function dailyReports($activity, User $lead, array $techs, int $j): void
    {
        $today = CarbonImmutable::now()->startOfDay();
        $span = max(0, $today->day - 1); // days of the current month before today
        $n = count($techs);
        // One report last month, then a closed / on-progress / open mix inside the current month
        // so the default view (this month) shows every status.
        $reports = [
            [16 + $j, $techs[$j % $n], 'closed', 'Pengumpulan data awal', 'Data kebutuhan dari user terkumpul, dibahas dengan pimpinan.', 'Lanjut desain', null],
            [min($span, 5 + $j % 3), $techs[($j + 1) % $n], 'closed', 'Koordinasi dengan user', 'Pembahasan kebutuhan dan pembagian tugas dengan user terkait.', 'Mulai pengerjaan', null],
            [min($span, 2 + $j % 2), $techs[($j + 2) % $n], 'on_progress', 'Pengerjaan tahap lanjutan', 'Mengerjakan rencana kerja sesuai action plan; progres sesuai jadwal.', 'Lanjut minggu depan', 'Menunggu konfirmasi vendor'],
            [min($span, $j % 2), $techs[$j % $n], 'open', 'Pengecekan hasil pekerjaan', 'Pengecekan bersama user, menunggu jadwal uji coba.', null, 'Jadwal user belum pasti'],
        ];
        foreach ($reports as $k => [$daysAgo, $tech, $status, $title, $desc, $followUp, $obstacle]) {
            if ($k > 0 && $activity->status->value === 'closed') {
                break; // closed activities only have the first report
            }
            $date = $today->subDays($daysAgo);
            $report = $this->activities->create($lead, [
                'user_id' => $tech->id, 'activity_date' => $date->toDateString(),
                'title' => $activity->title.': '.$title, 'description' => $desc,
                'follow_up' => $followUp, 'obstacles' => $obstacle,
                'work_program_activity_id' => $activity->id,
                'status' => $status === 'closed' ? 'open' : $status,
            ]);
            $report->forceFill(['created_at' => $date->setTime(8 + $k, 15), 'updated_at' => $date->setTime(8 + $k, 15)])->saveQuietly();
            if ($status === 'closed') {
                $this->activities->setStatus($report, $tech, 'closed', 'Selesai, dilaporkan ke pimpinan.');
            }
        }
    }

    private function itItems(): array
    {
        return [
            ['IT Development', 'Pengembangan aplikasi SmartWB, SAP, e-SIH, dan integrasi sistem RFID & AI CCTV', [
                ['Integrasi SAP dengan SmartWB (Develop New)', "A. Pengumpulan data: TCode SAP, data yang dibutuhkan, data yang diupdate setelah timbang\nB. Desain database, ERD, flowchart & use case\nC. Pembuatan API SAP bersama PT SISI\nD. Pengembangan web registrasi, desktop timbangan, mobile lapangan\nE. Testing dan go live", '12-31', 'on_progress', 35, 'Pembahasan dengan Sisi, Marketing (SO), Tank Farm dan Sourcing: integrasi ke SAP (13 Agu).'],
                ['Final testing & Go Live SmartWB dengan RFID & AI CCTV', "1. Ceklis form sebelum testing\n2. Live test dengan Kabag SDM & Sistem\n3. Pengadaan 70 kartu RFID\n4. Aplikasi baru dan lama jalan paralel", '10-15', 'closed', 100, 'Go live 3 Oktober.'],
                ['Pengembangan Web IT Inventory (Bea Cukai)', "1. Pengadaan laptop developer\n2. API dari PT SISI\n3. Paparan dengan tim terkait\n4. Frontend Bea Cukai tanpa akses SAP\n5. Mounting ke server", '11-30', 'on_progress', 60, null],
                ['Portal e-SIH modul cuti & lembur', 'Analisis kebutuhan HRD, desain form, integrasi absensi.', '08-31', 'cancelled', 0, 'Digabung ke proyek talenta.'],
            ]],
            ['IT Network & Infrastructure', 'Jaringan kantor dan pabrik, server, dan keamanan', [
                ['Upgrade core switch dan segmentasi VLAN', 'Audit topologi, pengadaan switch, migrasi bertahap per lantai.', '09-30', 'closed', 100, 'Selesai tanpa downtime.'],
                ['Pemasangan access point area timbangan', 'Survey sinyal, pengadaan AP outdoor, instalasi dan uji coba.', '11-15', 'open', 0, null],
                ['Backup server terjadwal ke NAS', 'Konfigurasi job backup harian, uji restore bulanan.', '12-15', 'on_progress', 50, 'Uji restore pertama berhasil.'],
            ]],
            ['IT Administration, Tagihan & Pembayaran IT', 'Administrasi lisensi, langganan, dan pembayaran vendor IT', [
                ['Perpanjangan lisensi antivirus dan Office 365', 'Rekap jumlah user, pengajuan anggaran, PO ke vendor.', '10-31', 'on_progress', 80, 'Menunggu invoice vendor.'],
                ['Inventarisasi aset IT dan label QR', 'Pendataan seluruh laptop/PC, cetak label, input ke IT Inventory.', '12-31', 'open', 0, null],
            ]],
        ];
    }

    private function mtcItems(): array
    {
        return [
            ['Preventive Maintenance Mesin Utama', 'PM boiler, turbin, pompa utama, dan genset', [
                ['Overhaul tahunan genset 500 kVA', 'Pengadaan spare part, jadwal shutdown, pelaksanaan overhaul oleh vendor.', '11-30', 'on_progress', 45, 'Spare part tiba minggu ke-3 Oktober.'],
                ['Penggantian bearing pompa air bersih', 'Analisa getaran, pengadaan bearing, penggantian saat shutdown mingguan.', '09-15', 'closed', 100, null],
            ]],
            ['Perbaikan Infrastruktur Pabrik', 'Atap, jalan, drainase, dan pagar area pabrik', [
                ['Perbaikan atap workshop', 'Survey kebocoran, pengadaan material, pengerjaan oleh tim fabrikasi.', '10-31', 'open', 0, 'Menunggu persetujuan anggaran.'],
                ['Normalisasi drainase area timbangan', 'Pengerukan saluran dan pembuatan bak kontrol baru.', '12-15', 'on_progress', 20, null],
            ]],
        ];
    }
}
