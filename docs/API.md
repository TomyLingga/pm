# API v1 — PM-App PT INL

> Status: **DRAFT v0.3** — sudah memasukkan jawaban `docs/OPEN_QUESTIONS.md`. Rujukan: `docs/ERD.md`,
> `docs/STATE_MACHINES.md`, `docs/SSO.md`. Keputusan yang masih terbuka: **[Q-n]**.

## Konvensi umum

- Base URL `/api/v1`, JSON. **Web**: cookie sesi Sanctum SPA + header `X-XSRF-TOKEN` (seperti IDAS).
  **Mobile**: `Authorization: Bearer <sanctum-token>`. Kedua mode dilayani middleware `auth:sanctum` yang sama.
- Respon sukses `{ "data": …, "meta": { "pagination": … } }`. Error: `422` validasi, `401` belum login,
  `403` ditolak Policy, `409` transisi status tidak valid, `429` rate limit.
- List: `?page=&per_page=` (maks 100), `?sort=-issued_at`, `?q=`, `?filter[field]=value`.
- Aksi status = `POST /{resource}/{id}/{action}`. Tiap aksi divalidasi oleh state machine di Service, menulis
  `status_logs`, membuat `document_signatures` bila aksi itu pengesahan, lalu men-dispatch notifikasi.
- Ekspor `.xlsx` menerima filter yang sama dengan list-nya. Tanggal ISO-8601 `+07:00`.

**Singkatan akses**
- `pelaksana` = staf seksi pelaksana dokumen tsb; `pimpinan` = pelaksana dengan grade satu tingkat di atas teknisi
  (umumnya BOM-3); `teknisi` = pelaksana grade terendah (umumnya BOM-4). Lihat aturan di `docs/ERD.md` §1.
- `seunit` = user di unit organisasi yang sama dengan pemohon (lihat-saja, Q-21).

---

## 0. Auth & profil

| Method | Endpoint | Keterangan | Akses |
|---|---|---|---|
| GET | `/sanctum/csrf-cookie` | (di luar `/api/v1`) set cookie XSRF sebelum login web | publik |
| POST | `/auth/sso` | `{ token, app_id }` → verifikasi ke Portal, upsert user, buat sesi web | publik, rate-limited |
| POST | `/auth/mobile/login` · `/auth/mobile/totp` | auth khusus mobile; kredensial diperiksa Portal → token Sanctum permanen per perangkat (`docs/SSO.md` §5b, kontrak rinci `docs/API_WORK_ORDER.md`) | publik, rate-limited |
| POST | `/auth/logout` | web: invalidate sesi; mobile: cabut token. Respon berisi `portal_url` | login |
| GET | `/auth/me` | profil, grade, unit (bagian/sub bagian), unit pelaksana & perannya, role global | login |
| GET | `/auth/me/inbox` | ringkasan "perlu tindakan saya" (approval, WO ditugaskan/siap di-pick, PM jatuh tempo, WO menunggu penerimaan) | login |
| GET | `/users/superior-candidates` | `?q=` — user aktif dengan `grade_level` > milik saya (dropdown atasan, Q-1) | login |

## 1. Notifikasi & push

| Method | Endpoint | Keterangan | Akses |
|---|---|---|---|
| GET | `/notifications` | `?filter[unread]=1` | login |
| GET | `/notifications/unread-count` | badge bell | login |
| POST | `/notifications/{id}/read` · `/notifications/read-all` | | pemilik |
| POST | `/push-subscriptions` | `{ channel: webpush\|expo, endpoint, keys?, device_name }` daftar perangkat | login |
| DELETE | `/push-subscriptions/{id}` | | pemilik |
| GET | `/push/vapid-public-key` | kunci publik Web Push untuk PWA | login |
| GET/PUT | `/notifications/preferences` | event mana yang berbunyi "alarm" di perangkat ini | login |

## 2. Master data & administrasi

Pola CRUD sama: `GET /x`, `POST /x`, `GET /x/{id}`, `PUT /x/{id}`, `DELETE /x/{id}` (soft delete; `409` bila masih dipakai).
`GET` terbuka untuk semua user login (dropdown, `?filter[active]=1`).

| Resource | Endpoint | Tulis oleh | Tambahan |
|---|---|---|---|
| Unit organisasi | `/org-units` (GET saja) | — (sinkron dari Portal) | `GET /org-units/tree` |
| Office | `/offices` | admin | |
| Lokasi | `/locations` | admin | `GET /locations/tree`, `POST /locations/import`, export |
| Unit pelaksana | `/executor-units` | admin | dipetakan ke seksi Portal; `PUT /{id}/rules` (Petunjuk & Aturan) oleh pimpinan |
| Anggota tambahan | `/executor-units/{id}/members` | admin, pimpinan | `GET` menampilkan staf efektif (otomatis + include − exclude) |
| Kategori layanan | `/executor-units/{id}/categories` | pimpinan seksi tsb, admin | dipakai WO & Request (Q-20); `?for=work_order\|request` |
| Kategori equipment | `/equipment-categories` | admin | |
| Equipment | `/equipment` | admin, pimpinan seksi PJ | `GET /{id}/history`, `GET /by-qr/{token}`, `POST /import`, export |
| Material | `/materials` | admin, pimpinan | `POST /import`, export |
| Template checklist | `/checklist-templates` | admin, pimpinan | `PUT /{id}/items`, `POST /{id}/duplicate`, `POST /import` |
| Template dokumen cetak | `/document-templates` | admin | |
| Hari libur | `/holidays` | admin | untuk hitung hari kerja (Q-10) |
| Pemetaan grade | `/grade-capabilities` | admin | BOM-x → lead/teknisi (Q-16) |
| Pengaturan | `/settings` | admin | `GET`, `PUT` |

### User & role (admin)

| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/users` | `?filter[org_unit_id]=&filter[executor_unit_id]=&filter[grade_code]=&q=` |
| GET | `/users/{id}` | |
| PUT | `/users/{id}/roles` | role global `admin`, `management` |
| POST | `/users/sync` | tarik ulang karyawan & unit dari Portal |
| GET | `/audit/activity-logs` | audit umum |

## 3. Modul A — Work Order

| Method | Endpoint | Keterangan | Akses |
|---|---|---|---|
| GET | `/work-orders` | filter `status, executor_unit_id, priority, service_category_id, location_id, equipment_id, issued_from, issued_to, scope=mine\|unit\|assigned\|pool\|executor` (`pool` = belum di-pick) | sesuai Policy |
| POST | `/work-orders` | pilih seksi pelaksana → kategori; → `submitted` | login |
| GET | `/work-orders/{id}` | detail lengkap | pemohon, seunit, pelaksana, management |
| PUT | `/work-orders/{id}` | edit selama `submitted` | pemohon |
| POST | `/work-orders/{id}/cancel` | `{ reason }`, selama `submitted` | pemohon |
| POST | `/work-orders/{id}/pick` | teknisi mengambil sendiri → `in_progress`, `picked_at` = awal SLA | pelaksana |
| POST | `/work-orders/{id}/receive` | `{ assignee_ids[], lead_id, priority? }` → `received`; teknisi dinotifikasi (push) | pimpinan |
| PUT | `/work-orders/{id}/assignees` | ganti teknisi | pimpinan |
| POST | `/work-orders/{id}/start` | teknisi yang di-assign mulai → `in_progress`, `picked_at` (bila belum) | assignee |
| PUT | `/work-orders/{id}/materials` · `/labours` | ganti seluruh daftar | assignee |
| POST | `/work-orders/{id}/complete` | `{ work_done, materials[], labours[], clearance[] }` → `completed` | assignee |
| POST | `/work-orders/{id}/accept` | `{ acceptance: yes\|no, reason?, clearance[], total_breakdown_hours?, remarks? }` → `closed` / `in_progress` | pemohon, atasan pilihannya, seunit (Q-10) |
| POST | `/work-orders/{id}/convert-to-request` | `{ reason }` → WO `converted` + Form Request `draft` untuk pemohon (Q-9) | pimpinan |
| GET | `/work-orders/{id}/logs` | timeline | yang boleh lihat |
| POST/DELETE | `/work-orders/{id}/attachments[/{attId}]` | maks 10 × 5 MB | pemohon, assignee |
| GET | `/work-orders/{id}/pdf` | layout FM-BOPS-10/05 + QR tanda tangan | yang boleh lihat |
| GET | `/work-orders/export` | xlsx | pelaksana, management |

## 4. Modul B — Form Request (DIIMPLEMENTASIKAN)

Kontrak lengkap & mengikat: [`API_SERVICE_REQUEST.md`](API_SERVICE_REQUEST.md) — list/filter/export, draft CRUD,
aksi `submit · change-superior · approve · reject · request-revision · complete · cancel · convert-to-work-order`,
PDF INLHO/BSIS-ITC/F-004, `GET /approvals/pending` ("Menunggu Persetujuan Saya", generik), lookup `offices`,
`users/superior-candidates`, `users/my-superior`, dan `POST /work-orders/{id}/convert-to-request`.

## 5. Modul C — Preventive Maintenance

### Jadwal

| Method | Endpoint | Keterangan | Akses |
|---|---|---|---|
| GET | `/pm-schedules` | filter `executor_unit_id, equipment_id, pic_user_id, active` | pelaksana, management |
| POST | `/pm-schedules` | `{ name, equipment_ids[], checklist_template_id, frequency_type (hourly…yearly, every_n_days), frequency_interval, recurrence_options, start_at, end_at?, tolerance_hours, due_window_hours?, pic_user_id }` | pimpinan |
| GET/PUT/DELETE | `/pm-schedules/{id}` | ubah → tugas `scheduled` di masa depan digenerate ulang (Q-15) | pimpinan |
| POST | `/pm-schedules/{id}/activate` · `/deactivate` | | pimpinan |
| GET | `/pm-schedules/{id}/preview` | `?from&to` simulasi kejadian | pelaksana |

### Tugas PM

| Method | Endpoint | Keterangan | Akses |
|---|---|---|---|
| GET | `/pm-tasks` | filter `status, executor_unit_id, equipment_id, pic_user_id, location_id, due_from, due_to, scope=mine\|executor` | pelaksana, management |
| GET | `/pm-tasks/calendar` | `?start&end` — tugas tergenerate + proyeksi di luar horizon (Q-15) | pelaksana, management |
| GET | `/pm-tasks/{id}` | | pelaksana |
| POST | `/pm-tasks/{id}/start` | `due`/`overdue` → `in_progress` | PIC / pelaksana |
| PUT | `/pm-tasks/{id}/items` · `/materials` | simpan parsial (auto-save) | pelaksana |
| POST | `/pm-tasks/{id}/complete` | `{ duration_minutes, notes }` | pelaksana |
| POST | `/pm-tasks/{id}/propose-skip` | `{ reason }` usulan teknisi → notif ke pimpinan (Q-16) | teknisi |
| POST | `/pm-tasks/{id}/skip` | `{ reason }` | pimpinan |
| POST | `/pm-tasks/{id}/reassign` | `{ pic_user_id }` | pimpinan |
| POST | `/pm-tasks/{id}/items/{itemId}/work-order` | WO dari temuan "Tidak OK" | pelaksana |
| POST/DELETE | `/pm-tasks/{id}/attachments[/{attId}]` | foto per tugas/butir | pelaksana |
| GET | `/pm-tasks/{id}/logs` · `/pm-tasks/export` | | pelaksana, management |

## 6. Dashboard & laporan

Filter umum: `from, to, executor_unit_id, location_id, service_category_id`. Non-management dibatasi ke unit pelaksananya.

| Method | Endpoint | Isi |
|---|---|---|
| GET | `/dashboard/summary` | KPI: WO per status, request pending, PM overdue, kepatuhan PM |
| GET | `/dashboard/work-orders/by-status` | jumlah + tren |
| GET | `/dashboard/work-orders/sla` | rata-rata/median `picked_at → completed_at` per prioritas & teknisi, waktu tunggu `issued_at → picked_at` (Q-12) |
| GET | `/dashboard/pm/compliance` | % selesai tepat waktu |
| GET | `/dashboard/equipment/breakdown-hours` · `/top-failures` | |
| GET | `/dashboard/technicians/workload` | |
| GET | `/reports/{type}/export` | xlsx |

## 7. Publik & sistem

| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/public/signatures/{token}` | verifikasi QR (tanpa login): nama, jabatan, waktu, nomor & status dokumen (Q-22). Rate-limited. |
| GET | `/health` | healthcheck Docker |
| — | `pm:generate-tasks` (tiap jam) | generate tugas sampai horizon (7 hari untuk jadwal per jam, 60 hari lainnya) |
| — | `pm:refresh-statuses` (tiap 15 menit) | `scheduled→due` (H-2), `due→overdue`, auto-skip kejadian lama, pengingat overdue tiap 2 hari |
| — | `wo:auto-accept` (tiap jam) | WO `completed` melewati `acceptance_due_at` (3 hari kerja) → `closed` |
| — | `portal:sync-employees` (harian) | sinkron `users` & `org_units` |
