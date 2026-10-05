# PM-App INL — Aplikasi Android (Work Order & Form Request)

Aplikasi Android PM-App PT Industri Nabati Lestari:

- **Work Order** (FM-BOPS-10/05) — teknisi di lapangan mengambil/mengerjakan WO, karyawan mengajukan WO.
- **Form Request** (INLHO/BSIS-ITC/F-004) — permintaan yang memerlukan biaya/persetujuan, dengan rantai
  persetujuan Atasan YBS → Mgr/Spv Divisi → Foreman Divisi, serta tab **Persetujuan** untuk approver.
- Notifikasi push & alarm (WO prioritas Tinggi, pengingat persetujuan > 24 jam, request ditolak/minta revisi).

Kontrak API yang diikuti: `../docs/API_WORK_ORDER.md` dan `../docs/API_SERVICE_REQUEST.md`.

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

## 2. Menjalankan di perangkat Android

### a. Expo Go (paling cepat, untuk UI & alur)

1. Pasang **Expo Go** versi yang mendukung **SDK 52** di HP (Expo Go terbaru di Play Store mungkin sudah untuk SDK
   lebih baru — unduh versi SDK 52 dari https://expo.dev/go bila perlu).
2. HP dan komputer dalam satu jaringan, lalu `npx expo start` dan pindai QR code.

Batasan Expo Go: notifikasi push memerlukan `projectId` EAS (lihat §3) dan saluran notifikasi dibuat di dalam
aplikasi Expo Go, sehingga perilaku **alarm** (bunyi di stream alarm, tembus mode Jangan Ganggu) tidak bisa
diandalkan. Untuk menguji push & alarm gunakan APK (§4).

### b. Development build (opsional)

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

## 4. Build APK dengan EAS

`eas.json` sudah berisi profil `preview` dan `production` (keduanya menghasilkan **APK** untuk distribusi internal,
dengan `EXPO_PUBLIC_PM_API_URL` produksi):

```bash
npx eas-cli@16 build --platform android --profile preview
```

Unduh APK dari tautan yang diberikan EAS lalu pasang di HP (izinkan "Instal dari sumber tidak dikenal").
Untuk Google Play ubah `buildType` profil `production` menjadi `app-bundle`. Setiap rilis baru, naikkan
`expo.version` dan `expo.android.versionCode` di `app.json`.

Identitas aplikasi: nama **PM-App INL**, package `id.co.inl.pmapp`, scheme deep link `pmapp://`.

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
   | `alarm` — "Alarm (WO Tinggi & Persetujuan)" | WO Tinggi baru/ditugaskan, WO ditolak pemohon, `approval.reminder`, `service_request.rejected`, `service_request.revision_requested` | importance **MAX**, getar panjang, `bypassDnd`, tampil di layar kunci (PUBLIC), suara default diputar sebagai **alarm** |
   | `default` — "Notifikasi Umum" | event lain | importance DEFAULT |
2. Meminta izin notifikasi (Android 13+), mengambil Expo push token, lalu `POST /push-subscriptions
   { channel: "expo", token, device_name }`.

Backend memilih `channelId` = `alarm`/`default` dan mengirim
`data = { event, document_type, document_id, work_order_id?, service_request_id? }`. Mengetuk notifikasi (aplikasi di
depan, di belakang, maupun tertutup) — juga item di daftar notifikasi tab Akun — membuka **Detail WO** bila
`document_type = work_order` atau **Detail Form Request** bila `service_request` (fallback ke `work_order_id` /
`service_request_id` untuk payload lama). Notifikasi yang masuk saat aplikasi terbuka tetap ditampilkan dan daftar
WO, Form Request, serta Persetujuan dimuat ulang.

Penting tentang alarm:

- Pengaturan channel Android **tidak bisa diubah** setelah dibuat. Bila konfigurasi channel diubah di kode,
  pengguna harus menghapus data/instal ulang aplikasi (atau ganti ID channel).
- `bypassDnd` hanya berlaku bila pengguna memberi akses "Jangan Ganggu" — tersedia tombol
  **Akun → "Izinkan alarm berbunyi saat mode Jangan Ganggu"**.
- Beberapa merek HP (Xiaomi, Oppo, Vivo, dll.) mematikan notifikasi aplikasi yang dihentikan paksa. Minta teknisi
  mengizinkan *autostart* dan menonaktifkan optimasi baterai untuk PM-App.
- Tab **Akun** menampilkan status push dan tombol "Daftar Ulang" bila notifikasi belum aktif.

## 7. Form Request & Persetujuan

Navigasi tab: **Pool** · **Tugas Saya** (khusus anggota unit pelaksana) · **Pengajuan** (sakelar *Work Order* /
*Form Request*, `scope=mine`) · **Persetujuan** (selalu tampil) · **Akun**.

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

## 8. Struktur

```
app/
  _layout.tsx              Provider (React Query, Auth), gerbang login, routing tap notifikasi
  index.tsx                Redirect awal (Pool untuk staf pelaksana, Pengajuan untuk lainnya)
  (auth)/login.tsx, totp.tsx
  (tabs)/pool.tsx          scope=pool   (hanya untuk anggota unit pelaksana)
  (tabs)/assigned.tsx      scope=assigned ("Tugas Saya", hanya untuk anggota unit pelaksana)
  (tabs)/mine.tsx          "Pengajuan": sakelar WO / Form Request (scope=mine)
  (tabs)/approvals.tsx     "Persetujuan": /approvals/pending
  (tabs)/account.tsx       profil, status push, daftar notifikasi, keluar
  work-orders/new.tsx      form buat WO + unggah foto
  work-orders/[id]/index.tsx     detail + action bar berbasis `permissions`
  work-orders/[id]/complete.tsx  pekerjaan selesai, material, pekerja, clearance (Simpan Draf / Selesai)
  requests/new.tsx, requests/[id]/edit.tsx   form Form Request (Simpan Draf / Simpan & Ajukan)
  requests/[id]/index.tsx  detail Form Request + PENGESAHAN + action bar berbasis `permissions`
src/
  auth/AuthContext.tsx     sesi, login/TOTP/logout
  lib/api.ts               klien HTTP (ApiError, 401 handler) · endpoints.ts (semua endpoint bertipe)
  lib/push.ts              channel, izin, token, (un)subscribe · download.ts (PDF/lampiran → share)
  lib/photos.ts            kamera/galeri/PDF & unggah lampiran · format.ts (tanggal WIB, durasi, Rupiah)
  lib/documents.ts         routing notifikasi/approval → WO atau Form Request
  components/              UI (tombol besar, chip, modal), PagedList, ActionBar, Timeline, kartu & daftar
  components/request/      RequestForm, ApprovalSteps (PENGESAHAN), SuperiorModal, ExecutorPicker, RulesBlock
  components/workorder/    modal aksi WO, lampiran
```

Tombol aksi di detail WO hanya muncul sesuai `permissions` dari server (`can_pick`, `can_receive`, `can_reassign`,
`can_start`, `can_work`/`can_complete`, `can_accept`, `can_cancel`, `can_upload`). Setelah aksi berhasil, cache detail
diganti dengan `data` dari respon dan semua daftar WO dimuat ulang. Pola yang sama berlaku untuk Form Request
(cache detail diganti; daftar request, persetujuan, dan WO di-invalidate).
