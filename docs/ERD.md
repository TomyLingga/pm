# ERD — PM-App PT INL

> Status: **DRAFT v0.3** — sudah memasukkan jawaban Q-1…Q-36 di `docs/OPEN_QUESTIONS.md`.
> Rujukan: `docs/PRD.md`, formulir di `docs/forms/`, `docs/SSO.md`. Keputusan yang masih terbuka ditandai **[Q-n]**.

## Konvensi

- Database **PostgreSQL** (Q-25). Nama tabel/kolom/kode: Inggris `snake_case`. Label UI: Indonesia.
- PK `id` = `BIGINT GENERATED ALWAYS AS IDENTITY`. ID dari Portal (UUID) disimpan di kolom `portal_*_id`.
- Semua tabel punya `created_at`, `updated_at`; master + transaksi utama pakai `deleted_at` (soft delete).
- Status disimpan sebagai **kode Inggris** (PHP backed enum), dipetakan ke label Indonesia di UI (`docs/STATE_MACHINES.md`).
- Data identitas yang dicetak di formulir **di-snapshot** ke dokumen saat diajukan/disetujui.
- Timestamp `TIMESTAMPTZ`, aplikasi berjalan di `Asia/Jakarta`.
- Tabel standar framework (`jobs`, `failed_jobs`, `cache`, `sessions`, tabel internal spatie) tidak digambar.

## Ringkasan domain

| Domain | Tabel |
|---|---|
| Identitas & akses | `users`, `roles`, `model_has_roles`, `grade_capabilities`, `push_subscriptions` |
| Organisasi | `org_units`, `offices`, `locations`, `executor_units`, `executor_unit_members` |
| Master teknis | `equipment_categories`, `equipment`, `materials`, `service_categories`, `checklist_templates`, `checklist_template_items` |
| Konfigurasi | `document_templates`, `number_sequences`, `holidays`, `settings` |
| Work Order | `work_orders`, `work_order_assignees`, `work_order_materials`, `work_order_labours`, `work_order_clearances` |
| Form Request | `service_requests`, `service_request_approvals` |
| Preventive Maintenance | `pm_schedules`, `pm_schedule_equipment`, `pm_tasks`, `pm_task_items`, `pm_task_materials` |
| Lintas modul | `document_signatures`, `attachments`, `status_logs`, `activity_logs`, `notifications` |

### Perubahan utama dari v0.1

| Keputusan | Dampak ke skema |
|---|---|
| Q-1/Q-8/Q-17: pemohon **memilih atasannya sendiri** (user dengan grade lebih tinggi) | `users.superior_id` dihapus → `users.preferred_superior_id` (pilihan terakhir, hanya default). `service_requests.superior_id` dipilih per dokumen. Aturan bypass dihapus. |
| Q-2: pakai **Bagian / Sub Bagian** | snapshot `requester_bagian_name`, `requester_sub_bagian_name` (bukan divisi/departemen) |
| Q-6/Q-20/Q-31: pelaksana = **seksi** (unit Portal); nomor WO **dan** REQ pakai **kode seksi** | `service_divisions` → `executor_units` (terikat `org_units`); `number_sequences.scope_code` = kode seksi |
| Q-16/Q-36: kewenangan dari **grade Portal**; pimpinan pelaksana = grade **satu tingkat di atas** teknisi | `users.grade_*`, tabel `grade_capabilities`; `member_role` dihapus |
| Q-20: kategori dikelola tiap seksi, dipakai WO **dan** Form Request | `work_categories` + `request_types` digabung → `service_categories` |
| Q-9: konversi WO ↔ Form Request | `work_orders.source_service_request_id`, `service_requests.source_work_order_id`, status `converted` |
| Q-22: tanda tangan = **QR code** yang bisa diverifikasi | tabel `document_signatures` |
| Q-10: auto-accept setelah 3 **hari kerja** | tabel `holidays` + setting hari kerja |
| Q-13/Q-14/Q-24: jatuh tempo pakai **tanggal + jam**, jadwal **per N jam** | `pm_tasks.due_at`, `pm_schedules.frequency_type = hourly`, toleransi dalam jam |
| Q-26: push notification + alarm mobile | tabel `push_subscriptions` |

---

## 1. Identitas, akses & organisasi

```mermaid
erDiagram
    org_units ||--o{ org_units : "parent"
    org_units ||--o{ users : "member of"
    users |o--o{ users : "preferred superior"
    offices |o--o{ users : "based at"
    users ||--o{ model_has_roles : has
    roles ||--o{ model_has_roles : grants
    org_units ||--o| executor_units : "is executor"
    executor_units ||--o{ executor_unit_members : "extra members"
    users ||--o{ executor_unit_members : "added to"
    users ||--o{ push_subscriptions : "devices"
    offices ||--o{ locations : contains
    locations ||--o{ locations : "parent"

    users {
        bigint id PK
        uuid portal_user_id UK
        uuid portal_employee_id UK
        string nrk UK
        string name
        string email
        string phone "dari Portal (Q-3)"
        string employment_status "dari Portal (Q-3)"
        string position "jabatan"
        string grade_code "BOM, BOM-1..BOM-4"
        int grade_level "lebih besar = lebih tinggi"
        bigint org_unit_id FK
        bigint preferred_superior_id FK "atasan pilihan terakhir"
        bigint office_id FK
        string photo_url
        boolean is_active
        timestamptz last_login_at
        timestamptz profile_synced_at
    }
    roles {
        bigint id PK
        string name UK "admin, management"
        string guard_name
    }
    model_has_roles {
        bigint role_id FK
        string model_type
        bigint model_id
    }
    grade_capabilities {
        bigint id PK
        string grade_code UK "BOM-1"
        boolean is_executor_lead "terima/assign WO, approve, jadwal PM, skip PM"
        boolean can_be_superior
    }
    push_subscriptions {
        bigint id PK
        bigint user_id FK
        string channel "webpush|expo"
        text endpoint "URL webpush / device token"
        jsonb keys "p256dh, auth (webpush)"
        string device_name
        timestamptz last_used_at
    }
    org_units {
        bigint id PK
        uuid portal_unit_id UK
        string code UK
        string name
        string type "direktorat|sevp|bagian|sub_bagian|seksi"
        bigint parent_id FK
        boolean is_active
        timestamptz synced_at
    }
    executor_units {
        bigint id PK
        bigint org_unit_id FK,UK "seksi pelaksana, mis. IT"
        string display_name "nama di nomor REQ, mis. Sistem dan IT"
        string number_code "kode seksi utk nomor WO/REQ (Q-31)"
        boolean accepts_work_orders
        boolean accepts_requests
        boolean has_pm
        text request_rules "Petunjuk dan Aturan"
        string contact_footer
        boolean is_active
    }
    executor_unit_members {
        bigint id PK
        bigint executor_unit_id FK
        bigint user_id FK
        string membership "include|exclude"
        string note
    }
    offices {
        bigint id PK
        string code UK
        string name "Head Office, Pabrik"
        boolean is_active
    }
    locations {
        bigint id PK
        bigint office_id FK
        bigint parent_id FK
        string code UK "Function Location"
        string name
        boolean is_active
    }
```

**Aturan turunan (bukan kolom)**
- **Bagian / Sub Bagian pemohon** = ancestor `org_units` bertipe `bagian` / `sub_bagian` dari `users.org_unit_id`.
- **Staf pelaksana** suatu `executor_unit` = user aktif di `org_unit` seksi tsb **atau turunannya**, ditambah
  `executor_unit_members.membership = include` (mis. Kabag/Kasubag yang unitnya di atas seksi), dikurangi `exclude`.
- **Teknisi** = staf pelaksana dengan grade terendah di seksi itu (umumnya BOM-4).
  **Pimpinan pelaksana** (Q-36) = staf pelaksana dengan grade **satu tingkat di atas** teknisi (umumnya BOM-3/Supervisor);
  bila tidak ada, naik ke tingkat berikutnya (BOM-2, BOM-1). Pimpinan menerima/assign WO (teknisi dinotifikasi),
  approve Form Request tahap pelaksana, membuat jadwal PM, dan skip tugas PM. Urutan tingkat diatur di `grade_capabilities`.
- **Kandidat atasan** (dropdown) = user aktif dengan `grade_level` > `grade_level` pemohon. Default terisi
  `preferred_superior_id`. Pemohon dengan grade tertinggi (tidak ada kandidat) → step atasan dilewati otomatis.
- Role global spatie tinggal `admin` dan `management` (dashboard global, Q-21). Semua user login = pemohon.

---

## 2. Master teknis & konfigurasi

```mermaid
erDiagram
    equipment_categories ||--o{ equipment : groups
    locations ||--o{ equipment : "installed at"
    executor_units ||--o{ equipment : "responsible for"
    equipment ||--o{ equipment : "parent (sub-asset)"
    executor_units ||--o{ service_categories : "manages"
    equipment_categories |o--o{ checklist_templates : "default for"
    executor_units ||--o{ checklist_templates : owns
    checklist_templates ||--|{ checklist_template_items : contains
    executor_units |o--o{ document_templates : "override for"

    equipment_categories {
        bigint id PK
        string code UK
        string name
    }
    equipment {
        bigint id PK
        string code UK "No. Alat"
        string name "Nama Alat"
        bigint equipment_category_id FK
        bigint location_id FK
        bigint executor_unit_id FK "penanggung jawab"
        bigint parent_id FK
        string brand
        string model
        string serial_number
        date acquired_at
        string status "active|under_repair|inactive|disposed"
        string qr_token UK "label QR di alat"
    }
    materials {
        bigint id PK
        string code UK
        string name
        string unit
        boolean is_active
    }
    service_categories {
        bigint id PK
        bigint executor_unit_id FK
        string name "Software, Hardware, Network, Mechanical"
        boolean for_work_order
        boolean for_request
        boolean requires_note "true utk Lain-lain"
        int sort_order
        boolean is_active
    }
    checklist_templates {
        bigint id PK
        bigint executor_unit_id FK
        bigint equipment_category_id FK
        string name
        int version
        boolean is_active
    }
    checklist_template_items {
        bigint id PK
        bigint checklist_template_id FK
        int sort_order
        string section
        string description
        string input_type "ok_nok_na|number|text"
        string unit
        decimal min_value
        decimal max_value
        boolean is_required
        boolean photo_required
    }
    document_templates {
        bigint id PK
        string doc_type "work_order|service_request"
        bigint executor_unit_id FK "null = default"
        string doc_number "FM-BOPS-10/05"
        string revision "01"
        date effective_date
        text footer_note
    }
    number_sequences {
        bigint id PK
        string doc_type "work_order|service_request|pm_task"
        string scope_code "kode seksi pelaksana"
        int year
        int last_number
    }
    holidays {
        bigint id PK
        date date UK
        string name
    }
    settings {
        bigint id PK
        string key UK
        jsonb value
    }
```

**Catatan**
- `number_sequences`: unique (`doc_type`, `scope_code`, `year`), diambil dengan `SELECT … FOR UPDATE`. Reset per tahun.
  Urutan nomor per seksi pelaksana per tahun (`scope_code` = kode seksi, Q-31).
  - WO: `WO/{kode seksi}/{bulan romawi}/{tahun}/{0001}`.
  - Request: `REQ{0001}/{kode seksi}/{bulan romawi}/{tahun}`, diterbitkan saat submit pertama (Q-7).
- `service_categories` dikelola pimpinan pelaksana masing-masing seksi (Q-20). Saat membuat WO/Request,
  pemohon memilih seksi pelaksana → dropdown kategori difilter `executor_unit_id` + `for_work_order`/`for_request`.
- `holidays` + setting `working_days` (default Senin–Jumat) dipakai untuk menghitung "3 hari kerja" auto-accept (Q-10).
- `checklist_templates` di-versi; butir di-snapshot ke `pm_task_items`.
- Import Excel (Q-27): `locations`, `equipment`, `materials`, `checklist_templates` + item.

---

## 3. Work Order (FM-BOPS-10/05)

```mermaid
erDiagram
    users ||--o{ work_orders : "requested by"
    executor_units ||--o{ work_orders : "executed by"
    service_categories ||--o{ work_orders : categorizes
    equipment |o--o{ work_orders : "for"
    locations |o--o{ work_orders : "at"
    pm_task_items |o--o| work_orders : "finding creates"
    service_requests |o--o| work_orders : "converted from"
    work_orders ||--o{ work_order_assignees : has
    users ||--o{ work_order_assignees : "assigned"
    work_orders ||--o{ work_order_materials : uses
    materials |o--o{ work_order_materials : "from master"
    work_orders ||--o{ work_order_labours : "worked by"
    work_orders ||--|{ work_order_clearances : "clearance (2 items)"

    work_orders {
        bigint id PK
        string wo_number UK "WO/IT/IX/2026/0001"
        timestamptz issued_at
        bigint requester_id FK
        bigint requester_org_unit_id FK
        string requester_bagian_name "snapshot"
        string requester_sub_bagian_name "snapshot Department/Section"
        bigint executor_unit_id FK
        bigint service_category_id FK
        string category_note "isian Lain-lain"
        bigint equipment_id FK "nullable"
        string equipment_code "snapshot / manual"
        string equipment_name "snapshot / manual"
        bigint location_id FK
        string location_note
        text request_description
        string priority "high|medium|low"
        string status
        bigint received_by_id FK "pimpinan yg assign"
        timestamptz received_at
        bigint picked_by_id FK "teknisi yg pick"
        timestamptz picked_at "awal SLA (Q-12)"
        bigint completed_by_id FK "MTC In Charge"
        timestamptz completed_at "akhir SLA"
        text work_done
        bigint accepted_by_id FK "null = auto-accept"
        timestamptz accepted_at
        boolean auto_accepted
        timestamptz acceptance_due_at "completed_at + 3 hari kerja"
        decimal total_breakdown_hours
        text remarks
        int rework_count
        string cancel_reason
        timestamptz cancelled_at
        string conversion_reason "alasan dialihkan ke Form Request"
        timestamptz closed_at
        bigint pm_task_item_id FK "nullable"
        bigint source_service_request_id FK "nullable (Q-9)"
    }
    work_order_assignees {
        bigint id PK
        bigint work_order_id FK
        bigint user_id FK
        boolean is_lead
        bigint assigned_by_id FK "sama dg user_id bila self-pick"
        timestamptz assigned_at
        timestamptz unassigned_at
    }
    work_order_materials {
        bigint id PK
        bigint work_order_id FK
        bigint material_id FK "nullable"
        string material_name
        decimal quantity
        string unit
    }
    work_order_labours {
        bigint id PK
        bigint work_order_id FK
        bigint user_id FK "nullable"
        string worker_name
        timestamptz started_at
        timestamptz finished_at
        int duration_minutes
    }
    work_order_clearances {
        bigint id PK
        bigint work_order_id FK
        smallint item_no
        string item_label
        string mtc_result "ok|not_ok"
        bigint mtc_confirmed_by_id FK
        timestamptz mtc_confirmed_at
        string user_result "ok|not_ok"
        bigint user_confirmed_by_id FK
        timestamptz user_confirmed_at
    }
```

**Catatan**
- **SLA (Q-12)** = `completed_at − picked_at` (dari teknisi mengambil/mulai mengerjakan sampai selesai). Bila ada rework,
  SLA dihitung dari `picked_at` pertama sampai `completed_at` terakhir; `rework_count` dilaporkan terpisah.
  Waktu tunggu (`picked_at − issued_at`) tetap ditampilkan sebagai metrik pendukung.
- **Penerima hasil (Q-10)**: pemohon, `preferred_superior_id` pemohon, atau user aktif di `requester_org_unit_id` yang sama.
- Indeks: `(executor_unit_id, status)`, `(requester_id, status)`, `(requester_org_unit_id)`, `(equipment_id, issued_at)`,
  partial index `(acceptance_due_at) WHERE status = 'completed'` untuk job auto-accept.

---

## 4. Form Request (INLHO/BSIS-ITC/F-004)

```mermaid
erDiagram
    users ||--o{ service_requests : "requested by"
    users ||--o{ service_requests : "chosen superior"
    executor_units ||--o{ service_requests : "handled by"
    offices ||--o{ service_requests : "office"
    service_categories ||--o{ service_requests : "jenis permintaan"
    service_requests ||--|{ service_request_approvals : "approval trail"
    work_orders |o--o| service_requests : "converted from"

    service_requests {
        bigint id PK
        string request_number UK "null selama draft"
        bigint executor_unit_id FK
        bigint office_id FK
        bigint service_category_id FK
        text purpose "Keperluan"
        string priority "high|medium|low"
        decimal estimated_cost "nullable"
        string status
        string current_step "superior|executor_lead|executor|null"
        bigint requester_id FK
        string requester_name "snapshot identitas"
        string requester_nrk
        string requester_position
        string requester_employment_status
        string requester_bagian_name
        string requester_sub_bagian_name
        string requester_email
        string requester_phone
        bigint superior_id FK "dipilih pemohon"
        string superior_name
        bigint assigned_executor_id FK
        text executor_notes "Keterangan"
        text rules_snapshot
        int revision_no
        timestamptz submitted_at
        timestamptz completed_at
        timestamptz rejected_at
        timestamptz cancelled_at
        string conversion_reason "alasan dialihkan ke WO"
        bigint source_work_order_id FK "nullable (Q-9)"
    }
    service_request_approvals {
        bigint id PK
        bigint service_request_id FK
        int revision_no
        string step "requester|superior|executor_lead|executor"
        smallint step_order "1..4"
        bigint acted_by_id FK
        string action "submitted|approved|rejected|revision_requested|completed|skipped|converted"
        text notes
        string actor_name "snapshot utk PDF"
        string actor_phone "snapshot utk PDF"
        timestamptz acted_at
    }
```

**Catatan**
- Atasan dipilih pemohon dari kandidat grade lebih tinggi; selama `waiting_superior` pemohon boleh **mengganti atasan**
  (pengganti delegasi, Q-17) — tercatat di `status_logs`.
- Tidak ada step biaya tambahan (Q-18); Keperluan berupa teks (Q-19).
- Blok PENGESAHAN = baris approval `revision_no` terakhir + QR dari `document_signatures`.

---

## 5. Preventive Maintenance

```mermaid
erDiagram
    executor_units ||--o{ pm_schedules : owns
    checklist_templates ||--o{ pm_schedules : uses
    users ||--o{ pm_schedules : "PIC"
    pm_schedules ||--|{ pm_schedule_equipment : covers
    equipment ||--o{ pm_schedule_equipment : "scheduled in"
    pm_schedules ||--o{ pm_tasks : generates
    equipment ||--o{ pm_tasks : "for"
    pm_tasks ||--|{ pm_task_items : "checklist answers"
    checklist_template_items ||--o{ pm_task_items : "source item"
    pm_tasks ||--o{ pm_task_materials : uses
    pm_task_items |o--o| work_orders : "finding -> WO"

    pm_schedules {
        bigint id PK
        string code UK
        string name
        bigint executor_unit_id FK
        bigint checklist_template_id FK
        string frequency_type "hourly|daily|weekly|monthly|yearly|every_n_days"
        int frequency_interval "N jam/hari/..."
        jsonb recurrence_options "jam mulai, hari, tanggal"
        timestamptz start_at
        timestamptz end_at "nullable"
        int tolerance_hours
        int due_window_hours "default 48 = H-2"
        bigint pic_user_id FK
        int estimated_minutes
        timestamptz generated_until
        boolean is_active
        bigint created_by_id FK
    }
    pm_schedule_equipment {
        bigint id PK
        bigint pm_schedule_id FK
        bigint equipment_id FK
        bigint pic_user_id FK "override PIC"
    }
    pm_tasks {
        bigint id PK
        string task_number UK
        bigint pm_schedule_id FK
        bigint equipment_id FK
        bigint checklist_template_id FK
        bigint pic_user_id FK
        timestamptz due_at "tanggal + jam (Q-13)"
        timestamptz due_window_at "due_at - due_window_hours"
        timestamptz overdue_at "due_at + tolerance_hours"
        string status
        timestamptz started_at
        timestamptz completed_at
        bigint completed_by_id FK
        int duration_minutes
        boolean is_late
        text notes
        string skip_reason
        bigint skipped_by_id FK "null = sistem"
        string skip_proposal "usulan skip dari teknisi"
        bigint skip_proposed_by_id FK
        timestamptz reminder_window_sent_at "H-2"
        timestamptz reminder_due_sent_at "H-0"
        timestamptz last_overdue_reminder_at "tiap 2 hari"
    }
    pm_task_items {
        bigint id PK
        bigint pm_task_id FK
        bigint checklist_template_item_id FK
        int sort_order
        string description
        string input_type
        string result "ok|not_ok|na"
        decimal value_number
        string value_text
        text notes
    }
    pm_task_materials {
        bigint id PK
        bigint pm_task_id FK
        bigint material_id FK
        string material_name
        decimal quantity
        string unit
    }
```

**Catatan**
- Satu tugas per equipment per kejadian (Q-14). Unique `(pm_schedule_id, equipment_id, due_at)` → generator idempotent.
- Frekuensi `hourly` = tugas berulang tiap N jam (mis. tiap 8 jam, Q-14). Untuk jadwal per jam, `due_window_hours`
  otomatis dibatasi maks. setengah interval (agar H-2 tidak tumpang tindih dengan kejadian berikutnya), dan horizon
  generate lebih pendek (7 hari) dibanding jadwal harian ke atas (60 hari, Q-15).
- Jadwal berbasis jam = kalender tiap N jam (Q-32 = a); running hours mesin tidak dimodelkan.
- Log maintenance per equipment = gabungan `pm_tasks` + `work_orders` berdasarkan `equipment_id`.

---

## 6. Lintas modul: tanda tangan QR, lampiran, audit, notifikasi

```mermaid
erDiagram
    users ||--o{ document_signatures : signs
    users ||--o{ attachments : uploads
    users ||--o{ status_logs : "changed by"
    users ||--o{ activity_logs : causes
    users ||--o{ notifications : receives

    document_signatures {
        bigint id PK
        string token UK "acak 32 karakter, isi QR"
        string signable_type "work_order|service_request|pm_task"
        bigint signable_id
        string document_number "snapshot"
        string role_label "Diminta oleh, Disetujui oleh, ..."
        bigint signer_id FK
        string signer_name
        string signer_nrk
        string signer_position
        timestamptz signed_at
        timestamptz revoked_at "mis. setelah revisi"
    }
    attachments {
        bigint id PK
        string attachable_type
        bigint attachable_id
        string collection "photo_before|photo_after|document"
        string path
        string original_name
        string mime_type
        int size_bytes
        bigint uploaded_by_id FK
    }
    status_logs {
        bigint id PK
        string loggable_type
        bigint loggable_id
        string action
        string from_status
        string to_status
        text notes
        jsonb meta
        bigint user_id FK "null = sistem"
        timestamptz created_at
    }
    activity_logs {
        bigint id PK
        string subject_type
        bigint subject_id
        string event
        jsonb old_values
        jsonb new_values
        bigint causer_id FK
        string ip_address
        timestamptz created_at
    }
    notifications {
        uuid id PK
        string type
        string notifiable_type
        bigint notifiable_id
        jsonb data
        timestamptz read_at
        timestamptz created_at
    }
```

**Catatan**
- **QR tanda tangan (Q-22)**: setiap pengesahan (Diminta, Diterima/Disetujui, Diselesaikan, Diterima user) membuat satu
  `document_signatures`. PDF mencetak QR berisi `{FE_URL}/verifikasi/{token}`. Halaman publik itu (tanpa login) menampilkan
  nama penanda tangan, jabatan, waktu, nomor dokumen, dan status dokumen saat ini. Token acak (bukan ID berurutan) agar
  tidak bisa ditebak; tanda tangan yang dibatalkan (revisi) tampil "tidak berlaku".
- Lampiran (Q-29): maks 10 file × 5 MB per dokumen, foto dikompres di klien, disimpan di volume Docker.
- Material hanya dicatat, tidak memotong stok (Q-30).
- Relasi polimorfik memakai `morphMap` alias pendek (`work_order`, `service_request`, `pm_task`).
