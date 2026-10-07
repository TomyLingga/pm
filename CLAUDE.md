# PrevenTech (PM-App) PT Industri Nabati Lestari

Nama produk: **PrevenTech** (logo: `docs/playstore.png`, aset di `pm-web/public/logo.png` dan `pm-mobile/assets/`).

Aplikasi web + mobile untuk Work Order, Form Request (dengan approval), dan
Preventive Maintenance Scheduler bagi divisi support (Sistem & IT, Maintenance/MTC,
General Affair, dll). Spesifikasi lengkap: @docs/PRD.md

## Stack (WAJIB, jangan ganti tanpa bertanya)
- Backend: **Laravel 8.83** (keputusan user, sama dengan IDAS), PHP 8.2, PostgreSQL. Tanpa native enum cast,
  `barryvdh/laravel-dompdf` v3, dll — cek kompatibilitas Laravel 8 sebelum menambah paket
- Autentikasi web: **SSO via Portal Apps INTES**, pola sama dengan aplikasi IDAS/Approver
  (BE memverifikasi token ke Portal → sesi cookie Sanctum SPA). DILARANG membuat halaman login web,
  register, reset password, atau menyimpan password di aplikasi ini. Detail: docs/SSO.md
- Autentikasi mobile (auth khusus mobile): form login di aplikasi → `POST /api/v1/auth/mobile/login` → pm-api
  meneruskan kredensial ke API login Portal (password tidak disimpan) → token Sanctum **permanen** per perangkat,
  dicabut saat logout / user nonaktif. Detail: docs/SSO.md
- Frontend web: Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui; bahasa visual & token terang/gelap di `pm-web/DESIGN.md`
- Mobile: aplikasi Android React Native (Expo SDK 52, Node 18) dengan push & alarm, memakai API yang sama
- Queue & scheduler: Laravel Queue (database/redis) + Laravel Task Scheduling
- Deploy: Docker Compose di server CentOS — `docker-compose.prod.yml` (pm-nginx, pm-web, pm-api, pm-worker, pm-scheduler,
  pm-db PostgreSQL 17, pm-redis, pm-backup); panduan `docs/DEPLOY.md`

## Konvensi
- Backend = API-only (REST, JSON, prefix /api/v1). Semua logic bisnis di Service class, bukan di Controller.
- Peran global hanya dua: `admin` (lihat & kelola semua unit, atur hak akses) dan user biasa (unitnya + dokumennya sendiri).
  Pimpinan/teknisi unit pelaksana diturunkan dari grade Portal, bukan role.
- Delegasi hanya ke bawah: penugasan WO/PM/Request hanya ke grade di bawah penugas (atau diri sendiri); endpoint staf memberi flag `assignable`.
- WO yang diselesaikan otomatis membuat Aktivitas Harian `closed` untuk teknisinya (`DailyActivityService::createFromWorkOrder`).
- Import Excel (equipment, aktivitas harian): template dari `GET …/import-template`, unggah ke `POST …/import`; semua baris divalidasi dulu,
  gagal satu → `422 errors["rows.<n>"]` dan tidak ada yang disimpan (`App\Support\SpreadsheetRows`, `App\Exports\Templates`).
- Validasi pakai FormRequest Laravel. Otorisasi pakai Policy + role/permission (spatie/laravel-permission).
- Semua perubahan status WO/Request/PM dicatat di tabel log (audit trail: siapa, kapan, status lama → baru, catatan).
- Bahasa UI: Indonesia. Nama tabel/kolom/kode: Inggris snake_case.
- Zona waktu Asia/Jakarta.
- Setiap fitur baru wajib ada Feature Test (PHPUnit/Pest). Jalankan `php artisan test` sebelum bilang selesai.
- Jangan buat data dummy di migration; pakai Seeder terpisah.

## Struktur
- `pm-api/` backend Laravel · `pm-web/` frontend Next.js · `pm-mobile/` aplikasi Android Expo · `docs/` desain
- Kontrak API yang mengikat ketiganya (perbarui bila endpoint berubah): `docs/API_WORK_ORDER.md` (Modul A),
  `docs/API_SERVICE_REQUEST.md` (Modul B), `docs/API_PM.md` (Modul C), `docs/API_DASHBOARD.md` (dashboard, preferensi notifikasi, tautan unduhan aplikasi mobile),
  `docs/API_PROGRAM_ACTIVITY.md` (Program Kerja Tahunan & Aktivitas Harian)

## Perintah
- Backend: `cd pm-api && php artisan serve`, test: `php artisan test` (DB PostgreSQL `pm_test`)
- Frontend: `cd pm-web && npm run dev`, lint: `npm run lint`, build: `npm run build`
- Mobile: `cd pm-mobile && npx expo start`, cek: `npx tsc --noEmit`
- Deploy produksi: `./docker/deploy.sh` (memakai `.env.prod` + `docker-compose.prod.yml`; panduan `docs/DEPLOY.md`)