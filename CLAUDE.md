# PM-App PT Industri Nabati Lestari

Aplikasi web + mobile untuk Work Order, Form Request (dengan approval), dan
Preventive Maintenance Scheduler bagi divisi support (Sistem & IT, Maintenance/MTC,
General Affair, dll). Spesifikasi lengkap: @docs/PRD.md

## Stack (WAJIB, jangan ganti tanpa bertanya)
- Backend: Laravel 11, PHP 8.2, PostgreSQL
- Autentikasi web: **SSO via Portal Apps INTES**, pola sama dengan aplikasi IDAS/Approver
  (BE memverifikasi token ke Portal → sesi cookie Sanctum SPA). DILARANG membuat halaman login web,
  register, reset password, atau menyimpan password di aplikasi ini. Detail: docs/SSO.md
- Autentikasi mobile: form login di aplikasi; HP memanggil API login Portal langsung, lalu menukar token SSO
  ke BE PM-App → token Sanctum per perangkat. Password tidak pernah lewat/tersimpan di PM-App. Detail: docs/SSO.md
- Frontend web: Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui
- Mobile: PWA dari Next.js + aplikasi Android React Native (Expo, folder `mobile/`) dengan push & alarm, memakai API yang sama
- Queue & scheduler: Laravel Queue (database/redis) + Laravel Task Scheduling
- Deploy: Docker Compose di server CentOS (container: pm-be, pm-fe, pm-db, pm-redis)

## Konvensi
- Backend = API-only (REST, JSON, prefix /api/v1). Semua logic bisnis di Service class, bukan di Controller.
- Validasi pakai FormRequest Laravel. Otorisasi pakai Policy + role/permission (spatie/laravel-permission).
- Semua perubahan status WO/Request/PM dicatat di tabel log (audit trail: siapa, kapan, status lama → baru, catatan).
- Bahasa UI: Indonesia. Nama tabel/kolom/kode: Inggris snake_case.
- Zona waktu Asia/Jakarta.
- Setiap fitur baru wajib ada Feature Test (PHPUnit/Pest). Jalankan `php artisan test` sebelum bilang selesai.
- Jangan buat data dummy di migration; pakai Seeder terpisah.

## Perintah
- Backend: `cd be && php artisan serve`, test: `php artisan test`
- Frontend: `cd fe && npm run dev`, lint: `npm run lint`
- Docker: `docker compose up -d --build`