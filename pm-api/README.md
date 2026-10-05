# pm-api — Backend PM-App PT INL

API REST (JSON, prefix `/api/v1`) untuk Work Order, Form Request, dan Preventive Maintenance.
Kontrak API: [`../docs/API_WORK_ORDER.md`](../docs/API_WORK_ORDER.md) (Modul A) dan
[`../docs/API_SERVICE_REQUEST.md`](../docs/API_SERVICE_REQUEST.md) (Modul B). Integrasi SSO: [`../docs/SSO.md`](../docs/SSO.md).

## Stack

- Laravel 8.83 (PHP 8.2), PostgreSQL, Sanctum 2 (cookie SPA untuk web, token permanen per perangkat untuk mobile)
- spatie/laravel-permission (role global `admin`, `management`)
- maatwebsite/excel (export), dompdf 3 + endroid/qr-code (PDF formulir + QR tanda tangan)

## Setup lokal

```bash
composer install
cp .env.example .env          # isi DB_*, PORTAL_*, PM_WEB_URL
php artisan key:generate
php artisan migrate --seed    # tabel + role admin/management
php artisan serve             # http://127.0.0.1:8000
```

Data organisasi & karyawan berasal dari Portal INTES:

```bash
php artisan portal:sync                                   # unit organisasi + karyawan (juga terjadwal 02:00)
php artisan pm:executor-unit IT --display="Sistem dan IT" \
    --category=Software --category=Hardware --category=Network \
    --rules="1. Bahwa dengan pengesahan diatas, ...|2. Password akan ..." \
    --footer="Untuk informasi, silakan menghubungi IT HP : 081260666418 Ext. 144"
# seksi pelaksana + kategori + "Petunjuk dan Aturan" Form Request (baris dipisah |; bisa diubah pimpinan lewat API)
```

Lokasi, equipment, dan material sementara diisi lewat seeder/SQL (UI master data & import Excel menyusul).
Memberi role admin: `php artisan tinker` → `App\Models\User::where('nrk','...')->first()->assignRole('admin')`.

## Scheduler & queue

```bash
php artisan schedule:work     # lokal; di server pakai cron `* * * * * php artisan schedule:run`
php artisan queue:work        # bila QUEUE_CONNECTION=database/redis (disarankan di produksi)
```

| Command | Jadwal | Fungsi |
|---|---|---|
| `wo:auto-accept` | tiap jam | WO `completed` tanpa respons user > 3 hari kerja → `closed` otomatis |
| `approvals:remind` | tiap jam | langkah approval yang menunggu > 24 jam → notifikasi alarm ke approver (diulang tiap 24 jam) |
| `portal:sync` | 02:00 | sinkron unit organisasi & karyawan; user yang hilang dari Portal dinonaktifkan |

## Aturan bisnis penting

- **Peran pelaksana** diturunkan otomatis: staf = user di unit Portal seksi pelaksana (atau turunannya) + anggota
  tambahan (`executor_unit_members`); pimpinan = grade `PM_LEAD_GRADE_CODES` (default BOM, BOM-1, BOM-2, BOM-3), teknisi = BOM-4.
- **Nomor WO**: `WO/{kode seksi}/{bulan romawi}/{tahun}/{0001}`, urut per seksi per tahun.
- **Status WO**: lihat `../docs/STATE_MACHINES.md`. Siapa yang boleh → `WorkOrderPolicy` (403); kapan boleh → `WorkOrderService` (409).
- **Form Request**: rantai Atasan YBS → Mgr/Spv Divisi → Foreman Divisi dijalankan mesin approval generik
  (`App\Services\Approvals\ApprovalEngine`, tabel `approval_steps`). Atasan default = pilihan terakhir pemohon,
  lalu `atasan_id` Portal; pilihan lain harus grade lebih tinggi. Minta revisi → draft, putaran approval baru.
  Nomor `REQ{0001}/{kode seksi}/{romawi}/{tahun}` terbit saat submit pertama.
- Semua perubahan status tercatat di `status_logs`; setiap pengesahan membuat `document_signatures` (QR → `/verifikasi/{token}`).

## Test

Memakai database PostgreSQL terpisah `pm_test` (lihat `phpunit.xml`), Portal & Expo di-fake.

```bash
php artisan test
```

Cakupan: SSO web, login mobile (email/NRK, TOTP, rate limit, logout per perangkat, user nonaktif), sinkronisasi Portal,
alur WO lengkap (assign & pick, acceptance Yes/No + rework), otorisasi, transisi tidak valid (409), list/filter/scope,
export Excel, PDF, lampiran, auto-accept hari kerja, penomoran, verifikasi QR, notifikasi & push Expo;
Form Request (alur sukses, ditolak atasan, ditolak divisi, revisi, ganti atasan, self-approval, visibilitas, pengingat,
konversi WO ↔ Request, list/export, PDF).
