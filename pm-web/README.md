# pm-web — Frontend PM-App PT INL

Frontend web PM-App PT Industri Nabati Lestari:

- **Modul A — Work Order** (formulir FM-BOPS-10/05)
- **Modul B — Form Request** dengan rantai persetujuan (formulir INLHO/BSIS-ITC/F-004) dan kotak
  **Menunggu Persetujuan** generik

Dibangun dengan Next.js 14 (App Router) + TypeScript (strict) + Tailwind CSS 3 + komponen bergaya shadcn/ui,
React Query v5 untuk data, dan `date-fns` (locale `id`, zona waktu Asia/Jakarta).

Kontrak API yang diikuti: [`../docs/API_WORK_ORDER.md`](../docs/API_WORK_ORDER.md) dan
[`../docs/API_SERVICE_REQUEST.md`](../docs/API_SERVICE_REQUEST.md). Alur SSO: [`../docs/SSO.md`](../docs/SSO.md) §5a.

## Prasyarat

- Node.js **18.17+** (diuji dengan 18.18.2) dan npm 9+
- Backend `pm-api` (Laravel) yang bisa dijangkau dari server Next.js (default `http://127.0.0.1:8000`)
- Baris aplikasi PM-App terdaftar di Portal INTES (`auth_mode = sso`)

## Setup

```bash
cd pm-web
npm install
cp .env.example .env.local   # lalu sesuaikan nilainya
```

### Variabel lingkungan

| Variabel | Wajib | Keterangan |
|---|---|---|
| `BACKEND_URL` | ya | Target proxy `/api/*` dan `/sanctum/*` (Laravel). Default `http://127.0.0.1:8000`. Di Docker mis. `http://pm-be:8000`. **Dibaca saat `next build` dan saat `next dev` dimulai** (rewrites ikut ter-*bake* ke hasil build). |
| `NEXT_PUBLIC_PORTAL_APP_ID` | ya | UUID PM-App di tabel `aplikasi` Portal. Dipakai sebagai `app_id` bila URL dari Portal tidak membawa `appId`. |
| `NEXT_PUBLIC_PORTAL_LAUNCH_URL` | ya | URL launch Portal untuk aplikasi ini, mis. `https://portal.inl.co.id/launch?app_id=<uuid>`. Tujuan redirect bila belum login / sesi habis (401). Bila kosong, pengguna diarahkan ke `/akses-ditolak`. |
| `NEXT_PUBLIC_PORTAL_HOME_URL` | ya | Beranda Portal; tujuan setelah logout. |

Semua `NEXT_PUBLIC_*` di-*inline* saat build — ubah nilainya berarti build ulang.

## Menjalankan

```bash
npm run dev        # http://localhost:3000 (backend harus jalan di BACKEND_URL)
npm run lint       # ESLint (next/core-web-vitals + next/typescript)
npx tsc --noEmit   # cek tipe
npm run build      # build produksi (tidak butuh backend berjalan)
```

Build memakai `output: "standalone"` (untuk container `pm-fe`). Menjalankan hasil build:

```bash
npm run build
cp -r .next/static .next/standalone/.next/static
# (salin juga folder public/ ke .next/standalone/public bila nanti ditambahkan)
PORT=3000 node .next/standalone/server.js
```

`npm run start` (`next start`) tetap bisa dipakai untuk uji lokal, tetapi Next.js akan menampilkan peringatan
karena konfigurasi standalone.

Karena halaman membutuhkan cookie sesi, membuka `http://localhost:3000` langsung akan diarahkan ke Portal
(atau `/akses-ditolak`). Untuk uji lokal, daftarkan URL `http://localhost:3000/` sebagai URL aplikasi di Portal
(lingkungan dev) lalu buka PM-App dari Portal.

## Cara kerja autentikasi

PM-App **tidak punya halaman login**. Pola sama dengan IDAS/Approver: token SSO sekali pakai dari Portal ditukar
menjadi sesi cookie Laravel Sanctum (SPA).

1. **Satu origin.** Browser hanya bicara ke origin Next.js. `next.config.mjs` mem-*proxy*
   `/api/:path*` → `${BACKEND_URL}/api/:path*` dan `/sanctum/:path*` → `${BACKEND_URL}/sanctum/:path*`,
   sehingga cookie `pm_app_session` dan `XSRF-TOKEN` adalah cookie first-party dan CORS tidak diperlukan.
2. **Dari Portal.** Portal mengarahkan ke `https://<pm-web>/?token=…&appId=…`. `src/middleware.ts` meneruskan
   setiap halaman yang membawa `?token=` (selain `/sso/verify`) ke `/sso/verify` dengan query string utuh.
3. **`/sso/verify`** (client): mengambil `token` & `appId` dari URL (dengan guard `useRef` agar token sekali
   pakai hanya dikirim sekali, termasuk di React StrictMode), memanggil `GET /sanctum/csrf-cookie`, lalu
   `POST /api/v1/auth/sso { token, app_id }` dengan header `X-XSRF-TOKEN`. Bila sukses, token dihapus dari URL
   (`history.replaceState`) dan pengguna diarahkan ke `/work-orders`. Bila gagal, pesan error + tombol kembali ke Portal.
4. **Halaman terproteksi.** Middleware mengecek keberadaan cookie `pm_app_session` untuk semua halaman kecuali
   `/sso/verify`, `/verifikasi/*`, `/akses-ditolak`, aset statis, dan path `/api` & `/sanctum`. Tanpa cookie →
   redirect ke `NEXT_PUBLIC_PORTAL_LAUNCH_URL` (atau `/akses-ditolak`). Validitas sesi sesungguhnya dicek backend:
   layout terproteksi memuat `GET /api/v1/auth/me`.
5. **Klien API** (`src/lib/api.ts`): `fetch` dengan `credentials: "include"` dan `Accept: application/json`;
   untuk method non-GET mengirim `X-XSRF-TOKEN` = `decodeURIComponent(cookie XSRF-TOKEN)` (mengambil
   `/sanctum/csrf-cookie` dulu bila cookie belum ada, dan mencoba ulang sekali bila mendapat `419`). Body JSON atau
   `FormData`. Error dilempar sebagai `ApiError { status, message, errors }`. Respons **401** → browser diarahkan ke
   URL launch Portal.
6. **Logout** (menu pengguna): `POST /api/v1/auth/logout` lalu `window.location.href = NEXT_PUBLIC_PORTAL_HOME_URL`.
   Sesi Portal tetap hidup (Portal tidak mendukung single logout; PM-App tidak boleh memanggil logout Portal).

### Konfigurasi backend yang dibutuhkan

Agar sesi cookie berjalan lewat proxy, `pm-api` perlu (lihat `docs/SSO.md` §6):

- `SESSION_COOKIE=pm_app_session` (nama cookie yang dicek middleware)
- `SANCTUM_STATEFUL_DOMAINS` berisi host pm-web (mis. `pm.inl.co.id`; untuk dev `localhost:3000`)
- `SESSION_DOMAIN` sesuai host pm-web (untuk dev biarkan `null`), `SESSION_SECURE_COOKIE=false` bila dev tanpa HTTPS
- URL lampiran (`/api/v1/attachments/{id}`) dan PDF dilayani lewat path relatif yang sama sehingga cookie ikut terkirim

## Halaman

| Path | Akses | Isi |
|---|---|---|
| `/` | login | redirect ke `/work-orders` |
| `/work-orders` | login | Daftar WO: tab scope (WO Saya, Unit Saya, Pool, Ditugaskan ke Saya, Unit Pelaksana, Semua), filter (status, prioritas, unit pelaksana, kategori, rentang tanggal, pencarian), state di URL, tabel (desktop) / kartu (HP), paginasi, Export Excel, Buat WO |
| `/work-orders/new` | login | Form buat WO + unggah foto (`photo_before`) |
| `/work-orders/[id]` | login | Detail WO, tombol aksi berdasarkan `permissions`, panel penyelesaian teknisi, lampiran, pengesahan, riwayat, Cetak PDF |
| `/work-orders/[id]/edit` | login (`can_update`) | Form ubah WO |
| `/requests` | login | Daftar Form Request: tab Saya, Unit Saya, Unit Pelaksana, Semua; filter (status, prioritas, unit pelaksana, jenis permintaan, office, rentang tanggal, pencarian) di URL; kolom langkah persetujuan saat ini; paginasi; Export Excel |
| `/requests/new` | login | Form Request baru: identitas (read-only dari profil), office, unit pelaksana → jenis permintaan, prioritas, keperluan, estimasi biaya (Rupiah), atasan (default dari Portal, bisa diganti), pratinjau Petunjuk & Aturan, lampiran. Tombol "Simpan Draf" dan "Simpan & Ajukan" |
| `/requests/[id]` | login | Detail: blok PENGESAHAN seperti formulir kertas (+ putaran sebelumnya), Keperluan, Jenis Permintaan, Keterangan, Petunjuk & Aturan, Identitas, tautan WO sumber/hasil pengalihan, lampiran, riwayat. Aksi berdasar `permissions`: Ajukan, Setujui (+ tunjuk pelaksana di langkah pimpinan), Tolak, Minta Revisi, Selesaikan, Alihkan ke WO, Ganti Atasan, Ubah, Batalkan, Hapus, Cetak PDF |
| `/requests/[id]/edit` | login (`can_update`) | Form ubah draf (menampilkan catatan revisi terakhir) |
| `/approvals` | login | Menunggu Persetujuan Saya (`/approvals/pending`): kartu per dokumen, badge merah "Lewat 24 jam" |
| `/sso/verify` | publik | Penukaran token SSO Portal → sesi |
| `/verifikasi/[token]` | publik | Verifikasi tanda tangan elektronik dari QR di PDF |
| `/akses-ditolak` | publik | Informasi belum login / sesi berakhir |

Tab yang berkaitan dengan unit pelaksana hanya tampil bila `me.executor_units` tidak kosong: "Pool", "Ditugaskan ke Saya",
dan "Unit Pelaksana" untuk WO, serta "Unit Pelaksana" untuk Form Request. Tab "Semua" hanya untuk role `admin`/`management`.
Tombol aksi di detail **hanya** mengikuti `permissions` dari server.

Sidebar memuat menu Work Order, Form Request, dan "Menunggu Persetujuan". Badge di menu "Menunggu Persetujuan" berasal dari
`GET /approvals/pending-count` (polling 60 detik). Detail WO menampilkan tombol "Alihkan ke Form Request" bila
`permissions.can_convert`. Setelah berhasil, pengguna diarahkan ke Form Request draf yang baru dibuat. Notifikasi
diarahkan berdasarkan `document_type`/`document_id`: `service_request` → `/requests/{id}`, `work_order` → `/work-orders/{id}`.

## Struktur folder

```
src/
  middleware.ts                 redirect ?token → /sso/verify, guard cookie sesi
  app/
    (app)/                      area terproteksi (AppShell: sidebar, topbar, notifikasi, menu user)
      work-orders/              daftar, new, [id], [id]/edit
      requests/                 daftar, new, [id], [id]/edit (Form Request)
      approvals/                Menunggu Persetujuan Saya
    sso/verify/                 penukaran token SSO
    verifikasi/[token]/         verifikasi QR publik
    akses-ditolak/
  components/
    ui/                         komponen dasar gaya shadcn (button, input, dialog, sheet, dropdown, tabs, currency, ...)
    common/                     combobox async, search box, dialog konfirmasi/alasan, paginasi, badge status,
                                section, lampiran, file picker, pengesahan, riwayat, state kosong/error
    layout/                     app shell, sidebar (+ badge persetujuan), bell notifikasi, menu user, konteks user
    work-orders/                list, filter, form WO
      detail/                   header, action bar, dialog aksi, panel penyelesaian, section detail
    service-requests/           list, filter, form, identitas, combobox atasan, petunjuk & aturan
      detail/                   header, blok PENGESAHAN, action bar, dialog (ajukan/ganti atasan/setujui), section
    approvals/                  daftar Menunggu Persetujuan
  hooks/                        useMe, lookup, state list di URL, aksi dokumen, approvals, debounce, object URL
  lib/                          api client, endpoint helper (auth, work-orders, service-requests, approvals, lookups,
                                attachments, notifications, public), validasi 422, format tanggal/Rupiah
  types/                        tipe TypeScript sesuai kontrak API
```

## Catatan & keterbatasan

- Label status/prioritas pada data memakai `*_label` dari server; label statis di `src/lib/constants.ts` hanya untuk
  opsi filter sebelum data dimuat.
- Waktu ditampilkan dalam Asia/Jakarta. Input `datetime-local` (jam kerja pekerja) diartikan sebagai WIB dan dikirim
  sebagai ISO-8601 `+07:00`.
- Form Request: "Simpan & Ajukan" menyimpan draf, mengunggah lampiran, lalu memanggil `/submit`. Bila pengajuan gagal,
  draf tetap tersimpan dan pengguna diarahkan ke detail untuk mengajukan ulang. Lampiran gambar dikirim sebagai
  `photo_before` dan PDF sebagai `document`. Batas 10 lampiran di sisi klien mengikuti aturan WO, karena kontrak
  Form Request tidak menyebut batasnya.
- Notifikasi dan badge persetujuan hanya polling 60 detik (belum ada Web Push/PWA).
- Belum ada pengujian otomatis (unit/E2E) untuk frontend.
