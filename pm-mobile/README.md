# PrevenTech — Aplikasi Android (Work Order, Form Request & Preventive Maintenance)

Aplikasi Android PrevenTech PT Industri Nabati Lestari:

- **Work Order** (FM-BOPS-10/05) — teknisi di lapangan mengambil/mengerjakan WO, karyawan mengajukan WO.
- **Form Request** (INLHO/BSIS-ITC/F-004) — permintaan yang memerlukan biaya/persetujuan, dengan rantai
  persetujuan Atasan YBS → Mgr/Spv Divisi → Foreman Divisi, serta tab **Persetujuan** untuk approver.
- **Preventive Maintenance** — teknisi mengerjakan tugas PM: checklist (OK / Tidak OK / N/A, angka dengan batas,
  teks), foto per butir, material, buat WO dari temuan, riwayat maintenance per alat. Pembuatan jadwal, template
  checklist dan master alat tetap di aplikasi web.
- **Aktivitas Harian**: laporan kegiatan harian per orang (bulan, minggu M1-M5, status Open / On Progress / Closed);
  pimpinan melihat laporan tim dan dapat mencatat atas nama bawahan.
- **Program Kerja Tahunan**: melihat program kerja unit (sub-item, kegiatan, PIC, target, progress) dan, sebagai
  PIC, memperbarui progress / remarks / status kegiatan. Pembuatan program, sub-item dan kegiatan tetap di web.
- Notifikasi push & alarm (WO prioritas Tinggi, tugas PM jatuh tempo/terlambat, pengingat persetujuan > 24 jam,
  request ditolak/minta revisi, penunjukan PIC kegiatan program kerja).

Kontrak API yang diikuti: `../docs/API_WORK_ORDER.md`, `../docs/API_SERVICE_REQUEST.md`, `../docs/API_PM.md` dan
`../docs/API_PROGRAM_ACTIVITY.md`.

- Expo **SDK 52** · React Native 0.76 · TypeScript (strict) · expo-router 4 (file-based, tab)
- Data: @tanstack/react-query v5 · Token disimpan di `expo-secure-store`
- Node.js **18.18+** (diuji dengan Node 18.18.2 / npm 9.8.1)

## 1. Setup

```bash
cd pm-mobile
npm install
cp .env.example .env        # lalu sesuaikan URL API
```

`.env`:

```dotenv
EXPO_PUBLIC_PM_API_URL=https://pm.inl.co.id/api/v1
```

- Wajib berisi prefix `/api/v1`, tanpa `/` di akhir. Bila kosong, aplikasi memakai `https://pm.inl.co.id/api/v1`.
- Variabel `EXPO_PUBLIC_*` di-*inline* saat bundling — setelah mengubah `.env`, restart `npx expo start -c`.
- Untuk uji dengan backend lokal dari HP, pakai IP LAN komputer (mis. `http://192.168.1.10:8000/api/v1`), bukan
  `localhost`. Build rilis Android memblokir HTTP non-TLS, jadi gunakan HTTPS untuk APK.

> Catatan: `package.json` mem-*pin* paket `@react-navigation/*` lewat `overrides` ke rilis yang cocok dengan
> expo-router 4.0 (SDK 52). Versi React Navigation yang lebih baru membuang dependensi `query-string` yang masih
> dipakai expo-router 4.0 sehingga bundling gagal. Jangan hapus blok `overrides` tersebut.

### Perintah

| Perintah | Fungsi |
|---|---|
| `npm start` | Menjalankan Metro / Expo dev server |
| `npm run typecheck` | `tsc --noEmit` |
| `npx expo-doctor` | Pemeriksaan konfigurasi & versi paket SDK 52 |
| `npx expo export --platform android --output-dir <folder-temp>` | Membuktikan bundle JS Android dapat dibangun |

## 2. Menguji di perangkat

### Ringkasan

| Cara | Android | iPhone | Push & alarm | Butuh |
|---|---|---|---|---|
| **APK lokal** (`npm run build:apk`, hasil di `dist/`) | ya, pasang langsung | tidak | ya (bila `projectId` EAS terisi) | Android SDK + JDK 17 di komputer |
| **Expo Go** (`npx expo start`, pindai QR) | ya | ya | terbatas | HP dan komputer satu Wi-Fi |
| **EAS build** (cloud) | APK | IPA ke TestFlight | ya | akun Expo; untuk iOS juga akun Apple Developer |

Backend untuk pengujian: `pm-api` harus bisa dijangkau dari HP. Jalankan dengan
`php artisan serve --host=0.0.0.0 --port=8000` (bukan hanya `127.0.0.1`), pastikan firewall Windows mengizinkan
port 8000, dan `EXPO_PUBLIC_PM_API_URL` di `.env` menunjuk ke IP LAN komputer (contoh
`http://192.168.16.136:8000/api/v1`). Login mobile memakai email/NRK + password Portal INTES.

### APK lokal (Android, tanpa akun Expo)

```bash
npm run build:apk          # expo prebuild → gradle assembleRelease → dist/PrevenTech-v<versi>.apk
```

Butuh `ANDROID_HOME` (SDK + build-tools + NDK) dan JDK 17. Build pertama sekitar 10 menit. Salin APK ke HP dan pasang
(izinkan "Instal dari sumber tidak dikenal"). `EXPO_PUBLIC_PM_API_URL` dibaca dari `.env` saat build, jadi APK ini
mengarah ke server yang tertulis di sana; untuk produksi ganti ke `https://pm.inl.co.id/api/v1` lalu build ulang.
Folder `android/` hasil prebuild dan `dist/` tidak masuk git. APK ditandatangani dengan debug keystore (cukup untuk
pengujian internal; untuk Play Store pakai EAS atau keystore sendiri).

### iPhone

Tidak ada build iOS tanpa Mac atau EAS. Pilihan:
1. **Expo Go** di iPhone (App Store, versi SDK 52): `npx expo start`, pindai QR dengan kamera. Cukup untuk menguji
   seluruh alur (login, WO, PM, approval); push tidak tersedia di Expo Go iOS.
2. **EAS build iOS** (`npx eas-cli@16 build --platform ios --profile preview`): membutuhkan akun Apple Developer
   (berbayar) dan perangkat terdaftar / TestFlight. Tidak memerlukan Mac karena build berjalan di cloud EAS.

### Android lewat Expo Go


1. Pasang **Expo Go** versi yang mendukung **SDK 52** di HP (Expo Go terbaru di Play Store mungkin sudah untuk SDK
   lebih baru — unduh versi SDK 52 dari https://expo.dev/go bila perlu).
2. HP dan komputer dalam satu jaringan, lalu `npx expo start` dan pindai QR code.

Batasan Expo Go: notifikasi push memerlukan `projectId` EAS (lihat §3) dan saluran notifikasi dibuat di dalam
aplikasi Expo Go, sehingga perilaku **alarm** (bunyi di stream alarm, tembus mode Jangan Ganggu) tidak bisa
diandalkan. Untuk menguji push & alarm gunakan APK (§4).

### Development build (opsional)

Bila perlu debug native (push, alarm) dengan hot reload:

```bash
npx expo install expo-dev-client
npx eas-cli@16 build --profile development --platform android   # tambahkan profil "development" di eas.json:
# "development": { "developmentClient": true, "distribution": "internal", "android": { "buildType": "apk" } }
npx expo start --dev-client
```

Atau build lokal (butuh Android Studio/SDK + JDK 17): `npx expo run:android`.

## 3. EAS projectId (wajib untuk push)

Token push Expo (`ExponentPushToken[...]`) hanya bisa dibuat bila `expo.extra.eas.projectId` terisi.
Di repo ini nilainya masih placeholder kosong:

```jsonc
// app.json
"extra": { "eas": { "projectId": "" } }
```

Isi dengan:

```bash
npx eas-cli@16 login          # akun Expo organisasi
npx eas-cli@16 init           # membuat proyek "pm-app-inl" & menulis projectId ke app.json
```

Selama `projectId` kosong (atau berjalan di emulator), aplikasi **melewati** pendaftaran push dengan
`console.warn` — fitur lain tetap berjalan. Backend (`pm-api`) membutuhkan `EXPO_ACCESS_TOKEN` untuk mengirim push.

> `eas-cli` versi terbaru mensyaratkan Node 20+. Dengan Node 18 gunakan `npx eas-cli@16 ...`.

## 4. Build APK dengan EAS (cloud)

`eas.json` sudah berisi profil `preview` dan `production` (keduanya menghasilkan **APK** untuk distribusi internal,
dengan `EXPO_PUBLIC_PM_API_URL` produksi):

```bash
npx eas-cli@16 build --platform android --profile preview
```

Unduh APK dari tautan yang diberikan EAS lalu pasang di HP (izinkan "Instal dari sumber tidak dikenal").
Untuk Google Play ubah `buildType` profil `production` menjadi `app-bundle`. Setiap rilis baru, naikkan
`expo.version` dan `expo.android.versionCode` di `app.json`.

Identitas aplikasi: nama **PrevenTech**, package `id.co.inl.pmapp`, scheme deep link `pmapp://`.

## 5. Autentikasi

- Login: **Email atau NRK** + password Portal → `POST /auth/mobile/login` dengan `device_name` = model HP.
  Bila akun memakai TOTP, layar kode 6 digit → `POST /auth/mobile/totp`.
- Token permanen per perangkat disimpan di SecureStore. Setiap request mengirim `Authorization: Bearer` dan
  `Accept: application/json`. Respon `401` (token dicabut / user dinonaktifkan) → sesi lokal dihapus dan kembali ke login.
- Keluar: `DELETE /push-subscriptions` (best-effort) → `POST /auth/logout` → hapus penyimpanan lokal.

## 6. Notifikasi & alarm

Saat login dan setiap aplikasi dibuka dengan token tersimpan, aplikasi:

1. Membuat saluran notifikasi Android:
   | Channel | Untuk | Pengaturan |
   |---|---|---|
   | `alarm` — "Alarm (WO Tinggi, PM & Persetujuan)" | WO Tinggi baru/ditugaskan, WO ditolak pemohon, `pm_task.upcoming` / `pm_task.due` / `pm_task.overdue`, `approval.reminder`, `service_request.rejected`, `service_request.revision_requested` | importance **MAX**, getar panjang, `bypassDnd`, tampil di layar kunci (PUBLIC), suara default diputar sebagai **alarm** |
   | `default` — "Notifikasi Umum" | event lain | importance DEFAULT |
2. Meminta izin notifikasi (Android 13+), mengambil Expo push token, lalu `POST /push-subscriptions
   { channel: "expo", token, device_name }`.

Backend memilih `channelId` = `alarm`/`default` dan mengirim
`data = { event, document_type, document_id, work_order_id?, service_request_id?, pm_task_id?, work_program_id? }`.
Mengetuk notifikasi (aplikasi di depan, di belakang, maupun tertutup) — juga item di daftar notifikasi tab Akun —
membuka **Detail WO** bila `document_type = work_order`, **Detail Form Request** bila `service_request`, **Tugas PM**
bila `pm_task`, atau **Detail Program Kerja** bila `work_program` (fallback ke `work_program_id` / `pm_task_id` /
`service_request_id` / `work_order_id` bila tipe tidak dikirim). Notifikasi yang masuk saat aplikasi terbuka tetap
ditampilkan dan daftar WO, Form Request, Persetujuan, program kerja, serta daftar & badge PM dimuat ulang.

Penting tentang alarm:

- Pengaturan channel Android (importance, suara, getar, bypass DND) **tidak bisa diubah** setelah dibuat — hanya
  nama & deskripsinya yang ikut diperbarui. Bila konfigurasi lain diubah di kode, pengguna harus menghapus
  data/instal ulang aplikasi (atau ganti ID channel).
- `bypassDnd` hanya berlaku bila pengguna memberi akses "Jangan Ganggu" — tersedia tombol
  **Akun → "Izinkan alarm berbunyi saat mode Jangan Ganggu"**.
- Beberapa merek HP (Xiaomi, Oppo, Vivo, dll.) mematikan notifikasi aplikasi yang dihentikan paksa. Minta teknisi
  mengizinkan *autostart* dan menonaktifkan optimasi baterai untuk PrevenTech.
- Tab **Akun** menampilkan status push dan tombol "Daftar Ulang" bila notifikasi belum aktif.

## 7. Form Request & Persetujuan

Navigasi tab: **WO** (sakelar *Pool* / *Tugas Saya*) · **PM** — keduanya khusus anggota unit pelaksana ·
**Pengajuan** (sakelar *Work Order* / *Form Request*, `scope=mine`) · **Aktivitas** (selalu tampil, lihat §9) ·
**Persetujuan** (selalu tampil) · **Akun**. Pool dan Tugas Saya digabung dalam satu tab; staf non-pelaksana melihat
empat tab, staf unit pelaksana enam tab.

- **Persetujuan** — `GET /approvals/pending` (urut terlama dulu): nomor, jenis dokumen, judul, pemohon, langkah,
  prioritas, menunggu sejak, label merah **"Lewat 24 jam"** bila `overdue`. Badge tab dari
  `/approvals/pending-count` (diperbarui tiap 60 detik & setelah setiap aksi).
- **Buat / Ubah Request** — identitas otomatis dari profil (read-only), Office (`/offices`), Divisi Pelaksana
  (`/executor-units?for=request`) → Jenis Permintaan, Prioritas Tinggi/Sedang/Rendah, Keperluan, Estimasi Biaya
  (opsional), Atasan YBS (default `/users/my-superior`, bisa diganti lewat pencarian `/users/superior-candidates`),
  blok *Petunjuk dan Aturan* unit, lampiran foto (kamera/galeri) atau PDF. Tombol **Simpan Draf** dan
  **Simpan & Ajukan** (simpan → unggah lampiran → `POST /submit { superior_id }`).
- **Detail Request** — ringkasan + catatan revisi/penolakan, Permintaan, Keterangan, blok **PENGESAHAN**
  (YANG BERSANGKUTAN / ATASAN YBS / MGR/SPV DIVISI / FOREMAN DIVISI: "Diminta/Disetujui/Diselesaikan oleh … pada …",
  NO. HP, status, catatan, tautan verifikasi QR; putaran sebelum revisi dapat dibuka/tutup), Petunjuk dan Aturan,
  Identitas, Lampiran, Riwayat, tombol **PDF** di header.
- Action bar hanya dari `permissions`: Ubah, Hapus, Ajukan, Batalkan (alasan), Ganti Atasan, Setujui (catatan
  opsional; pada langkah `executor_lead` bisa *Tunjuk pelaksana* dari `/executor-units/{id}/staff`), Tolak & Minta
  Revisi (catatan wajib), Selesaikan (keterangan wajib), Alihkan ke WO (alasan), Tambah Lampiran.
- **Detail WO** — bila `permissions.can_convert`, tombol **Alihkan ke Form Request** (alasan) →
  `POST /work-orders/{id}/convert-to-request`. Status `converted` dan tautan request hasil/asal pengalihan ditampilkan.

## 8. Preventive Maintenance (tugas PM)

- **Tab PM** (hanya bila `me.executor_units` tidak kosong) — sakelar **Tugas Saya** (`scope=mine`) / **Unit**
  (`scope=unit`); chip status *multi-pilih* (Semua, Jatuh Tempo, Terlambat, Dikerjakan, Terjadwal, Selesai, Dilewati)
  dengan bawaan Jatuh Tempo + Terlambat + Dikerjakan; pencarian alat/jadwal; infinite scroll urut `due_at`.
  Badge tab = `mine.due + mine.overdue` dari `GET /pm-tasks/summary` (tiap 60 detik & setelah setiap aksi).
  Kartu: nomor, status (Terjadwal abu-biru, Jatuh Tempo kuning, Dikerjakan biru, Selesai hijau, Terlambat merah,
  Dilewati abu), alat + lokasi, jadwal + frekuensi, jatuh tempo dengan petunjuk relatif ("2 jam lagi",
  "lewat 3 jam" = masih dalam toleransi, "terlambat 1 hari"), PIC, penanda usulan lewati & jumlah temuan.
- **Detail tugas** (`pm-tasks/[id]`) — info alat/jadwal/jatuh tempo/batas toleransi/PIC/estimasi + tautan
  **Riwayat alat**.
  - *Belum dimulai*: pratinjau checklist (read-only) + **Mulai Kerjakan** (hanya saat JATUH TEMPO/TERLAMBAT).
  - *Dikerjakan*: butir dikelompokkan per seksi. `ok_nok_na` → tiga tombol besar **OK / Tidak OK / N/A**;
    `number` → keypad angka + satuan + petunjuk batas min–max, bingkai hijau (dalam batas) / merah (di luar batas);
    `text` → isian multi-baris; tombol N/A kecil untuk tipe angka/teks; catatan muncul otomatis saat Tidak OK;
    tanda `*` untuk butir wajib dan label **Foto wajib**. Foto per butir lewat **kamera** (galeri sebagai pilihan
    kedua), maks 5 per butir; foto umum tugas maks 10.
  - **Simpan otomatis**: perubahan dikirim ±0,8 detik setelah berhenti mengetik (`PUT /pm-tasks/{id}/items`, hanya
    butir yang berubah). Bilah atas menampilkan progres "x/y butir" dan status **Menyimpan… / Tersimpan / Gagal
    menyimpan** (dicoba ulang otomatis tiap ±6 detik, saat aplikasi ke latar belakang, dan saat keluar layar).
  - **Buat WO dari temuan**: pada butir Tidak OK → pilih unit (bawaan unit tugas), kategori, prioritas, uraian
    terisi "Temuan PM {nomor}: {butir} — {catatan}" → `POST /pm-tasks/{id}/items/{itemId}/work-order`; nomor WO
    lalu tampil sebagai tautan ke detail WO.
  - **Material** (editor yang sama dengan WO, tombol *Simpan Material*) dan **Selesaikan** (durasi menit terisi dari
    waktu mulai → sekarang, catatan). Error `422` berkunci `items.{id}` ditandai pada butirnya dan layar menggulir ke
    butir pertama yang bermasalah.
  - Aksi lain sesuai `permissions`: **Usulkan Lewati** (alasan), spanduk usulan lewati, **Lewati** (pimpinan; alasan
    terisi dari usulan), **Ganti PIC** (pimpinan; daftar staf unit).
  - *Selesai / Dilewati*: hasil read-only, temuan disorot merah dengan tautan WO, foto, material, riwayat.
- **Riwayat alat** (`equipment/[id]/history`) — kartu alat (`GET /equipment/{id}`: lokasi, unit, merek/model,
  WO terbuka, jadwal aktif, PM berikutnya/terakhir) + daftar `GET /equipment/{id}/history` (ikon jenis PM/WO,
  nomor, tanggal, status, judul, pelaku, jumlah temuan, penanda terlambat); ketuk → detail tugas PM / WO.
- **Detail WO** menampilkan "Dari temuan PM-… — …" (`source_pm_task`) yang membuka tugas PM asal.

## 9. Aktivitas Harian & Program Kerja Tahunan

Kontrak: `../docs/API_PROGRAM_ACTIVITY.md`. Visibilitas mengikuti pohon organisasi Portal (staf: milik sendiri;
pimpinan BOM..BOM-3: subtree; admin: semua) dan ditentukan server lewat `meta` / `permissions`.

- **Tab Aktivitas** (`(tabs)/activities`, semua pengguna): `GET /daily-activities`. Sakelar *Saya / Tim / Semua*
  hanya tampil bila `meta.available_scopes` lebih dari satu; chip status **multi-pilih** *Semua / OPEN / ON PROGRESS /
  CLOSED* (bawaan **OPEN + ON PROGRESS** → `status=open,on_progress`; *Semua* = tanpa parameter `status`). Periode
  hanya membatasi laporan *closed* (laporan open / on progress selalu ditampilkan), sehingga navigator bulan (bawaan
  bulan ini WIB, ketuk nama bulan untuk kembali ke bulan ini) dan parameter `year` + `month` hanya ada bila pilihan
  mencakup CLOSED atau *Semua*; selain itu navigator disembunyikan dan diganti petunjuk satu baris. Chip minggu
  *Semua, M1..M5* (`week`) berlaku pada kedua mode; pencarian; ringkasan **Total / Open / On Progress / Closed** dari
  `meta.summary` (mengikuti filter aktif); daftar infinite scroll + tarik untuk memuat ulang. Kartu: tanggal + chip
  minggu, judul, status, PIC (bila scope bukan *Saya*), uraian 2 baris, kegiatan program terkait, tag **WO <nomor>**
  bila laporan dibuat otomatis dari penyelesaian WO (`work_order`), waktu unggah. Tombol **Tambah Aktivitas** dan
  tombol header **Program Kerja**.
- **Tambah / Ubah Aktivitas** (`activities/new`, `activities/new?id=`): Tanggal Kegiatan (pemilih tanggal), Laporan
  Kegiatan (≤250), Uraian, Tindak Lanjut, Kendala, Status awal (hanya saat membuat), **Atas nama** (pemilih
  `/daily-activities/people`, hanya bila `meta.can_report_for_others`). Dari lembar kegiatan program kerja tersedia
  **Catat Aktivitas Harian** yang membuka form ini dengan `?program_activity_id=` (dikirim sebagai
  `work_program_activity_id`). Simpan → `POST` / `PUT`, toast, kembali, daftar dimuat ulang. Konfirmasi bila keluar
  dengan isian belum tersimpan.
- **Detail Aktivitas** (`activities/[id]`): semua isian, kartu **Dari Work Order** (nomor, uraian permintaan, status
  WO, keterangan bahwa laporan dibuat otomatis saat WO diselesaikan; ketuk → `work-orders/[id]`), kartu kegiatan
  program kerja (ketuk → detail program), riwayat (`logs`). Aksi dari `permissions`: **Update Status** (status baru +
  catatan → `POST /status`), **Ubah**, **Hapus** (konfirmasi → `DELETE`).
- **Program Kerja** (`programs`): chip tahun dari `meta.years` (bawaan `meta.year`), kartu program: kode, judul,
  unit, status, progress %, jumlah sub-item / kegiatan, hitungan status.
- **Detail Program** (`programs/[id]`): header program + progress + hitungan; chip sub-item (*Semua* atau satu
  sub-item); setiap kegiatan: nomor, judul, chip PIC (utama terisi, pendukung redup, "(Anda)" bila saya), target /
  closed, status, bar progress, remarks; riwayat program. Ketuk kegiatan → lembar bawah: detail lengkap dan, bila
  `permissions.can_update_progress` / `can_change_status`, **Update Progress** (stepper ±10 atau ketik 0-100 +
  remarks → `PUT /work-program-activities/{id}`) dan **Ubah Status** (Open / On Progress / Closed / Dibatalkan +
  catatan → `POST .../status`). Setelah sukses, kegiatan di cache detail diganti lalu program & daftar dimuat ulang
  (rata-rata progress dihitung server). Tanpa izin, lembar bersifat baca saja. Pembuatan / pengubahan program,
  sub-item, kegiatan dan PIC hanya di aplikasi web.

## 10. Struktur

```
app/
  _layout.tsx              Provider (React Query, Auth), gerbang login, routing tap notifikasi
  index.tsx                Redirect awal (tab WO untuk staf pelaksana, Pengajuan untuk lainnya)
  (auth)/login.tsx, totp.tsx
  (tabs)/work.tsx          "WO": sakelar Pool (scope=pool) / Tugas Saya (scope=assigned) — staf pelaksana
  (tabs)/pm.tsx            "PM": tugas PM saya / unit — staf pelaksana
  (tabs)/mine.tsx          "Pengajuan": sakelar WO / Form Request (scope=mine)
  (tabs)/activities.tsx    "Aktivitas": laporan kegiatan harian (scope mine/team/all, bulan, minggu)
  (tabs)/approvals.tsx     "Persetujuan": /approvals/pending
  (tabs)/account.tsx       profil, status push, daftar notifikasi, keluar
  work-orders/new.tsx      form buat WO + unggah foto
  work-orders/[id]/index.tsx     detail + action bar berbasis `permissions`
  work-orders/[id]/complete.tsx  pekerjaan selesai, material, pekerja, clearance (Simpan Draf / Selesai)
  requests/new.tsx, requests/[id]/edit.tsx   form Form Request (Simpan Draf / Simpan & Ajukan)
  requests/[id]/index.tsx  detail Form Request + PENGESAHAN + action bar berbasis `permissions`
  pm-tasks/[id]/index.tsx  detail tugas PM + pengisian checklist (simpan otomatis)
  equipment/[id]/history.tsx  riwayat maintenance per alat (PM + WO)
  activities/new.tsx       form tambah (POST) / ubah (?id= → PUT) aktivitas harian
  activities/[id].tsx      detail aktivitas + Update Status / Ubah / Hapus berbasis `permissions`
  programs/index.tsx       daftar program kerja per tahun
  programs/[id].tsx        detail program: sub-item, kegiatan, lembar update progress / status (PIC)
src/
  auth/AuthContext.tsx     sesi, login/TOTP/logout
  lib/api.ts               klien HTTP (ApiError, 401 handler) · endpoints.ts (semua endpoint bertipe)
  lib/push.ts              channel, izin, token, (un)subscribe · download.ts (PDF/lampiran → share)
  lib/photos.ts            kamera/galeri/PDF & unggah lampiran · format.ts (tanggal WIB, durasi, Rupiah)
  lib/documents.ts         routing notifikasi/approval → WO, Form Request, tugas PM atau program kerja
  lib/pm.ts                aturan checklist (penilaian angka, kelengkapan, payload simpan), petunjuk jatuh tempo
  hooks/useChecklistAutosave.ts   draf butir + simpan otomatis ter-debounce · usePmTask.ts
  hooks/useDailyActivity.ts   detail aktivitas, meta scope/izin, sinkronisasi cache · useWorkProgram.ts
  components/              UI (tombol besar, chip, modal), PagedList, ActionBar, Timeline, MaterialsEditor,
                           StaffRadioList, DateTimeField (mode datetime / date), kartu & daftar
  components/request/      RequestForm, ApprovalSteps (PENGESAHAN), SuperiorModal, RulesBlock
  components/workorder/    modal aksi WO, lampiran (AttachmentGrid dengan header Authorization)
  components/pm/           PmTaskCard/List, ChecklistItemCard, ChecklistReadOnly, FindingWorkOrderModal, TaskModals
  components/activity/     ActivityCard, ActivitySummary, MonthNavigator, ActivityStatusModal
  components/program/      ProgramCard (+CountChips), ProgramActivityRow (+PicChips), ProgramActivitySheet, ProgressBar
```

Tombol aksi di detail WO hanya muncul sesuai `permissions` dari server (`can_pick`, `can_receive`, `can_reassign`,
`can_start`, `can_work`/`can_complete`, `can_accept`, `can_cancel`, `can_upload`). Setelah aksi berhasil, cache detail
diganti dengan `data` dari respon dan semua daftar WO dimuat ulang. Pola yang sama berlaku untuk Form Request
(cache detail diganti; daftar request, persetujuan, dan WO di-invalidate).
