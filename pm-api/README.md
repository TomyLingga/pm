# pm-api — Backend PrevenTech

API REST (JSON, prefix `/api/v1`) untuk Work Order, Form Request, dan Preventive Maintenance.
Kontrak API: [`../docs/API_WORK_ORDER.md`](../docs/API_WORK_ORDER.md) (Modul A),
[`../docs/API_SERVICE_REQUEST.md`](../docs/API_SERVICE_REQUEST.md) (Modul B), [`../docs/API_PM.md`](../docs/API_PM.md) (Modul C)
dan [`../docs/API_DASHBOARD.md`](../docs/API_DASHBOARD.md) (dashboard, preferensi notifikasi).
Integrasi SSO: [`../docs/SSO.md`](../docs/SSO.md).

## Stack

- Laravel 8.83 (PHP 8.2), PostgreSQL, Sanctum 2 (cookie SPA untuk web, token permanen per perangkat untuk mobile)
- spatie/laravel-permission (role global `admin` saja; user lain = user biasa yang hanya melihat unitnya dan dokumennya sendiri; admin mengatur lewat `GET /users` + `PUT /users/{id}/access`)
- maatwebsite/excel (export), dompdf 3 + endroid/qr-code (PDF formulir + QR tanda tangan)

## Setup lokal

```bash
composer install
cp .env.example .env          # isi DB_*, PORTAL_*, PM_WEB_URL
php artisan key:generate
php artisan migrate --seed    # tabel + role admin
php artisan serve             # http://127.0.0.1:8000
```

Data organisasi & karyawan berasal dari Portal INTES:

```bash
php artisan portal:sync                                   # unit organisasi + karyawan (juga terjadwal 02:00)
php artisan pm:executor-unit SEK-IT --code=IT \
    --category=Software --category=Hardware --category=Network \
    --rules="1. Bahwa dengan pengesahan diatas, ...|2. Password akan ..." \
    --footer="Untuk informasi, silakan menghubungi IT HP : 081260666418 Ext. 144"
# seksi pelaksana + kategori + "Petunjuk dan Aturan" Form Request (baris dipisah |; bisa diubah pimpinan lewat API)
php artisan db:seed --class=DemoSeeder                    # data demo semua kasus & status (dev/staging)
```

Unit pelaksana harus **seksi**. Selain lewat perintah di atas, setiap anggota seksi bisa menambah kategori layanan
seksinya dari web (Pengaturan > Kategori Layanan); unit pelaksana seksi itu dibuat otomatis saat kategori pertama ditambah.

`DemoSeeder` memutar ulang ±6 minggu aktivitas lewat service asli (jam dimundurkan): WO di semua status termasuk
rework, auto-accept, batal, dialihkan, dan dari temuan PM; Form Request di semua status termasuk ditolak atasan/divisi,
revisi, dan konversi; tugas PM terjadwal, jatuh tempo, terlambat, dikerjakan, selesai tepat waktu/terlambat, dan
dilewati (otomatis, oleh pimpinan, dan usulan teknisi). Memakai seksi IT & Maintenance dan karyawan hasil `portal:sync`;
pada DB kosong dibuat organisasi demo. Tidak mengirim notifikasi. Untuk mengulang: `migrate:fresh --seed`,
`portal:sync`, lalu jalankan lagi.

Equipment dikelola pimpinan unit lewat API/web (`/equipment`), lokasi bisa ditambah cepat dari form equipment.
Material masih diisi lewat seeder/SQL (UI master data lengkap & import Excel menyusul).
Admin pertama: `php artisan tinker` → `App\Models\User::where('nrk','...')->first()->assignRole('admin')`; admin berikutnya diatur lewat menu Pengaturan > Hak Akses di web.

## Deploy produksi

Lihat [`../docs/DEPLOY.md`](../docs/DEPLOY.md) (`docker-compose.prod.yml`: nginx, php-fpm, worker, scheduler, PostgreSQL 17, Redis, backup harian).

## Scheduler & queue

```bash
php artisan schedule:work     # lokal; di server pakai cron `* * * * * php artisan schedule:run`
php artisan queue:work        # bila QUEUE_CONNECTION=database/redis (disarankan di produksi)
```

| Command | Jadwal | Fungsi |
|---|---|---|
| `wo:auto-accept` | tiap jam | WO `completed` tanpa respons user > 3 hari kerja → `closed` otomatis |
| `approvals:remind` | tiap jam | langkah approval yang menunggu > 24 jam → notifikasi alarm ke approver (diulang tiap 24 jam) |
| `pm:generate-tasks` | 00:05 | membuat tugas PM dari jadwal aktif sampai horizon (60 hari; 7 hari untuk jadwal per jam). Idempotent: aman dijalankan ulang |
| `pm:check-overdue` | tiap 15 menit | tugas PM → JATUH_TEMPO / TERLAMBAT, auto-skip, pengingat alarm H-2 · H-0 · overdue (diulang tiap 48 jam) |
| `portal:sync` | 02:00 | sinkron unit organisasi & karyawan; user yang hilang dari Portal dinonaktifkan |

## Aturan bisnis penting

- **Peran pelaksana** diturunkan otomatis. Unit pelaksana = seksi. Staf = user di seksi itu (atau turunannya)
  + user bergrade pimpinan di sub bagian dan bagian di atas seksi (Kasubag/Kabag) + anggota tambahan
  (`executor_unit_members`); pimpinan = staf bergrade `PM_LEAD_GRADE_CODES` (default BOM, BOM-1, BOM-2, BOM-3), teknisi = BOM-4.
- **List & export**: `from`/`to` hanya menyaring dokumen yang sudah berakhir (WO closed/batal/dialihkan, Request
  selesai/ditolak/batal/dialihkan, PM selesai/dilewati) menurut tanggal berakhirnya; dokumen berjalan selalu ikut
  (`App\Support\EndedPeriodFilter`).
- **Nomor WO**: `WO/{kode seksi}/{bulan romawi}/{tahun}/{0001}`, urut per seksi per tahun.
- **Status WO**: lihat `../docs/STATE_MACHINES.md`. Siapa yang boleh → `WorkOrderPolicy` (403); kapan boleh → `WorkOrderService` (409).
- **Form Request**: rantai Atasan YBS → Mgr/Spv Divisi → Foreman Divisi dijalankan mesin approval generik
  (`App\Services\Approvals\ApprovalEngine`, tabel `approval_steps`). Atasan default = pilihan terakhir pemohon,
  lalu `atasan_id` Portal; pilihan lain harus grade lebih tinggi. Minta revisi → draft, putaran approval baru.
  Nomor `REQ{0001}/{kode seksi}/{romawi}/{tahun}` terbit saat submit pertama.
- **Preventive Maintenance**: jadwal (per N jam / harian / mingguan / bulanan / tahunan / setiap N hari) menghasilkan
  satu tugas per equipment per kejadian. Perhitungan tanggal ada di `App\Services\Pm\RecurrenceCalculator` (murni,
  ber-unit-test): kejadian selalu dihitung dari tanggal mulai, jadi jadwal tanggal 31 tidak bergeser setelah Februari.
  Tugas masuk JATUH_TEMPO pada H-2 (`PM_DUE_WINDOW_HOURS`, bisa per jadwal; untuk jadwal per jam/harian tepat pada
  waktunya), TERLAMBAT setelah toleransi, dan dilewati
  otomatis saat kejadian berikutnya jatuh tempo. Butir checklist disalin dari template saat tugas dimulai.
  Hanya pimpinan yang boleh melewati tugas; teknisi mengusulkan. Temuan "Tidak OK" bisa langsung dijadikan WO.
- Semua perubahan status tercatat di `status_logs`; setiap pengesahan membuat `document_signatures` (QR → `/verifikasi/{token}`).
- **Notifikasi**: in-app (tabel `notifications`) + push Expo selalu; **email** opsional (`PM_MAIL_NOTIFICATIONS=true` + SMTP
  `MAIL_*`), dihormati preferensi per user (`users.email_notifications`). Semua dikirim lewat queue.
- **Dashboard** (`App\Services\Dashboard\DashboardService`): hanya query agregat (GROUP BY, `percentile_cont` untuk median),
  scope mengikuti peran (teknisi → `mine`, pimpinan → `unit`, admin → `all`), hasil di-cache
  `PM_DASHBOARD_CACHE_SECONDS` (default 300) per user/scope/filter.

## Test

Memakai database PostgreSQL terpisah `pm_test` (lihat `phpunit.xml`), Portal & Expo di-fake.

```bash
php artisan test
```

Cakupan: SSO web, login mobile (email/NRK, TOTP, rate limit, logout per perangkat, user nonaktif), sinkronisasi Portal,
alur WO lengkap (assign & pick, acceptance Yes/No + rework), otorisasi, transisi tidak valid (409), list/filter/scope,
export Excel, PDF, lampiran, auto-accept hari kerja, penomoran, verifikasi QR, notifikasi & push Expo;
Form Request (alur sukses, ditolak atasan, ditolak divisi, revisi, ganti atasan, self-approval, visibilitas, pengingat,
konversi WO ↔ Request, list/export, PDF);
Preventive Maintenance — unit test perhitungan jatuh tempo semua jenis frekuensi (`tests/Unit/Pm`), CRUD template &
jadwal, generator idempotent, status & pengingat berbasis waktu, pengerjaan checklist + foto, WO dari temuan,
skip/reassign, kalender + proyeksi, riwayat per equipment, export.
Dashboard per peran (KPI, tren, SLA, kepatuhan PM, equipment, beban kerja, cache) dan kanal email + preferensi.
