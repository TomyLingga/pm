# PRD — PM-App PT INL

## 1. Tujuan
Memonitor pekerjaan divisi support dan menjadwalkan preventive maintenance,
menggantikan formulir kertas FM-BOPS-10/05 (Work Order) dan INLHO/BSIS-ITC/F-004 (Form Request).

## 2. Role
- **User/Pemohon** — karyawan yang mengajukan WO / Request
- **Atasan YBS** — atasan langsung pemohon (approve Form Request)
- **Mgr/Spv Divisi Pelaksana** — kepala divisi support (IT/MTC/GA); approve request, assign teknisi, membuat jadwal PM
- **Teknisi / Foreman Divisi** — mengerjakan WO, request, dan PM
- **Admin** — kelola master data & user
- Satu user bisa punya lebih dari satu role. Atasan diambil dari master karyawan (field atasan_id).
- Identitas user (NRK, nama, email, divisi, jabatan, atasan) berasal dari Portal INTES via SSO.
  Aplikasi hanya menyimpan salinan profil (di-update setiap login) + role lokal aplikasi ini.
- Logout di aplikasi ini mengarahkan ke logout portal (single logout) bila portal mendukung.

## 3. Master Data
- Divisi, Departemen, Section, Lokasi (Function Location), Office (Head Office/Pabrik/dst)
- Karyawan: NRK, nama, jabatan, status karyawan, divisi, departemen, atasan, email, no HP
- Divisi Pelaksana (support): Sistem & IT, Maintenance, General Affair, … (bisa ditambah)
- Equipment/Aset: No. Alat, Nama Alat, kategori, lokasi, divisi penanggung jawab, status
- Material/Sparepart: kode, nama, satuan
- Template checklist PM (per jenis equipment)

## 4. Modul A — Work Order (berdasarkan FM-BOPS-10/05)
Untuk troubleshoot/support, TANPA approval atasan.

Field:
- No. WO (auto, format: WO/{KODE_DIVISI}/{BULAN_ROMAWI}/{TAHUN}/{urut 4 digit})
- Tanggal terbit, Department/Section pemohon
- Divisi pelaksana tujuan (IT/MTC/GA/…)
- Kategori: Mechanical / Electrical / Fabrikasi / Lain-lain (isian bebas)
- No. Alat & Nama Alat (pilih dari master equipment, boleh kosong), Lokasi
- Permintaan Pekerjaan (deskripsi), lampiran foto
- Prioritas: Tinggi / Menengah / Rendah
- Pekerjaan Perbaikan Selesai (diisi teknisi)
- Keterangan Material: list (material, jumlah, satuan)
- Pekerja: list (nama teknisi, jam mulai, jam selesai) → durasi otomatis
- Maintenance Clearance Checklist (2 item: "Area bersih", "Tidak ada tools/material tertinggal"),
  masing-masing OK/TDK + konfirmasi MTC (nama, tanggal) + konfirmasi User (nama, tanggal)
- Penerimaan Pengguna: Yes/No (+ alasan bila No → WO kembali ke teknisi)
- Total Breakdown (jam), Remarks

Alur status:
DIAJUKAN (User) → DITERIMA (MTC, isi waktu terima & assign teknisi) → DIKERJAKAN
→ SELESAI (MTC In Charge, isi pekerjaan selesai, material, pekerja, clearance MTC)
→ DITERIMA_USER (User In Charge, clearance user, acceptance Yes) → CLOSED
Bila acceptance = No → kembali ke DIKERJAKAN. Bisa DIBATALKAN oleh pemohon sebelum DITERIMA.

## 5. Modul B — Form Request (berdasarkan INLHO/BSIS-ITC/F-004)
Untuk permintaan yang perlu biaya (laptop, mouse, akses, dll). WAJIB approval.

Field:
- No. Request (auto, format: REQ{urut 4 digit}/{Nama Divisi Pelaksana}/{BULAN_ROMAWI}/{TAHUN},
  contoh REQ0001/Sistem dan IT/IX/2026; nomor urut reset per tahun per divisi)
- Office, Keperluan (deskripsi), Jenis Permintaan (Hardware/Software/Akses/Jaringan/Lainnya — bisa dikonfigurasi),
  Prioritas (Tinggi/Sedang/Rendah), Estimasi biaya (opsional), lampiran
- Identitas karyawan otomatis dari profil: nama, status, NRK, jabatan, atasan, divisi, departemen, email, HP
- Keterangan (diisi pelaksana)
- Blok "Petunjuk dan Aturan" (teks statis yang bisa dikonfigurasi admin per divisi)

Alur approval (tercatat siapa & tanggal, tampil di blok PENGESAHAN):
1. Diminta oleh — Pemohon
2. Disetujui oleh — Atasan YBS
3. Disetujui oleh — Mgr/Spv Divisi Pelaksana
4. Diselesaikan oleh — Foreman/Teknisi Divisi
Setiap approver bisa Approve / Reject (wajib alasan) / Minta Revisi.
Status: DRAFT → MENUNGGU_ATASAN → MENUNGGU_DIVISI → DIPROSES → SELESAI | DITOLAK
Fitur cetak PDF dengan layout menyerupai formulir asli (header, no dokumen, revisi, halaman).

## 6. Modul C — Preventive Maintenance Scheduler
- Mgr/Spv divisi membuat Jadwal PM: equipment (satu atau banyak), template checklist,
  frekuensi (harian/mingguan/bulanan/tahunan/setiap N hari), tanggal mulai, PIC teknisi, toleransi hari.
- Sistem (Laravel Scheduler, jalan tiap hari) men-generate "Tugas PM" otomatis sesuai jadwal.
- Notifikasi: H-3 dan H-0 ke PIC, notifikasi OVERDUE ke PIC + atasan.
- Teknisi mengerjakan: isi checklist (OK/Tidak OK/NA + catatan), foto, material terpakai, durasi.
- Bila ada temuan "Tidak OK" → tombol buat Work Order langsung dari tugas PM.
- Log maintenance per equipment (riwayat lengkap PM + WO terkait).
- Status: TERJADWAL → JATUH_TEMPO → DIKERJAKAN → SELESAI | TERLAMBAT | DILEWATI (wajib alasan)

## 7. Notifikasi
- In-app (bell) + email. (Fase lanjut: push notification mobile / WhatsApp gateway.)
- Event: WO baru, WO diterima/selesai, request butuh approval, request disetujui/ditolak, PM jatuh tempo/overdue.

## 8. Dashboard
- Per divisi & global (untuk manajemen): jumlah WO per status, request pending approval,
  kepatuhan PM (% selesai tepat waktu), PM overdue, rata-rata waktu respon & penyelesaian WO (SLA),
  total breakdown hours per equipment, top 10 equipment paling sering rusak, beban kerja per teknisi.
- Filter: periode, divisi, lokasi, kategori.
- Kalender jadwal PM (bulan/minggu).

## 9. Non-fungsional
- Responsive / mobile-first (teknisi pakai HP di lapangan).
- Audit trail semua perubahan.
- Export Excel untuk list dan laporan.