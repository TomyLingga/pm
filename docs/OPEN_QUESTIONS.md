# Pertanyaan Terbuka — PM-App PT INL

> Jawab langsung di bawah tiap butir (`**Keputusan:** …`). Kolom "Usulan" = default yang dipakai di
> ERD/API/State Machine bila tidak ada keputusan lain. Nomor **Q-n** dirujuk dari dokumen lain.

## A. Identitas, SSO & organisasi (paling mendesak — memblokir fase 2)

**Q-1. Sumber "Atasan YBS".** Portal punya `employee.atasan_id`. Apakah selalu benar/terisi? Bolehkah admin
PM-App meng-override atasan secara lokal?
Usulan: pakai data Portal; admin boleh override lokal (kolom terpisah, tidak ditimpa sinkronisasi).
Jawaban: Nanti user pilih atasannya sendiri, load saja data user yg gradenya lebih besar dari si user di search able dropdown.

**Q-2. Pemetaan Divisi / Departemen / Section.** Portal hanya punya hierarki `unit_organisasi`
(`direktorat → sevp → bagian → sub_bagian → seksi`). Formulir butuh "Divisi" dan "Departemen".
Tipe Portal mana = Divisi, mana = Departemen, mana = Section?
Usulan: Divisi = `bagian`, Departemen = `sub_bagian`, Section = `seksi`.
Jawaban: Diganti saja pakai Bagian dan Sub Bagian, tidak usah pakai DIvisi Departemen lagi

**Q-3. No. HP & status karyawan.** `POST /api/sso/verify` sengaja **tidak** mengirim nomor HP dan status
karyawan, padahal keduanya dicetak di Form Request (termasuk No. HP tiap approver di blok PENGESAHAN).
Opsi: (a) tim Portal menambah field ke payload SSO/`/sso/employees`; (b) user mengisi HP sendiri di PM-App.
Usulan: (a) untuk status karyawan, (b) sebagai cadangan untuk HP.
Jawaban: di portal ada data nomor hp dan status karyawan, sesuaikan saja payloadnya (hanya update bagian ini ya, jgn merusak yg lain soalnya apliaksi ini udah terintegrasi dengan app lain contohnya Approver IDAS). 

**Q-4. Mode token di web.** Bearer token Sanctum untuk web & mobile (sederhana, satu mekanisme), atau
cookie SPA Sanctum untuk web (lebih aman dari XSS, butuh domain FE/BE yang sama)?
Usulan: cookie SPA untuk web bila FE & BE satu domain induk; bearer untuk mobile.
Jawaban: Samakan saja dengan IDAS, yg versi Mobile nya login sendiri saja tapi pakai database portal intes

**Q-5. Single logout.** Portal belum punya endpoint/URL logout untuk aplikasi klien. Cukup logout lokal +
redirect ke halaman portal? Berapa lama sesi PM-App berlaku?
Usulan: logout lokal + redirect ke beranda Portal; token berlaku 12 jam (web) / 30 hari (mobile).
Jawaban: Samakan saja dengan IDAS

**Q-6. Penomoran WO.** Format `WO/{KODE_DIVISI}/{BULAN_ROMAWI}/{TAHUN}/{0001}` — urut reset per **tahun** atau per
**bulan**? `KODE_DIVISI` = divisi **pelaksana** (IT/MTC/GA) atau divisi pemohon?
Usulan: kode divisi pelaksana, reset per tahun (sama dengan Form Request).
Jawaban: kode subbagian pelaksana, reset per tahun.

**Q-7. Kapan nomor REQ terbit?** Saat draft dibuat atau saat submit pertama? (Draft yang tak pernah diajukan
akan membuat lubang nomor bila terbit saat draft.)
Usulan: saat submit pertama; draft memakai label "DRAFT".
Jawaban: saat submit pertama

## B. Alur Form Request

**Q-8. Bypass atasan.** Apa yang terjadi bila: pemohon tidak punya atasan; atasan = Mgr/Spv divisi pelaksana;
pemohon sendiri adalah Mgr divisi pelaksana?
Usulan: tanpa atasan → langsung ke divisi; atasan = approver divisi → step atasan dilewati (tercatat `skipped`);
pemohon tidak boleh meng-approve request-nya sendiri.
Jawaban: Nanti user pilih atasannya sendiri, load saja data user yg gradenya lebih besar dari si user di search able dropdown.

**Q-9. Batal & tindak lanjut.** Bolehkah pemohon membatalkan request (sebelum disetujui divisi)? Apakah request
yang disetujui perlu bisa diturunkan menjadi WO untuk pengerjaan?
Usulan: boleh batal sampai sebelum `in_progress`; fitur "buat WO dari request" opsional (link `work_order_id`).
Jawaban: boleh batal sampai sebelum `in_progress`; buat juga fitur "buat WO dari request" atau "buat request dari WO". Jadi misalnya user ajukan request, bisa di reject sama pelaksana dengan mengatakan ini cukup pakai WO. Atau misalnya user ajukan WO, ternyata WO nya pakai biaya besar, pelaksana bisa reject dengan mengatakan ini harus form request. Tlg kamu sesuaikan ya.

**Q-17. Delegasi approver.** Bila atasan/Mgr cuti, apakah perlu delegasi (wakil) atau admin bisa mengalihkan?
Usulan: fase awal admin bisa "reassign approver" (tercatat di log); delegasi otomatis menyusul.
Jawaban: Nanti user pilih atasannya sendiri, load saja data user yg gradenya lebih besar dari si user di search able dropdown.

**Q-18. Estimasi biaya.** Apakah ada ambang biaya yang membutuhkan approver tambahan (mis. Direksi/Finance)?
Siapa yang boleh melihat estimasi biaya?
Usulan: tidak ada step tambahan di v1; biaya terlihat oleh pemohon, approver, dan divisi pelaksana.
Jawaban: tidak ada step tambahan

**Q-19. Satu request = satu item?** Formulir hanya punya "Keperluan" (teks). Perlu daftar item (barang, qty)?
Usulan: teks saja di v1, sesuai formulir.
Jawaban: teks saja

## C. Alur Work Order

**Q-10. Siapa "User In Charge" yang menerima hasil?** Hanya pemohon, atau siapa pun di section yang sama
(pemohon bisa sedang shift lain)? Perlu auto-accept bila tidak direspons N hari?
Usulan: pemohon atau atasannya / anggota section yang sama; auto-accept setelah 3 hari kerja (tercatat sistem).
jawaban: pemohon atau atasannya / anggota section yang sama; auto-accept setelah 3 hari kerja (tercatat sistem).

**Q-11. `DITERIMA_USER → CLOSED`.** Otomatis langsung setelah accept, atau Spv divisi melakukan close (review akhir)?
Usulan: otomatis (DITERIMA_USER hanya tercatat di log), kecuali divisi perlu verifikasi.
Jawaban: otomatis

**Q-12. Definisi SLA.** Waktu respon = terbit → diterima? Waktu penyelesaian = terbit → selesai teknisi, atau → diterima user?
Ada target per prioritas (mis. Tinggi: respon 1 jam, selesai 8 jam)? Hitung jam kalender atau jam kerja?
Usulan: penyelesaian = terbit → `completed`; target per prioritas dapat dikonfigurasi; jam kalender di v1.
Jawaban: Waktu di hitung saat seorang pelaksana/teknisi pick work order itu sampai selesai

**Q-20. Kategori WO per divisi.** Mechanical/Electrical/Fabrikasi cocok untuk MTC, kurang cocok untuk IT/GA.
Kategori per divisi pelaksana boleh berbeda?
Usulan: ya, master `work_categories` per divisi ("Lain-lain" tetap ada dengan isian bebas).
Jawaban: Niatnya gini, tiap seksi bisa menambahkan kategori nya masing2. Jadi ketika user mau ajukan request atau wo, dia pilih seksi teknisinya kemduan aplikasi load kategori, dan pilih kategorinya. Cth (jika pilih IT, load Software, Hardware & Network)

**Q-21. Visibilitas.** Bolehkah pemohon melihat WO/Request orang lain (mis. satu section)? Siapa yang mendapat
role `management` (dashboard global)?
Usulan: pemohon hanya miliknya + section yang sama (read-only); management ditetapkan admin.
Jawaban: pemohon hanya miliknya + section yang sama (read-only); management ditetapkan admin.

**Q-22. Paraf/tanda tangan.** Formulir kertas memakai paraf. Cukup nama + waktu (tercatat sistem), atau perlu
gambar tanda tangan di PDF?
Usulan: nama + waktu + "disahkan secara elektronik" di PDF.
Jawaban: generate barcode, ketika di scan barcode dia kasihtau ttd nama siapa, waktu dan nomor dokumennya

**Q-23. Cetak WO.** PRD hanya menyebut PDF untuk Form Request. Perlu PDF layout FM-BOPS-10/05 juga?
Usulan: ya (sudah dimasukkan ke API).
Jawaban: ya

## D. Preventive Maintenance

**Q-13. Semantik JATUH_TEMPO & TERLAMBAT.** Kapan tugas berubah dari TERJADWAL ke JATUH_TEMPO (H-3? H-0?)
Apakah TERLAMBAT masih boleh dikerjakan, atau tugas hangus saat jadwal berikutnya tiba? Notifikasi overdue sekali
atau berulang (harian)?
Usulan: JATUH_TEMPO mulai H-3; TERLAMBAT setelah `due_date + toleransi`, tetap bisa dikerjakan (ditandai telat);
otomatis `skipped` (alasan sistem) bila kejadian berikutnya sudah jatuh tempo; pengingat overdue tiap 3 hari.
jawaban: JATUH_TEMPO mulai H-2; TERLAMBAT setelah `due_date dan waktu + toleransi`, tetap bisa dikerjakan (ditandai telat);
otomatis `skipped` (alasan sistem) bila kejadian berikutnya sudah jatuh tempo; pengingat overdue tiap 2 hari

**Q-14. Jadwal multi-equipment.** Satu jadwal untuk 10 equipment → 10 tugas terpisah (satu per equipment), atau
satu tugas berisi 10 equipment?
Usulan: satu tugas per equipment (riwayat per equipment lebih rapi).
Jawaban: satu tugas per equipment (riwayat per equipment lebih rapi). Juga bisa dibuat tugas berulang (memang rutin per berapa jam gitu)

**Q-15. Mengubah jadwal.** Bila frekuensi/PIC diubah, tugas yang sudah ter-generate tapi belum dikerjakan ikut berubah?
Horizon generate berapa lama ke depan (untuk kalender)?
Usulan: tugas `scheduled` di masa depan dihapus & digenerate ulang; horizon 60 hari; kalender juga menampilkan
proyeksi di luar horizon.
Jawaban: tugas `scheduled` di masa depan dihapus & digenerate ulang; horizon 60 hari; kalender juga menampilkan
proyeksi di luar horizon.

**Q-16. Siapa yang boleh melewati (skip) tugas PM?** Teknisi atau hanya Mgr/Spv?
Usulan: hanya Mgr/Spv (teknisi bisa mengusulkan via catatan).
Jawaban: hanya bom-1. bom-2 dan bom-3. Bom-4 (teknisi) bisa mengusulkan via catatan

**Q-24. Basis jadwal.** Jadwal berbasis kalender saja, atau juga berbasis jam operasi/counter mesin (running hours)?
Usulan: kalender saja di v1.
Jawaban: berbasis jam 

## E. Teknis & operasional

**Q-25. Database.** CLAUDE.md: MySQL 8 *atau* PostgreSQL. Portal INTES memakai PostgreSQL.
Usulan: PostgreSQL (satu jenis DB untuk tim ops, dukungan `jsonb`/partial index lebih baik).
jawaban: PostgreSQL

**Q-26. Email.** SMTP server mana yang dipakai (alamat pengirim, relay internal/Google Workspace)?
Jawaban: ini email buat apa ya? Bisa gak dibuat post notification dan seperti alarm untuk mobile nya?

**Q-27. Data awal.** Ada file master equipment, lokasi, material, dan template checklist yang bisa diimpor (Excel)?
Perlu migrasi WO/Request historis dari kertas/Excel?
Jawaban: boleh import excel

**Q-28. Inkonsistensi repo.** (a) CLAUDE.md merujuk `@docs/PRD.md`, file sebenarnya di `docs/forms/PRD.md`;
(b) `docs/SSO.md` belum ada; (c) CLAUDE.md memakai folder `be/` & `fe/` — nama itu yang dipakai?
Usulan: pindahkan PRD ke `docs/PRD.md`, saya tulis `docs/SSO.md` dari kode Portal, folder `be/` & `fe/`.
Jawaban: sesuai usulan

**Q-29. Lampiran.** Batas ukuran & jumlah foto per dokumen? Disimpan di disk lokal server (volume Docker) atau object storage?
Usulan: maks 10 file × 5 MB, foto dikompres di sisi klien; disk lokal (volume) di v1.
Jawaban: sesuai usulan

**Q-30. Stok material.** Material di WO/PM hanya dicatat, atau harus mengurangi stok gudang / terintegrasi sistem lain?
Usulan: hanya dicatat di v1.
Jawaban: hanya di catat.

---

# Tindak lanjut (v0.2)

## Cara jawaban diterapkan

| Q | Diterapkan sebagai |
|---|---|
| Q-1/8/17 | Atasan dipilih pemohon saat submit dari dropdown user dengan `grade_level` lebih tinggi (default: pilihan terakhir). Selama menunggu atasan, pemohon bisa **ganti atasan** (pengganti delegasi). Bypass hanya bila tidak ada kandidat (grade tertinggi). |
| Q-2 | Identitas memakai **Bagian** & **Sub Bagian** (ancestor unit Portal). |
| Q-3 | Rancangan patch Portal (additive) ada di `docs/SSO.md` §4 — **belum diterapkan**, lihat Q-35. |
| Q-4/5 | Web = sesi cookie Sanctum SPA seperti IDAS, 120 menit sliding, logout lokal → redirect Portal. IDAS **tidak punya** app mobile, jadi alur mobile dirancang baru (Q-33). |
| Q-6 | `WO/{kode sub bagian pelaksana}/{romawi}/{tahun}/{0001}`, urut per sub bagian per tahun. |
| Q-9 | Aksi `convert_to_request` (WO → Form Request draft) dan `convert_to_work_order` (Request → WO), keduanya oleh pimpinan pelaksana dengan alasan wajib; dokumen asal berstatus `converted` dan saling tertaut. |
| Q-10/11 | Penerima: pemohon / atasan pilihannya / seunit; auto-accept 3 hari kerja (Senin–Jumat + tabel libur); accept langsung `closed`. |
| Q-12 | SLA = `picked_at → completed_at`. Ditambahkan aksi **pick** (teknisi ambil WO sendiri dari pool) selain assign oleh pimpinan. |
| Q-13 | Jatuh tempo H-2 dengan jam (`due_at`), toleransi dalam jam, pengingat overdue tiap 2 hari, auto-skip saat kejadian berikutnya jatuh tempo. |
| Q-14/24 | Frekuensi `hourly` (tiap N jam) ditambahkan. Running hours mesin → Q-32. |
| Q-16 | Kewenangan dari grade Portal: BOM/BOM-1/2/3 = pimpinan (skip, assign, approve, jadwal); BOM-4 = teknisi (bisa `propose_skip`). |
| Q-20 | Kategori dikelola per seksi pelaksana, satu master `service_categories` untuk WO & Request (menggantikan "Jenis Permintaan"). |
| Q-22 | Tiap pengesahan → QR berisi link verifikasi publik (nama, jabatan, waktu, nomor dokumen). |
| Q-25 | PostgreSQL. |
| Q-26 | Email dihapus dari v1 → in-app + push (lihat Q-34). |
| Q-28 | PRD dipindah ke `docs/PRD.md`; `docs/SSO.md` ditulis; folder `be/` & `fe/`. |

## Pertanyaan lanjutan

**Q-31. Nomor Form Request.** WO pakai kode **sub bagian**. Untuk REQ (`REQ0001/Sistem dan IT/IX/2026`), teks tengahnya
nama apa: nama seksi pelaksana, nama sub bagian, atau nama tampilan bebas yang diatur admin? Urutannya per seksi atau per sub bagian?
Usulan: nama tampilan per seksi (default nama sub bagian), urut per sub bagian (sama dengan WO).
Jawaban:Kode  Seksi yg di request. sama di WO juga kode seksi nya ya.

**Q-32. Arti "berbasis jam" (Q-24).** Mana yang dimaksud?
(a) Jadwal kalender per N jam — mis. cek kompresor tiap 8 jam, apa pun kondisi mesin (sudah dirancang);
(b) Berdasarkan **jam operasi mesin** (hour meter) — mis. ganti oli tiap 500 jam jalan; teknisi harus menginput angka hour meter berkala;
(c) keduanya.
Jawaban:(a)

**Q-33. Login mobile.** Usulan alur di `docs/SSO.md` §2: app mobile mengirim email/NRK + password ke BE PM-App, BE
meneruskan ke **API login Portal** (bukan membaca DB Portal langsung), lalu menerbitkan token PM-App 30 hari. Setuju?
Bagaimana untuk akun Portal yang mengaktifkan TOTP/passkey — mobile ikut minta kode TOTP, atau akun seperti itu tidak bisa login di mobile?
Jawaban:setuju, di mobile tidak perlu passkey

**Q-34. Push & alarm.** Email gunanya menjangkau user yang tidak sedang membuka aplikasi; penggantinya push notification:
- PWA (Web Push): jalan di Android dan iPhone (iOS ≥ 16.4, setelah "Add to Home Screen"), bunyi notifikasi biasa.
- "Alarm" (bunyi panjang/berulang, tetap berbunyi saat HP mode senyap) **hanya bisa di aplikasi native** (Expo/React Native)
  dengan channel notifikasi prioritas tinggi.

Apakah aplikasi native (Expo) masuk v1 (menambah ±1 fase), atau v1 cukup PWA push dan alarm menyusul? Event mana yang
berbunyi alarm? Usulan: WO prioritas Tinggi baru masuk pool, PM overdue, request menunggu approval > 1 hari.
Jawaban: Andorid buat pakai React Native ya, terus alarm untuk WO prioritas Tinggi baru masuk pool, ada jadwal maintenance yg mendekati waktu, request menunggu approval > 1 hari, dll yg menurut mu penting.

**Q-35. Patch Portal (Q-3).** Perubahan ke repo `portal-app-be` diblokir oleh izin sistem saya karena repo itu dipakai aplikasi lain.
Opsi: (a) Anda/tim Portal menerapkan patch di `docs/SSO.md` §4; (b) Anda mengizinkan saya mengedit `portal-app-be`
(hanya 2 file, additive), lalu saya jalankan typecheck.
Jawaban: kalau ini cuma untuk menambahkan return no HP dan status karyawan, yasudah lakukan saja, yg penting tidak merusak yg lainnya.

**Q-36. Asumsi yang perlu dikonfirmasi.**
- Teknisi boleh **pick** WO sendiri dari pool tanpa di-assign (diturunkan dari jawaban Q-12).
- Kabag/Kasubag yang unitnya **di atas** seksi pelaksana tidak otomatis menjadi pimpinan seksi; admin menambahkannya
  lewat "anggota tambahan". (Alternatif: otomatis semua BOM-1/BOM-2 di bagian/sub bagian induk.)
- Konversi WO → Request membuat **draft** (pemohon harus memilih atasan & submit); konversi Request → WO langsung **diajukan**.
Jawaban: teknisi boleh pick WO sendiri dari pool, atasan juga bisa delegasi/assign ke teknisi dan teknisi mendapat notifkkasi dari ini. Atasan pelaksana adalah grade yg 1 line diatasnya. Untuk form request, user bisa pick atasannya. Konversi WO → Request membuat **draft** (pemohon harus memilih atasan & submit)
