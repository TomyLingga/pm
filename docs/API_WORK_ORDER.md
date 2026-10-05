# Kontrak API — Auth & Work Order (v1)

> Kontrak **mengikat** untuk `pm-api` (Laravel 8), `pm-web` (Next.js 14) dan `pm-mobile` (Expo).
> Base URL: `/api/v1`. Semua respon JSON memakai envelope `{ "data": ... }`. Waktu ISO-8601 dengan offset `+07:00`.
> Label UI Bahasa Indonesia sudah disediakan server (`*_label`) — klien tidak perlu memetakan sendiri.

## 0. Autentikasi

### Web (sesi cookie Sanctum SPA, origin sama via proxy Next.js)
1. `GET /sanctum/csrf-cookie` → set cookie `XSRF-TOKEN`.
2. `POST /api/v1/auth/sso` body `{ "token": "<token Portal>", "app_id": "<uuid|null>" }`, header `X-XSRF-TOKEN` (nilai cookie di-`decodeURIComponent`), `credentials: include`.
   → `200 { data: Me }` + cookie sesi `pm_app_session`. Gagal → `401 { message }`.
3. Request berikutnya: `credentials: include` + `X-XSRF-TOKEN` untuk method non-GET, header `Accept: application/json`.
4. `POST /api/v1/auth/logout` → `204`.

### Mobile (token permanen per perangkat)
- `POST /api/v1/auth/mobile/login` body `{ "login": "email atau NRK", "password": "...", "device_name": "..." }`
  - Sukses → `200 { data: { token: "<plain>", user: Me } }`
  - Akun Portal dengan TOTP → `200 { data: { requires_totp: true, totp_token: "..." } }`
  - Salah → `422 { message, errors: { login: [..] } }`; terlalu sering → `429`.
- `POST /api/v1/auth/mobile/totp` body `{ "totp_token", "code", "device_name" }` → `200 { data: { token, user: Me } }`.
- Selanjutnya header `Authorization: Bearer <token>` + `Accept: application/json`. Token tidak kedaluwarsa; dicabut saat logout atau user dinonaktifkan (`401`).
- `POST /api/v1/auth/logout` → `204` (mencabut token perangkat ini beserta push token-nya).

### `GET /api/v1/auth/me` → `{ data: Me }`

```jsonc
// Me
{
  "id": 12, "nrk": "119090170", "name": "Muhammad Adib Nugraha", "email": "adib@inl.co.id",
  "phone": "0853…", "position": "Asisten Pengadaan", "employment_status": "Karyawan Tetap",
  "grade_code": "BOM-3", "grade_level": 8, "photo_url": "https://…|null",
  "org_unit": { "id": 4, "code": "PGD", "name": "Pengadaan", "type": "sub_bagian" } ,   // atau null
  "bagian": "Pengadaan|null", "sub_bagian": "Pengadaan|null",
  "roles": ["admin"],                       // role global: admin, management
  "executor_units": [ { "id": 1, "code": "IT", "display_name": "Sistem dan IT", "is_lead": true } ]
}
```

`UserBrief` = `{ "id", "nrk", "name", "position", "photo_url" }`

## 1. Lookup (untuk form)

| Method | Endpoint | Respon `data` |
|---|---|---|
| GET | `/executor-units?for=work_order` | `[{ id, code, display_name, categories: [{ id, name, requires_note }] }]` |
| GET | `/executor-units/{id}/staff` | `[{ ...UserBrief, grade_code, is_lead }]` — hanya untuk staf/pimpinan unit itu (403 lainnya) |
| GET | `/locations?q=` | `[{ id, code, name }]` (maks 50) |
| GET | `/equipment?q=&executor_unit_id=` | `[{ id, code, name, location: { id, code, name } \| null }]` (maks 50) |
| GET | `/materials?q=` | `[{ id, code, name, unit }]` (maks 50) |

## 2. Work Order

### Enum
| Field | Nilai → label |
|---|---|
| `status` | `submitted` DIAJUKAN · `received` DITERIMA · `in_progress` DIKERJAKAN · `completed` SELESAI · `closed` CLOSED · `cancelled` DIBATALKAN |
| `priority` | `high` Tinggi · `medium` Menengah · `low` Rendah |
| clearance `result` | `ok` OK · `not_ok` TDK |
| `scope` (list) | `mine` (saya pemohon) · `unit` (unit organisasi saya) · `pool` (belum diambil, unit pelaksana saya) · `assigned` (ditugaskan ke saya) · `executor` (semua WO unit pelaksana saya) · `all` (admin/management) |

### List — `GET /work-orders`
Query: `scope` (default `mine`), `status` (boleh dipisah koma), `executor_unit_id`, `priority`, `service_category_id`,
`location_id`, `equipment_id`, `issued_from` (YYYY-MM-DD), `issued_to`, `q` (cari no WO/permintaan/alat), `sort`
(`-issued_at` default, `issued_at`, `-priority`), `page`, `per_page` (≤100, default 20).

Respon: paginasi Laravel `{ data: [WorkOrderListItem], links: {...}, meta: { current_page, last_page, per_page, total, from, to } }`.

```jsonc
// WorkOrderListItem
{
  "id": 5, "wo_number": "WO/IT/X/2026/0001", "issued_at": "2026-10-05T08:15:00+07:00",
  "status": "in_progress", "status_label": "DIKERJAKAN",
  "priority": "high", "priority_label": "Tinggi",
  "executor_unit": { "id": 1, "code": "IT", "display_name": "Sistem dan IT" },
  "service_category": { "id": 3, "name": "Hardware" }, "category_note": null,
  "equipment_code": "PRN-01", "equipment_name": "Printer Epson L3110",
  "location_name": "Kantor Pengadaan", "request_description": "Printer tidak menarik kertas",
  "requester": UserBrief, "requester_sub_bagian_name": "Pengadaan",
  "assignees": [ { ...UserBrief, "is_lead": true } ],
  "picked_at": "…|null", "completed_at": "…|null", "closed_at": "…|null"
}
```

### Export — `GET /work-orders/export`
Query sama dengan list (tanpa paginasi). Respon file `.xlsx` (`Content-Disposition: attachment; filename=work-orders-YYYYMMDD-HHmm.xlsx`).

### Buat — `POST /work-orders` → `201 { data: WorkOrderDetail }`
```jsonc
{ "executor_unit_id": 1, "service_category_id": 3, "category_note": null,
  "equipment_id": 7, "equipment_code": null, "equipment_name": null,   // isi manual bila tidak ada di master
  "location_id": 2, "location_note": null,
  "request_description": "…", "priority": "high" }
```
Foto diunggah terpisah lewat endpoint lampiran setelah WO dibuat.

### Detail — `GET /work-orders/{id}` → `{ data: WorkOrderDetail }`
```jsonc
// WorkOrderDetail = WorkOrderListItem +
{
  "requester_org_unit_name": "Pengadaan", "requester_bagian_name": "Keuangan & Pengadaan",
  "equipment": { "id", "code", "name" } | null,
  "location": { "id", "code", "name" } | null, "location_note": null,
  "received_by": UserBrief|null, "received_at": "…|null",
  "picked_by": UserBrief|null,
  "completed_by": UserBrief|null, "work_done": "…|null",
  "accepted_by": UserBrief|null, "accepted_at": "…|null", "auto_accepted": false,
  "acceptance_due_at": "…|null",
  "total_breakdown_hours": 1.5|null, "remarks": "…|null", "rework_count": 0,
  "cancel_reason": null, "cancelled_at": null,
  "sla_minutes": 95|null,                       // picked_at → completed_at
  "materials": [ { "id", "material_id", "material_name", "quantity", "unit" } ],
  "labours": [ { "id", "user_id", "worker_name", "started_at", "finished_at", "duration_minutes" } ],
  "total_labour_minutes": 120,
  "clearances": [ { "item_no": 1, "item_label": "Area bersih",
                    "mtc_result": "ok|not_ok|null", "mtc_confirmed_by": UserBrief|null, "mtc_confirmed_at": "…|null",
                    "user_result": "…", "user_confirmed_by": UserBrief|null, "user_confirmed_at": "…|null" } ],
  "attachments": [ Attachment ],
  "signatures": [ { "role_key": "requested|received|completed|accepted", "role_label": "Diminta Oleh",
                    "signer_name", "signed_at", "verify_url" } ],
  "logs": [ { "id", "action", "action_label", "from_status", "to_status", "notes", "user": UserBrief|null, "created_at" } ],
  "permissions": { "can_update", "can_cancel", "can_pick", "can_receive", "can_reassign", "can_start",
                   "can_work", "can_complete", "can_accept", "can_upload" }      // boolean semua
}
```
`Attachment` = `{ id, collection: "photo_before|photo_after|document", original_name, mime_type, size_bytes, url, uploaded_by: UserBrief, created_at }`
— `url` = `/api/v1/attachments/{id}` (butuh autentikasi).

### Ubah — `PUT /work-orders/{id}` (pemohon, hanya `submitted`) — body sama dengan buat.

### Aksi — semua `POST`, respon `200 { data: WorkOrderDetail }`
| Endpoint | Body | Transisi | Siapa |
|---|---|---|---|
| `/work-orders/{id}/cancel` | `{ reason }` | submitted → cancelled | pemohon |
| `/work-orders/{id}/pick` | `{}` | submitted → in_progress | staf pelaksana (mengambil sendiri) |
| `/work-orders/{id}/receive` | `{ assignee_ids: [int], lead_id: int, priority?: "high\|medium\|low" }` | submitted → received | pimpinan pelaksana |
| `/work-orders/{id}/start` | `{}` | received → in_progress | teknisi yang ditugaskan |
| `/work-orders/{id}/complete` | `{ work_done, materials?: [Material], labours?: [Labour], clearance: [{ item_no: 1\|2, result: "ok\|not_ok" }], remarks? }` | in_progress → completed | teknisi yang ditugaskan |
| `/work-orders/{id}/accept` | `{ acceptance: "yes\|no", reason? (wajib bila no), clearance?: [{ item_no, result }] (wajib bila yes), total_breakdown_hours?, remarks? }` | completed → closed / in_progress | pemohon, user seunit pemohon, atasan pilihan pemohon (bukan teknisi WO itu) |

Non-transisi:
| Method | Endpoint | Body | Siapa |
|---|---|---|---|
| PUT | `/work-orders/{id}/assignees` | `{ assignee_ids, lead_id }` | pimpinan (status received/in_progress) |
| PUT | `/work-orders/{id}/materials` | `{ materials: [{ material_id?, material_name, quantity, unit }] }` | teknisi ditugaskan, in_progress |
| PUT | `/work-orders/{id}/labours` | `{ labours: [{ user_id?, worker_name, started_at, finished_at }] }` | teknisi ditugaskan, in_progress |
| POST | `/work-orders/{id}/attachments` | multipart `file` (jpg/png/webp/pdf ≤ 5 MB), `collection` | pemohon / staf pelaksana; maks 10 file per WO |
| GET | `/attachments/{id}` | — | yang boleh melihat WO |
| DELETE | `/attachments/{id}` | — | pengunggah, WO belum closed/cancelled |
| GET | `/work-orders/{id}/pdf` | — | `application/pdf` (inline), layout FM-BOPS-10/05 + QR tanda tangan |

Respon non-transisi: `PUT assignees/materials/labours` → `200 { data: WorkOrderDetail }`; upload lampiran →
`201 { data: Attachment }`; `DELETE` lampiran → `204`; `POST /work-orders` → `201 { data: WorkOrderDetail }`.

Error: `403` tidak berwenang, `409 { message }` transisi tidak valid, `422` validasi.

## 3. Notifikasi & push

| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/notifications?unread=1&page=` | paginasi `{ data: [{ id, event, title, body, work_order_id, alarm, read_at, created_at }] }` |
| GET | `/notifications/unread-count` | `{ data: { count } }` |
| POST | `/notifications/{id}/read` · `/notifications/read-all` | `204` |
| POST | `/push-subscriptions` | `{ channel: "expo", token, device_name }` → `201` |
| DELETE | `/push-subscriptions` | `{ token }` → `204` |

Event: `work_order.created` (ke staf pelaksana; **alarm** bila prioritas Tinggi), `work_order.assigned` (ke teknisi;
**alarm** bila Tinggi), `work_order.picked` / `work_order.received` (ke pemohon), `work_order.completed` (ke pemohon),
`work_order.rejected` (acceptance No → ke teknisi, **alarm**), `work_order.closed` (ke teknisi).
Push Expo: `channelId` = `alarm` untuk event alarm, selain itu `default`; `data = { event, work_order_id }`.

## 4. Publik

`GET /api/v1/public/signatures/{token}` (tanpa login) →
`{ data: { document_type_label, document_number, role_label, signer_name, signer_nrk, signer_position, signed_at, document_status_label, is_valid } }`
— dibuka dari QR di PDF lewat halaman web `/verifikasi/{token}`.
