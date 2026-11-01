# Task Backend — Salvora Kitchen

| Metadata | Nilai |
|---|---|
| PRD acuan | [PRD-Salvora-Kitchen.md](../PRD-Salvora-Kitchen.md), versi aktif 1.9; catatan task lama tetap menyebut versi saat dikerjakan |
| Tanggal penyusunan | 22 Oktober 2026 |
| Stack yang ditetapkan | Next.js, PostgreSQL; frontend React, Tailwind CSS, shadcn/ui |
| Pembayaran | Midtrans Snap Sandbox; adaptasi terpilih dari LanggananKu |
| Status dokumen | BE-00–BE-14 Selesai untuk backend. BNI VA Sandbox Rp14.000 settlement, webhook, GET status dan application/stok/voucher tepat sekali terverifikasi 24 Oktober. Cluster 55433 dan tick antrean kosong terverifikasi; server/tunnel test ditutup tanpa mengubah task/dev. Catatan mismatch retensi regresi pertama tetap historis, tidak diklaim pulih. Frontend/Figma/deployment belum diterima |

## 1. Aturan penggunaan

PRD menjadi sumber aturan bisnis. Dokumen ini memecah implementasi backend menjadi task yang dapat dikerjakan bertahap dan diverifikasi. Jangan menambah fitur dari Figma atau proyek lama tanpa memeriksa cakupan PRD.

- Kerjakan sesuai dependensi dan perbarui status aktual.
- Satu task dapat dibagi menjadi subtask dengan akhiran `.1`, `.2`, dan seterusnya; pertahankan referensi PRD dan kriteria selesai induknya.
- Mulai dari fondasi backend, lalu kerjakan per fitur. Frontend dapat berjalan dengan data contoh sesuai kontrak API yang sama.
- Tidak ada pembuatan chat baru atau pengiriman task ke chat lain secara otomatis melalui dokumen ini.
- Jangan menyalin `.env`, data pengguna, sesi, atau kredensial LanggananKu. Periksa konfigurasi yang diperlukan tanpa menampilkannya di log.
- Jangan menjalankan migrasi pada database lama. Pastikan tujuan koneksi sebelum operasi tulis database.
- Kode lama yang tampak memiliki pengamanan belum dianggap benar atau lulus sampai diuji dalam konteks baru.
- Jangan menandai task selesai hanya karena endpoint ada. Periksa perilaku, akses, kegagalan, dan integritas data yang relevan.
- Pemeriksaan UI lengkap dan kecocokan visual Figma bukan bukti yang dapat diperoleh dari pengujian backend saja.

### Status

**Belum dimulai → Dikerjakan → Ditinjau → Selesai**. **Terhambat** digunakan jika ada kendala nyata; tuliskan bagian yang terhambat serta tindakan yang diperlukan. Jangan menghentikan task independen yang masih dapat dikerjakan.

### Kriteria umum penutupan task

1. Keluaran dan kriteria khusus task terpenuhi.
2. Perubahan sesuai PRD dan tidak menambah fitur yang ditunda.
3. Pemeriksaan yang relevan dijalankan dan hasilnya dicatat; pemeriksaan yang belum dilakukan disebut jelas.
4. Tidak ada rahasia dalam kode, contoh konfigurasi, respons API, atau log.
5. Dokumentasi kontrak dan migrasi yang terpengaruh diperbarui.
6. Task berikutnya mendapat catatan dependensi dan keterbatasan yang jelas.

## 2. Ringkasan dan dependensi

Semua task di bawah berprioritas P0 untuk cakupan backend. Task penetapan keputusan menyelesaikan keputusan secara bertahap; bukan alasan menunggu semua data konten sebelum mulai fondasi.

| ID | Task | Dependensi minimum | Status |
|---|---|---|---|
| BE-00 | Kunci keputusan implementasi dan inventarisasi sumber | Tidak ada | Selesai |
| BE-01 | Fondasi Next.js dan kontrak API | Keputusan teknis relevan BE-00 | Selesai |
| BE-02 | Skema dan migrasi PostgreSQL | BE-01; model inti BE-00 | Selesai |
| BE-03 | Autentikasi, otorisasi, dan profil dasar | BE-02 | Selesai |
| BE-04 | Kategori, produk, stok, dan foto | BE-02, BE-03 | Selesai |
| BE-05 | Alamat dan keranjang | BE-03, BE-04 | Selesai |
| BE-06 | Voucher pembeli baru dan perhitungan harga | BE-03, BE-04 | Selesai |
| BE-07 | Checkout, pesanan, dan reservasi | BE-05, BE-06; keputusan ongkir/expiry BE-00 | Selesai |
| BE-08 | Adaptasi Midtrans dan pembuatan pembayaran | BE-07; akses sandbox BE-00 | Selesai |
| BE-09 | Webhook dan penerapan pembayaran | BE-08 | Selesai backend; BNI VA/webhook Sandbox nyata terverifikasi BE-14 |
| BE-10 | Rekonsiliasi, retry, dan kedaluwarsa | BE-09; mekanisme penjadwal BE-00 | Selesai; penjadwal lokal aktif, hosting demo terbuka |
| BE-11 | Riwayat, detail, dan pemenuhan pesanan | BE-07, BE-09; penerimaan final setelah BE-10 | Selesai backend — PostgreSQL dan HTTP terisolasi lulus |
| BE-12 | Rating dan ulasan terverifikasi | BE-11 | Selesai backend — PostgreSQL dan HTTP terisolasi lulus |
| BE-13 | Dashboard operasional dan pemantauan voucher | BE-04, BE-06, BE-09, BE-11 | Selesai backend — PostgreSQL dan HTTP terisolasi lulus |
| BE-14 | Verifikasi terintegrasi dan serah terima frontend | BE-00 sampai BE-13 | Selesai backend — BNI VA nyata, integrasi/HTTP, DB baru/restore lulus; batas audit/produk dicatat |

Urutan kerja utama: **BE-00 → BE-01 → BE-02 → BE-03**, lalu fitur katalog/transaksi hingga pembayaran dan ulasan. BE-05 dan BE-06 independen setelah dependensinya tersedia. Struktur endpoint BE-11 dapat disiapkan lebih awal, tetapi tidak ditutup sebelum status akhir pembayaran/kedaluwarsa teruji.

## 3. Detail task

### BE-00 — Kunci keputusan implementasi dan inventarisasi sumber

**Acuan:** PRD bagian 2, 14.1, 21, 24, 25. **Penanggung jawab:** belum ditetapkan.

**Hasil 22 Oktober 2026:** Selesai untuk keputusan fondasi dan inventarisasi. Lihat [DECISIONS.md](DECISIONS.md) untuk pilihan Prisma/driver, baseline versi, pemisahan database, audit adaptasi sumber, serta konfigurasi tanpa kredensial. BE-01 siap dimulai. Keputusan bisnis/infrastruktur yang belum final tercatat sebagai O-01–O-11 dengan gerbang task masing-masing; belum ada implementasi atau pengujian runtime Salvora, dan tidak ada perubahan kode/database LanggananKu. Pemeriksaan aktual berupa inventaris filesystem, pembacaan sumber/tes/migrasi/metadata paket, rujukan resmi, dan tinjauan dokumen. Tidak ada migrasi atau kontrak API yang berubah.

**Keluaran:** catatan keputusan di `docs/DECISIONS.md` ketika task dikerjakan, inventaris modul LanggananKu yang akan diadaptasi, dan daftar konfigurasi tanpa nilai rahasia.

**Pekerjaan:**

- Catat keputusan yang sudah tetap: Next.js, PostgreSQL, Tailwind, shadcn/ui, Midtrans Sandbox, delivery manual, voucher tetap, serta batas fitur admin.
- Pilih ORM/driver; Prisma merupakan kandidat karena tersedia pada LanggananKu, tetapi pilihan serta versi kompatibel harus dicatat sebelum migrasi.
- Tetapkan nama database aplikasi dan database pengujian yang terpisah dari LanggananKu, strategi foto, serta target hosting/penjadwal saat diperlukan.
- Selesaikan expiry tunggal: usulan PRD 30 menit dan sumber lama 60 menit. Jangan memilih diam-diam.
- Tetapkan tarif/wilayah delivery atau kebijakan demo Rp0 yang jelas. Tetapkan ambang stok menipis, batas unggahan, dan validasi ulasan sesuai usulan PRD atau keputusan yang dicatat.
- Verifikasi kanal merchant sandbox dan akses yang diperlukan tanpa menganggap semua kanal pada Figma aktif.
- Inventaris sumber: autentikasi, koneksi database, Midtrans, kebijakan status, webhook, dan tes. Catat logika langganan yang harus dibuang.

**Kriteria selesai:** keputusan yang dibutuhkan task berikutnya tercatat; keputusan tersisa memiliki dependensi spesifik. Inventaris membedakan pemeriksaan sumber dari pengujian runtime. Tidak ada perubahan terhadap data proyek lama.

**Batas:** bukan migrasi data pengguna LanggananKu dan bukan persetujuan fitur tambahan. Konten foto/harga belum final tidak menghambat fondasi jika data uji ditandai jelas.

### BE-01 — Fondasi Next.js dan kontrak API

**Acuan:** bagian 14–16, 25; FR-01 dan FR-07 untuk pola akses. **Dependensi:** keputusan teknis relevan BE-00.

**Hasil 23 Oktober 2026:** Fondasi tersedia di workspace Salvora; lihat [API-CONTRACT.md](API-CONTRACT.md), [README](../README.md), serta pembaruan [DECISIONS.md](DECISIONS.md). Halaman sementara dan `GET /api/health` berjalan; endpoint bisnis diberi status rencana, bukan sukses palsu. Skema domain/migrasi/seed tetap BE-02.

#### Catatan hasil BE-01

- Status: Selesai untuk cakupan fondasi dan kontrak API; tidak menyatakan backend produk selesai.
- PRD acuan: 1.4 bagian 14–16/25, FR-01/FR-07; penanggung jawab individu belum ditetapkan kelompok.
- Tanggal: 23 Oktober 2026 (pekerjaan dimulai 22 Oktober).
- Keputusan terkait: D-01–D-12; O-01–O-11 tetap terbuka sesuai dependensinya.
- Implementasi: konfigurasi Next.js/TypeScript/Tailwind/npm; modul config/API/akses/kontrak/data/service; halaman sementara; health konfigurasi; 15 tes fondasi dan skrip HTTP; schema generator/provider Prisma tanpa model domain.
- Konfigurasi: `.env.example` placeholder; tidak membuat rahasia/akun/`.env` nyata. Validasi server/CLI menolak fallback/target legacy dan memisahkan test. Konfigurasi Midtrans tidak wajib untuk fondasi, wajib untuk operasi pembayaran nanti.
- Kontrak baru: envelope respons/error, pagination, penamaan status, akses, payload minimum dan endpoint rencana seluruh fitur backend P0. Akses katalog publik masih diberi label O-09.
- Migrasi: tidak ada; tidak ada koneksi/tulisan database atau perubahan LanggananKu.
- Pemeriksaan: instalasi npm serta `npm ls --depth=0` berhasil; versi baseline sesuai lockfile baru. `db:generate` berhasil dengan URL fixture Salvora tanpa koneksi DB. `npm test` 15/15, lint tanpa warning, typecheck dan production build lulus. Beberapa subprocess diblokir sandbox EPERM dan diverifikasi ulang dengan izin eksekusi; bukan kegagalan perilaku aplikasi.
- Uji HTTP production aktual: halaman `/` 200; health tanpa konfigurasi 503 envelope aman; health konfigurasi valid 200 dengan `database/payment: not_checked`; metode POST health 405; endpoint produk yang belum dibuat 404. Proses smoke dihentikan otomatis. CLI konfigurasi kosong ditolak aman (exit 1 yang diharapkan), fixture valid lulus; tidak membuka DB/provider.
- Audit npm aktual: 5 high pada rantai alat lint dev, 0 pada `--omit=dev`; detail/alasan tidak melakukan downgrade major ada pada DECISIONS. Audit keseluruhan belum bersih, keterbatasan dicatat.
- Batas bukti: belum ada PostgreSQL nyata, autentikasi/sesi, Midtrans, UAT visual/mobile atau transaksi produk. Bukti ini mendukung fondasi UAT-23/UAT-31, bukan keseluruhan UAT tersebut.
- Catatan berikutnya: lanjut BE-02 untuk skema/constraint dan runner DB test khusus Salvora; provisioning PostgreSQL O-11 harus diselesaikan sebelum migrasi. Auth/katalog independen dari keputusan ongkir. Tidak mengimplementasikan task berikutnya otomatis melalui BE-01.

**Keluaran:** proyek Next.js yang dapat dijalankan, konfigurasi server tervalidasi, pemisahan modul bisnis/data/API, serta `docs/API-CONTRACT.md` ketika implementasi dimulai.

**Pekerjaan:**

- Siapkan tooling dan versi paket yang kompatibel. Frontend belum perlu dibangun penuh; catat Tailwind/shadcn sebagai ketentuan yang tetap berlaku.
- Buat konfigurasi lingkungan dan `.env.example` dengan placeholder. Jangan fallback ke database `subspace` atau database LanggananKu.
- Tetapkan format respons berhasil/gagal, validasi input, pagination, penamaan status, dan aturan otorisasi bersama.
- Definisikan operasi auth, produk/kategori, alamat/keranjang, checkout, pembayaran, pesanan, voucher, dashboard, serta ulasan beserta data minimum.
- Pastikan respons publik tidak memuat hash kata sandi, sesi, atau server key.

**Kriteria selesai:** aplikasi dan pemeriksaan dasar berjalan; konfigurasi kurang lengkap menghasilkan pesan aman; kontrak dapat digunakan frontend tanpa menebak bentuk data. Endpoint yang belum dibuat diberi status rencana.

**UAT:** fondasi UAT-23/UAT-31. **Batas:** tidak membuat halaman lengkap, CMS, atau layanan terpisah untuk meniru semua menu Figma.

### BE-02 — Skema dan migrasi PostgreSQL

**Acuan:** bagian 9–14, 24.5. **Dependensi:** BE-01 dan keputusan model inti BE-00.

**Hasil 23 Oktober 2026:** Selesai untuk penyimpanan P0, migrasi dan seed. Lihat [DATABASE.md](DATABASE.md), schema/migrasi pada `prisma`, serta pembaruan BE-02 pada [DECISIONS.md](DECISIONS.md).

#### Catatan hasil BE-02

- Status: Selesai; PRD acuan 1.4 bagian 9–14/24.5; penanggung jawab individu belum ditetapkan kelompok.
- Tanggal: 23 Oktober 2026.
- Keputusan: PostgreSQL lokal 18.6 pada cluster workspace port 55433; O-11 selesai untuk dev/test, deployment demo tetap menunggu hosting. Nominal INTEGER Rupiah maksimum 2.147.483.647. O-01 expiry dan O-02 ongkir tidak diisi diam-diam.
- Implementasi: schema entitas P0 dan Session/RateLimit/CheckoutQuote/StockReservation/PaymentApplication; factory/accessor PrismaPg tervalidasi/lazy; wrapper CLI target app/test; helper cluster lokal; seed katalog demo idempoten; provisioning admin internal; backup manual dan checker DB.
- Migrasi: `202610230001_init`, baru dari empty schema, CHECK/unique/FK/partial index/trigger dan transaksi BEGIN/COMMIT. Diterapkan pada database Salvora dev/test kosong; tidak memigrasi data LanggananKu atau melakukan reset/drop/truncate.
- Integritas: stok/quantity/nominal, snapshot alamat/item/deadline immutable, voucher tetap dan pemiliknya, banyak percobaan historis dengan satu potensi aktif, referensi provider/transaction unik, PaymentApplication per order, deduplikasi event, satu rating 1–5 per item. Izin/penerapan status bisnis tetap task berikutnya.
- Data lokal: 2 kategori demo, 2 produk Data Demo, 1 admin baru, 0 order pada dev; password admin acak/hash bcrypt, kredensial hanya file privat `.local/admin-demo.json`. Koneksi dev/test/shadow dan AUTH_SECRET baru hanya `.env.local`; Git ignore aktif. Tidak ada data akun/sesi dari sumber lama.
- Pemeriksaan aktual: Prisma generate/validate berhasil; migrate deploy dev/test dan status berhasil; Prisma migrate diff struktur dev→schema exit 0 (No difference detected). 12 tes PostgreSQL nyata dan 15 tes fondasi lulus; lint/typecheck dan production build lulus. Smoke HTTP tetap lulus tanpa menambah endpoint bisnis.
- Tes DB: normalisasi/unik email, FK/sesi, stok/quantity, idempotensi order, snapshot produk/alamat, state/kepemilikan voucher, percobaan aktif dan nominal/ref transaksi, PaymentApplication, event/rating, transaksi Prisma rollback, seed berulang, reservasi, perebutan stok terakhir dua transaksi. Role test terbukti tidak dapat CONNECT ke dev. Fixture di-rollback/dihapus spesifik UUID; seed demo test tetap eksplisit.
- Backup: arsip dev dibuat dan pg_restore --list berhasil; restore penuh belum dijalankan, prosedur ke target kosong tersedia. Ini bukan hasil uji pemulihan atau backup terjadwal demo.
- Kontrak API: tidak menambah endpoint; mendokumentasikan batas integer uang, metadata isDemo, dan PaymentApplication sebagai detail penyimpanan. API bisnis masih rencana.
- Batas bukti: belum menguji checkout, penerbitan/penggunaan voucher, sesi/login/logout, Midtrans, scheduler, upload, atau ulasan end-to-end. Bukti skema mendukung UAT-25/UAT-31; UAT produk menyeluruh belum selesai. Audit tooling dev BE-01 tetap tercatat.
- Serah terima: BE-03 siap untuk auth/otorisasi/profil, memakai User/Session/RateLimit dan accessor server yang baru. Jangan menjadikan adanya admin/constraint sebagai bukti endpoint auth sudah tersedia.

**Keluaran:** skema, migrasi, seed data uji, dan prosedur penyiapan database.

**Pekerjaan:**

- Implementasikan entitas P0 bagian 13 serta sesi dan pengamanan autentikasi yang dipilih.
- Pisahkan nomor pesanan toko, ID percobaan, `provider_order_id`, dan ID transaksi Midtrans.
- Tambahkan foreign key, unique constraint, indeks, nominal yang konsisten, serta pemeriksaan stok/kuantitas yang sesuai.
- Rancang reservasi stok/voucher, penanda penerapan pembayaran per pesanan, salinan item/alamat, serta event dan riwayat status.
- Gunakan waktu yang konsisten dan konversi tampilan secara eksplisit.
- Seed admin melalui mekanisme aman, produk/kategori demo, dan data uji yang tidak menyalin pengguna lama.

**Kriteria selesai:** database kosong khusus aplikasi dapat dimigrasi dan diisi seed; constraint penting terbukti; migrasi tidak mengarah ke database lama. Tidak ada model `Plan`/`Subscription` sebagai bagian domain toko.

**UAT:** UAT-25/UAT-31. **Batas:** tabel P1 tidak dibuat sekadar karena ada gambar; jika disiapkan karena kebutuhan teknis, jelaskan alasannya dan tidak menganggap fiturnya sudah tersedia.

### BE-03 — Autentikasi, otorisasi, dan profil dasar

**Acuan:** FR-01, FR-14; bagian 5 dan 16. **Dependensi:** BE-02.

**Hasil 23 Oktober 2026:** Selesai untuk backend; endpoint register/login/logout/session dan GET/PATCH admin/me tersedia. Rincian: [AUTH.md](AUTH.md), [API-CONTRACT.md](API-CONTRACT.md) versi 0.2 dan pembaruan BE-03 [DECISIONS.md](DECISIONS.md).

#### Catatan hasil BE-03

- Status: Selesai untuk cakupan autentikasi, otorisasi dan profil dasar API. Penanggung jawab individu belum ditetapkan kelompok.
- PRD acuan: 1.4 FR-01/FR-14, bagian 5/16. Tanggal: 23 Oktober 2026.
- Implementasi: validasi akun/profil strict, registrasi BUYER, hash bcrypt 12, sesi HMAC/digest DB dan cookie HttpOnly/Secure pada HTTPS/SameSite=Lax, TTL 7 hari absolut, rotasi/login, revokasi/logout, resolver role terbaru, pemeriksaan Origin dan role/kepemilikan, limiter DB atomik serta respons user whitelist.
- Endpoint tersedia: POST auth/register (201), login/logout (200); GET auth/session (200 user/null); GET/PATCH admin/me (200 User sendiri). Anonymous admin ditolak 401, pembeli 403, field selain nama pada profil 422. Tidak ada edit akun admin lain, role, email/password UI atau remember-me.
- Rate limit: fixed bucket 15 menit, login 10/email dan 200 global, register 5/email dan 50 global; keys HMAC, tanpa email/IP mentah; 429 Retry-After. Batas per jaringan menunggu proxy hosting tepercaya, tidak mempercayai header IP arbitrary.
- Migrasi: tidak ada. User/Session/RateLimit BE-02 dipakai. Tidak ada perubahan terhadap LanggananKu atau data/kredensial admin lokal asli untuk pengujian.
- Kontrak: v0.2 menandai auth/profil tersedia. Endpoint lain tetap rencana. Respons JSON berisi role untuk integrasi navigasi frontend; halaman/form/dashboard penuh belum dibuat.
- Kaitan BE-06: hook transaksi setelah autentikasi tersedia; gagal hook merollback akun/sesi/rotasi. Penerbitan voucher belum diimplementasikan; Discount tetap kosong untuk fixture akun baru, isFirstPurchase tidak berubah. Tidak menyatakan FR-05 selesai.
- Pemeriksaan aktual: 21 tes unit/fondasi dan 22 tes PostgreSQL lulus (termasuk registrasi bersamaan, hash/digest, rotasi/revokasi/expiry, role terbaru, profil sendiri/field injection/CSRF, rollback hook dan limiter concurrency). Lint/typecheck dan production build lulus. Uji HTTP server Next.js dari build dengan NODE_ENV=test/TEST_DATABASE_URL eksplisit lulus alur auth, cookie, akses, expiry/logout dan limiter; smoke HTTP fondasi tetap lulus.
- Privasi tes: semua akun auth/HTTP adalah fixture baru di test DB dan dibersihkan; secret test dibuat baru; admin demo .local pribadi tidak dibaca/dipakai. Tidak mencetak password/hash/digest/token/secret pada JSON publik atau dokumentasi.
- Batas UAT: mendukung UAT-01/UAT-18/UAT-39 untuk API; kepemilikan resource transaksi diuji ulang saat endpointnya dibuat. UI/browser/hosting, target performa, voucher, checkout, Midtrans dan ulasan tetap tahap terpisah.
- Serah terima: lanjut BE-04 untuk kategori/produk/stok; O-03 ambang menipis dan O-04/O-07 unggahan/storage tetap gerbang penerimaan terkait. Gunakan requireSessionUser untuk akses server; jangan hanya memeriksa menu UI. BE-05/BE-06 berjalan setelah dependensi katalog tersedia.

**Keluaran:** registrasi, login, logout, sesi, pemeriksaan peran, dan profil dasar akun sendiri.

**Pekerjaan:**

- Adaptasi pola hash/sesi LanggananKu setelah audit; buat akun baru pada database aplikasi.
- Registrasi publik hanya menghasilkan pembeli; email unik dan input tervalidasi.
- Terapkan proteksi sesi, CSRF sesuai mekanisme yang dipakai, serta pembatasan percobaan login yang memadai.
- Profil admin hanya mengizinkan perubahan nama tampilan miliknya; tolak perubahan peran dari input.
- Sediakan titik integrasi penerbitan voucher login pertama untuk BE-06; jangan menganggap FR-05 selesai pada BE-03.

**Kriteria selesai:** alur auth dan logout berfungsi; akses admin/pembeli serta pemilik data diuji; respons tidak membocorkan informasi sensitif. Registrasi tidak membutuhkan jenis kelamin, avatar, atau alamat.

**UAT:** UAT-01/UAT-18/UAT-39 serta pemeriksaan sesi/peran. **Batas:** fitur Ingatkan Saya, username baru, dan pengelolaan akun admin lain tidak termasuk.

### BE-04 — Kategori, produk, stok, dan foto

**Acuan:** FR-02, FR-09; bagian 24.2/24.4. **Dependensi:** BE-02/BE-03.

**Hasil 23 Oktober 2026:** Selesai untuk backend/local upload. Acuan aktif PRD **1.5** sesuai persetujuan pengguna: katalog/detail publik, stok menipis 1–5 tersedia, JPEG/PNG/WebP <=2.000.000 byte. Lihat [CATALOG.md](CATALOG.md) dan [API-CONTRACT.md](API-CONTRACT.md) v0.3.

#### Catatan hasil BE-04

- Status: Selesai; penanggung jawab individu belum ditetapkan kelompok. PRD 1.5 FR-02/FR-09, bagian 24.2/24.4.
- Implementasi: publik kategori/katalog/detail; admin daftar/filter/pagination, kategori create/update/delete kosong, produk create/read/update/nonaktif, stock PUT versi+lantai reservasi; upload/serve foto terverifikasi. Tulis hanya ADMIN + Origin, role dibaca sesi BE-03.
- Data: DTO publik aman, kategori/count konsisten, stok aktif/nonaktif terpisah dari availability, review rata-rata/count aktual/kosong. Tidak menerima reservedStock/photoKey/imageUrl/path/role dari body. Detail publik tidak membuka produk/kategori nonaktif; stok 0 tetap tampil.
- Keputusan: O-03/O-04 dan akses publik O-09 disetujui pengguna lalu PRD dinaikkan 1.5. O-07 lokal memakai filesystem privat persisten, test root terpisah; production wajib path absolute pada volume persisten dan flag eksplisit. Pemilihan/tes volume deployment tetap menunggu hosting, bukan keberhasilan yang diklaim.
- Migrasi: 202610230002_product_photos, metadata+FK/check/indeks dan Product.photoId nullable. Kolom/data lama dipertahankan; dev/test Salvora saja, migrasi 001 dan LanggananKu tidak diubah.
- Foto: sharp 0.35.5 pin langsung, file/MIME/byte/decode/piksel diperiksa; output WebP bersih/key UUID server, metadata DB. Preview pending/nonaktif admin; publik hanya foto produk/kategori aktif. Gagal insert metadata mencoba membersihkan file baru, tanpa recursive delete. Backup volume foto harus menyertai DB; GC/restore hosting belum dibuat/diuji.
- Bukti aktual: 28 unit/fondasi + 31 PostgreSQL lulus; lint/typecheck, production build dan HTTP katalog/foto lulus. Regresi HTTP auth/smoke fondasi lulus. Kasus termasuk peran/CSRF, invalid input, filter/count, histori snapshot, stok reserved/stale/concurrent, MIME/body/path foto dan cleanup kegagalan DB. Audit dependensi runtime 0; temuan tooling dev lama tetap tercatat.
- Kontrak: v0.3, endpoint katalog/admin/foto ditandai tersedia, image endpoint binary dan error JSON. Tidak ada endpoint keranjang/checkout/ulasan baru atau UI Figma penuh.
- Batas UAT: mendukung API FR-02/FR-09 dan UAT-16/UAT-17/UAT-37; stok diperiksa ulang saat BE-07 memakai reservasi nyata, UI dan deployment/performa mempunyai verifikasi tersendiri. Katalog tidak membuat reservasi.
- Serah terima: BE-05 siap untuk alamat/keranjang. Produk stok nol/nonaktif harus ditolak saat tambah keranjang; server memakai availableStock serta pemilik sesi. BE-06 juga dapat dimulai setelah memilih aturan pembulatan O-10. Ongkir/expiry tetap gerbang BE-07/BE-08.

**Keluaran:** baca katalog/detail, CRUD kategori dan produk oleh admin, pengaturan stok/aktif, serta unggahan foto tervalidasi.

**Pekerjaan:**

- Gunakan sumber kategori sama untuk pelanggan/admin. Hitung jumlah produk secara konsisten.
- Pisahkan status aktif dari status stok tersedia. Tetapkan keluaran stok menipis/habis menggunakan keputusan BE-00.
- Sediakan pencarian/filter/pagination admin. Produk nonaktif tidak ditawarkan kepada pembeli.
- Validasi harga, stok, kategori, jenis/ukuran foto; simpan referensi foto tanpa menerima path berbahaya dari input.
- Nonaktifkan produk yang memiliki riwayat; cegah penghapusan kategori yang masih dipakai.
- Penyesuaian stok tidak boleh melanggar reservasi saat BE-07 terintegrasi.

**Kriteria selesai:** akses tulis hanya admin; data tidak valid ditolak; produk aktif dengan stok nol tampil habis; pengubahan produk tidak merusak data transaksi historis. Validasi stok diuji ulang setelah reservasi tersedia.

**UAT:** UAT-16/UAT-17/UAT-37 serta validasi FR-09. **Batas:** pencarian katalog pelanggan lanjutan, varian kompleks, dan promosi harga tidak termasuk.

### BE-05 — Alamat dan keranjang

**Acuan:** FR-03/FR-04. **Dependensi:** BE-03/BE-04.

**Hasil 23 Oktober 2026:** Selesai untuk backend sesuai PRD 1.5. CRUD alamat, daftar/pagination sendiri dan keranjang persisten dari sesi BUYER tersedia. Penambahan produk sama atomik, PATCH jumlah absolut, validasi stok/harga terkini, DTO privat dan Origin diterapkan. Snapshot alamat pesanan tidak berubah mengikuti CRUD alamat. Keranjang tidak mencadangkan stok. Tidak ada migrasi/dependensi/config baru atau perubahan LanggananKu.

Kontrak v0.4 menetapkan cart.id null sebelum penambahan pertama berhasil (GET hanya membaca), serta DELETE item mengembalikan null agar penghapusan tidak terhalang subtotal yang melewati batas setelah perubahan harga. Lihat [BUYER.md](BUYER.md) untuk batas input, lock per akun, nominal/rollback, dan serah terima BE-06/BE-07.

Bukti aktual: **31 tes unit/fondasi + 41 tes PostgreSQL**, lint/typecheck/build, HTTP pembeli dengan sesi nyata dan smoke fondasi lulus. Tambahan BE-05 meliputi ownership/role/Origin, DTO/pagination, snapshot alamat, penambahan pertama bersamaan, stok tersedia setelah reservasi, nonaktif/habis, harga terkini, batas nominal/rollback serta penghapusan. UI dan alur checkout belum tersedia; gerbang keranjang kosong saat checkout diselesaikan BE-07. Ongkir/wilayah, expiry, voucher dan pembayaran tidak diimplementasikan oleh BE-05.

**Keluaran:** pengelolaan alamat dan keranjang milik pembeli.

**Pekerjaan:**

- Pastikan kepemilikan dari sesi, bukan `user_id` yang dikirim browser.
- Gabungkan produk sama pada satu baris keranjang; validasi jumlah dan ketersediaan.
- Simpan alamat dengan data minimum PRD; alamat akun tidak menjadi sumber yang berubah untuk pesanan historis.
- Nyatakan bahwa keranjang belum melakukan reservasi stok.

**Kriteria selesai:** akun tidak dapat membaca/mengubah data akun lain; jumlah negatif/nol dan produk tidak tersedia ditangani sesuai kontrak; keranjang kosong memiliki hasil yang jelas.

**UAT:** UAT-18 untuk prinsip akses, skenario FR-03/FR-04. **Batas:** pickup dan ongkir wilayah dinamis tidak termasuk.

### BE-06 — Voucher pembeli baru dan perhitungan harga

**Acuan:** FR-05; bagian 9 dan 11. **Dependensi:** BE-03/BE-04.

**Hasil 23 Oktober 2026:** Selesai sesuai PRD 1.6. Penerbitan voucher idempoten saat registrasi/login yang memenuhi syarat dan GET /api/me/voucher tersedia. Lock User sebelum insert sesi mencegah deadlock login bersamaan; transaksi dan unique userId menjaga satu voucher tanpa mereset RESERVED/USED atau isFirstPurchase. Pemeriksaan kelayakan juga membaca riwayat sukses/refund/reversal/application. Tidak ada migrasi/dependensi/config baru. Layanan harga dari cart/Product pemilik memakai BigInt: diskon otomatis 20%, floor sekali pada subtotal seluruh barang, maksimal Rp100.000; ongkir ditambahkan sesudah diskon dan tanpa default tarif. Rincian [VOUCHERS.md](VOUCHERS.md) dan kontrak API v0.6.

**Verifikasi:** O-10 ditutup setelah pengguna menyetujui penetapan aturan sesuai kebutuhan bisnis; PRD diperbarui 1.6. **38 tes unit/fondasi + 51 tes PostgreSQL**, lint/typecheck/build lulus; HTTP auth/voucher dan regresi alamat/keranjang, katalog/foto serta fondasi lulus selama BE-06. Kasus harga mencakup pecahan, pembulatan subtotal keseluruhan, tanpa minimum tambahan, batas cap, perubahan harga/kelayakan dan ongkir tetap. Reservasi/penggunaan/pelepasan voucher dan persaingan checkout tetap BE-07/BE-09/BE-10. Tidak ada endpoint quote atau pilihan ongkir baru. BE-07 dapat memakai priceBuyerCart setelah menutup ongkir/wilayah dan expiry.

**Keluaran:** penerbitan voucher idempoten saat login yang memenuhi syarat, serta perhitungan subtotal/diskon/total di server.

**Pekerjaan:**

- Tambahkan pencegahan penerbitan ganda lintas login bersamaan pada tingkat penyimpanan.
- Terapkan diskon 20%, maksimal Rp100.000, satu kali, tanpa minimum belanja tambahan.
- Gunakan aritmetika uang yang konsisten; potongan tidak berlaku untuk ongkir.
- Rancang status tersedia/dicadangkan/terpakai untuk dipakai BE-07/BE-09/BE-10.
- Jangan menghabiskan voucher saat login atau saat baru membuat pesanan.

**Kriteria selesai:** batas diskon dan login ulang diuji; bukan pembeli tidak mendapat voucher; tidak ada CRUD promo umum. Pengujian penggunaan bersamaan dan pelepasan reservasi ditutup bersama task dependennya.

**UAT:** UAT-02/UAT-03/UAT-04; fondasi UAT-05/UAT-38. **Batas:** beli 2 gratis 1, voucher kampanye, dan perubahan persentase oleh admin tidak termasuk.

### BE-07 — Checkout, pesanan, dan reservasi

**Acuan:** FR-06; bagian 9–11 dan 13. **Dependensi:** BE-05/BE-06; keputusan ongkir/expiry BE-00.

**Hasil 23 Oktober 2026:** Selesai untuk backend sesuai PRD 1.7. O-01 dipilih pengguna 60 menit sejak order dibuat; O-02 delivery manual awal Kota Tanjungpinang, Kepulauan Riau, Rp10.000 per pesanan. Quote server TTL 5 menit tanpa reservasi, konfirmasi menghitung ulang dan menolak snapshot berubah. Order/idempotensi/reservasi stok/voucher/history/penghapusan item cart tersimpan atomik; snapshot immutable memakai skema BE-02 tanpa migrasi/dependensi baru. Replay key/input sama tidak memperpanjang deadline, key/input berbeda 409, referensi asing 404. Lihat [CHECKOUT.md](CHECKOUT.md) dan kontrak API v0.7.

**Bukti:** 40 tes unit/fondasi + 65 tes PostgreSQL, lint/typecheck/build serta HTTP pembeli/checkout dan smoke fondasi lulus. Kasus penting: last-unit dua pembeli, empat konfirmasi key sama, satu voucher satu order aktif, harga/alamat/cart/kelayakan berubah, rollback setelah reservasi, mutasi cart bersamaan, tenggat persis 60 menit, snapshot/replay setelah perubahan katalog/alamat, dan region/Origin/role/owner. Fixture DB test terpisah dan dibersihkan spesifik. Tidak ada panggilan Midtrans, frontend lengkap atau job release otomatis; BE-08/BE-09/BE-10 menutup pembayaran, konsumsi dan pelepasan aman. GET order/riwayat tetap BE-11. Tidak ada perubahan LanggananKu atau fitur luar PRD.

**Keluaran:** ringkasan checkout terverifikasi dan pembuatan pesanan atomik dengan reservasi.

**Pekerjaan:**

- Hitung ulang harga, stok, alamat, ongkir dan kelayakan voucher pada server sebelum konfirmasi.
- Simpan salinan item/harga/alamat serta total; informasikan perubahan harga untuk ditinjau pembeli.
- Cegah pesanan ganda karena konfirmasi berulang menggunakan mekanisme idempotensi yang terkait pemilik dan input.
- Terapkan penguncian/constraint untuk stok bersama dan voucher, dengan urutan konsisten agar konflik ditangani.
- Cadangkan stok/voucher, catat batas pesanan, lalu keluarkan item yang dipesan dari keranjang secara aman.

**Kriteria selesai:** dua akun tidak sama-sama memperoleh unit terakhir; voucher tidak terikat ke dua pesanan aktif; kegagalan sebagian di-rollback; salinan transaksi tidak berubah mengikuti katalog/alamat.

**UAT:** UAT-05/UAT-06/UAT-07/UAT-16. **Batas:** belum menandai pembayaran sukses atau memanggil aktivasi langganan.

### BE-08 — Adaptasi Midtrans dan pembuatan pembayaran

**Acuan:** FR-07, bagian 14.1. **Dependensi:** BE-07; akses dan kebijakan expiry BE-00.

**Hasil 23 Oktober 2026:** Selesai untuk pembuatan/melanjutkan Snap sesuai PRD 1.7. POST orders/{orderId}/payments hanya BUYER pemilik+Origin, payload {}, token whitelist pemilik. Referensi SV-UUID per attempt, snapshot item/diskon/ongkir cocok total, expiry sejak order.createdAt 60 menit. CREATED/event dipersistenkan sebelum satu request provider di luar transaksi; klik bersamaan/reuse tidak membuat attempt baru. Timeout/network/5xx/duplicate/response invalid menjadi UNCONFIRMED dan memblokir retry. Partial index serta pemeriksaan bukti penolakan mencegah dua transaksi potensial aktif. Tidak ada migrasi/dependensi baru atau logika langganan. Rincian [PAYMENTS.md](PAYMENTS.md), kontrak API v0.8.

**Bukti:** 46 tes unit/fondasi + 77 tes PostgreSQL, lint/typecheck/build dan HTTP pembeli/checkout/payment guards/finish lulus. Uji provider nyata berhasil membuat dan menyimpan token Snap Sandbox (HTTP 201), order test Rp14.000, pukul 03:01:32 WIB 23 Oktober 2026. Key/token tidak dicetak; proof aman dan referensi fixture tersimpan privat untuk rekonsiliasi. Belum memilih/membayar VA, menerima webhook atau melunaskan order. snapConfig (--snap) terpisah dari kesiapan webhook HTTPS (--payment); dua key lokal pengguna sudah valid untuk token. URL publik/handler signature/penerapan sukses BE-09, unknown/retry/release BE-10 dan uji minimal satu VA sukses O-06 tetap terbuka. Finish/parameter browser tidak mengubah status order.

**Keluaran:** pembuatan/melanjutkan Snap serta pencatatan percobaan pembayaran.

**Pekerjaan:**

- Adaptasi pembungkus Midtrans; hanya gunakan sandbox dan nominal pesanan dari server.
- Buat referensi Midtrans unik per percobaan, terpisah dari nomor pesanan toko.
- Simpan token, redirect URL, nominal dan expiry. Kirim rincian yang cocok dengan total.
- Cegah lebih dari satu percobaan yang masih mungkin dibayar; gunakan token aktif yang sama saat melanjutkan.
- Bedakan permintaan ditolak dari timeout yang mungkin terjadi setelah provider menerima transaksi.
- Pisahkan server key dari client key serta data yang boleh dikirim ke browser.

**Kriteria selesai:** hanya pemilik pesanan yang memenuhi syarat dapat membuat pembayaran; klik ulang tidak membuat charge baru; timeout tidak membuka retry berbahaya. Panggilan sandbox nyata dicatat sebagai telah diuji hanya jika benar-benar berhasil.

**UAT:** UAT-09/UAT-10/UAT-26/UAT-30/UAT-33 sesuai tahap. **Batas:** pembayaran sukses belum boleh diterapkan dari respons browser/Snap.

### BE-09 — Webhook dan penerapan pembayaran

**Hasil 23 Oktober 2026:** Backend selesai sesuai PRD 1.7. Handler POST webhook memvalidasi signature, referensi, identitas dan nominal serta memeriksa Get Status Sandbox terbaru. Penerapan sukses atomik mengonsumsi stok/voucher dan mencatat PaymentApplication unik, flag pembelian pertama serta riwayat. Duplicate/out-of-order, rollback, dua sukses, refund/reversal dan sukses terlambat ditangani tanpa pemenuhan ganda. Tidak ada migrasi/dependensi baru atau perubahan LanggananKu. Kontrak API v0.9 dan rincian [WEBHOOKS.md](WEBHOOKS.md).

**Bukti:** 50 tes unit/fondasi + 93 tes PostgreSQL, lint/typecheck/build dan HTTP webhook dengan key tiruan lulus. Tunnel HTTPS sementara lolos probe 403 signature palsu/404 root, token Snap Sandbox nyata Rp14.000 berhasil dibuat dengan override notifikasi per transaksi. Pengguna meminta melanjutkan tanpa simulasi VA; belum ada bukti webhook sukses/pembayaran lunas Salvora. O-06/UAT terkait tetap terbuka untuk BE-14. Tunnel dan server uji dihentikan; fixture/provider reference dipertahankan privat untuk rekonsiliasi. Release/retry/penjadwal BE-10 belum diimplementasikan.

**Acuan:** FR-07; bagian 10–11/14.1. **Dependensi:** BE-08.

**Keluaran:** webhook Midtrans terverifikasi dan penerapan perubahan transaksi tepat satu kali.

**Pekerjaan:**

- Validasi payload/signature/referensi/nominal, kemudian periksa status terbaru melalui API server Midtrans.
- Peta status sesuai PRD, termasuk hasil belum pasti dan pengecualian setelah sukses; jangan menyalin kebijakan lama tanpa audit.
- Dalam transaksi database, terapkan pembayaran ke pesanan, stok, voucher terkait, dan penanda pembelian pertama; pesanan tanpa voucher tetap valid.
- Deduplicasi penerapan lintas event/percobaan dan catat peristiwa tanpa rahasia.
- Tangani callback berulang, tidak berurutan, signature salah, nominal salah, dan kegagalan database tanpa penyimpanan sebagian.
- Catat dua pembayaran sukses untuk pesanan sama, tetapi pemenuhan hanya sekali; tandai pengecualian.

**Kriteria selesai:** tidak ada `Plan`/`Subscription` yang diaktifkan; webhook palsu tidak mengubah data; duplicate/out-of-order aman; redirect/callback browser tidak menentukan sukses; refund/reversal ditandai sesuai PRD.

**UAT:** UAT-08/UAT-11/UAT-12/UAT-13/UAT-28/UAT-32/UAT-34/UAT-35. **Batas:** tidak membuat layanan refund otomatis atau tombol admin untuk memaksakan status sukses.

### BE-10 — Rekonsiliasi, retry, dan kedaluwarsa

**Hasil 23 Oktober 2026:** Selesai backend PRD 1.7. Endpoint rekonsiliasi pemilik/admin memakai Origin dan limiter DB; sumber STATUS_API/SCHEDULER memakai service verifikasi/penerapan bersama BE-09. Retry butuh bukti terminal semua attempt dan mempertahankan order/snapshot/tenggat. Release atomik hanya setelah tenggat serta semua attempt dipastikan tidak aktif, tanpa mengurangi stok fisik. Pending/404/timeout/status asing ditahan. Tidak ada migrasi, dependensi atau perubahan LanggananKu. Kontrak API v0.10; rincian [RECONCILIATION.md](RECONCILIATION.md).

**Bukti:** 50 tes unit/fondasi + 108 tes PostgreSQL, lint/typecheck/build, HTTP rekonsiliasi dan regresi webhook lulus. Mencakup akses/limiter, rollback/concurrent release, mixed attempt, deadline tetap, late success, race webhook/reconcile, lock worker dan antrean. CLI dev kosong berhasil. Pengguna menyetujui Windows Task Scheduler lokal tiap menit; task terpasang Limited/hidden dan tick otomatis 05:02:38 WIB sukses, LastTaskResult 0. Tidak membutuhkan browser/Next.js aktif, tetapi komputer/login pengguna/PostgreSQL/jaringan harus tersedia. O-08 lokal ditutup; hosting/job server tetap terbuka. Tidak melakukan pembayaran provider; O-06/VA lunas tetap BE-14. BE-11 dapat dilanjutkan.

**Acuan:** FR-07; bagian 10–11/14.1. **Dependensi:** BE-09; mekanisme penjadwal BE-00.

**Keluaran:** pemeriksaan status milik pembeli/admin, pemrosesan terjadwal, serta pelepasan reservasi yang aman.

**Pekerjaan:**

- Pemeriksaan manual dari aplikasi harus berotorisasi dan dibatasi frekuensinya.
- Proses terjadwal menggunakan akses internal yang terjaga, tidak bergantung pada pengguna membuka halaman.
- Jangan melepas reservasi hanya karena jam lokal lewat bila transaksi provider masih mungkin dibayar atau belum dapat dipastikan.
- Retry menggunakan pesanan sama dan referensi baru hanya setelah percobaan sebelumnya terminal; expiry tidak diperpanjang diam-diam.
- Pembayaran terlambat setelah reservasi dilepas dicatat sebagai Perlu Penanganan tanpa pengiriman otomatis.
- Tutup popup atau memilih tidak mencoba lagi hanya mengakhiri interaksi, bukan membatalkan transaksi provider.

**Kriteria selesai:** seluruh jalur timeout/expiry/late success diuji; reservasi dilepas tepat sekali; proses terjadwal dapat diulang; gangguan provider tidak menyamar sebagai pembayaran gagal/sukses.

**UAT:** UAT-09/UAT-10/UAT-14/UAT-15/UAT-29/UAT-30/UAT-33.

### BE-11 — Riwayat, detail, dan pemenuhan pesanan

**Penerimaan backend terbaru 23 Oktober 2026: Selesai.** Laporan 19 tes PostgreSQL terisolasi ditelaah terhadap sumber; ditambah 7 kelompok HTTP Next.js nyata dan regresi 108 tes pembayaran/integritas. Owner/admin, snapshot, status/receipt, history, rollback, concurrency/refund race dan privasi tercakup. Dua tick otomatis antrean kosong juga terverifikasi. Bukti/rentang waktu dan keterbatasan retensi regresi pertama: [BE14-RECONCILIATION.md](BE14-RECONCILIATION.md). Paragraf berikut mempertahankan hasil awal sebelum PostgreSQL dipulihkan; bukan status terbaru.

**Hasil 23 Oktober 2026:** Ditinjau. Daftar/detail pembeli dan admin, filter/pagination, pemantauan attempt pembayaran, catatan internal dan transisi pemenuhan tersedia. Pengguna menyetujui konfirmasi penerimaan manual oleh admin (`receiptConfirmed=true` dan catatan wajib), tercatat pada PRD 1.8. Mutasi mengunci User → Order, memeriksa pembayaran SUCCESS yang telah diterapkan, konsumsi reservasi dan status lama. Tidak ada override pembayaran, penghitungan ulang snapshot, migrasi atau dependensi baru.

**Bukti dan batas:** 75 unit/fondasi (20 BE-11), typecheck, lint dan build lulus. Service/handler menggunakan mock; ini tidak membuktikan transaksi PostgreSQL, rollback, race atau HTTP dengan database nyata. Pengguna menunda startup cluster 55433 sampai dampak antrean pembayaran dipastikan. Tidak menyalakan database, menjalankan worker manual, mengubah task atau memanggil gateway. Penutupan BE-11 menunggu pengujian database terisolasi dan HTTP sebagaimana [ORDERS.md](ORDERS.md); bukan klaim worker kembali normal. Bukti BE-10 di atas bersifat historis.

**Acuan:** FR-08/FR-10; bagian 24.2/24.3. **Dependensi:** BE-07/BE-09; penerimaan final setelah BE-10.

**Keluaran:** daftar/detail milik pembeli, daftar/detail admin, pemantauan pembayaran, dan transisi status pemenuhan.

**Pekerjaan:**

- Tampilkan nomor/tanggal, item multi-produk, total, alamat historis, status pembayaran/pesanan terpisah, kanal, serta riwayat.
- Sediakan filter dan pagination admin sesuai FR-10. Data pelanggan hanya tersedia bagi pihak yang berhak.
- Terapkan Diproses → Dikirim → Selesai berdasarkan izin dan kondisi pembayaran. Catat pelaku serta waktu.
- Sediakan kasus Perlu Penanganan dengan catatan admin tanpa override sukses pembayaran. Catatan tidak mengubah nilai transaksi atau otomatis menyelesaikan refund.
- Jangan menyediakan hapus pesanan rutin atau hitung ulang total saat status pengiriman berubah.

**Kriteria selesai:** akses lintas akun ditolak; pesanan belum dibayar tidak dikirim; transisi ilegal gagal; riwayat/nominal tetap utuh. Status Aktif/Tidak Aktif tidak dipakai untuk pesanan.

**UAT:** UAT-16/UAT-18 serta penerimaan FR-10. **Batas:** ekspor, COD, pickup, dan integrasi kurir otomatis tidak termasuk.

### BE-12 — Rating dan ulasan terverifikasi

**Penerimaan backend terbaru 23 Oktober 2026: Selesai.** PostgreSQL nyata membuktikan owner/completed, unique/concurrent/rollback, repeat purchase, agregasi dan refund race; HTTP baru memakai cookie/sesi nyata membuktikan public list/summary/privacy dan 201/409/role. Rujukan [BE14-RECONCILIATION.md](BE14-RECONCILIATION.md). Hasil awal Ditinjau di bawah bersifat historis; VA dan frontend tetap penerimaan terpisah BE-14.

**Hasil 23 Oktober 2026:** Ditinjau. POST ulasan item dan GET ulasan produk tersedia; pengguna menyetujui rating integer 1–5, komentar trim 10–1.000 karakter dan satu ulasan per item (PRD 1.9/O-05, kontrak 0.13). Produk/pembeli diturunkan dari relasi item; owner/status COMPLETED diperiksa ulang setelah lock User → Order. Unique constraint existing menangani duplikat, DTO publik hanya nama tampilan tanpa identitas akun/alamat. Daftar publik mengikuti visibilitas katalog, pagination dan agregasi rating data tersimpan. Pembelian berbeda boleh mengulas produk sama. Tidak ada migrasi/dependensi atau fitur moderasi P1.

**Bukti dan batas:** 103 unit/fondasi (16 baru BE-12), lint/typecheck/build lulus. Service/handler memakai mock. PostgreSQL/HTTP nyata, insert concurrent/rollback/race dan kesesuaian agregasi katalog setelah insert belum dibuktikan; daftar uji terisolasi pada [REVIEWS.md](REVIEWS.md). Cluster tidak dinyalakan, worker/gateway tidak dipanggil manual, Scheduled Task tidak diubah. Penerimaan BE-11/BE-12/BE-13 tetap tertunda; bukan klaim pemulihan worker atau penyelesaian BE-14.

**Acuan:** FR-11. **Dependensi:** BE-11.

**Keluaran:** pembuatan ulasan item selesai dan pembacaan rating/ulasan produk.

**Pekerjaan:**

- Periksa pemilik melalui `order_items → orders → users`; ulangi validasi saat penyimpanan.
- Terapkan rating 1–5, validasi komentar sesuai keputusan, dan maksimal satu ulasan per item.
- Pastikan submit bersamaan tidak membuat duplikat; perhitungan rata-rata tidak memakai data contoh.
- Gunakan identitas publik yang aman; jangan mengekspos email/alamat pembeli.

**Kriteria selesai:** bukan pemilik/belum selesai ditolak; data valid tampil pada produk; pembelian berbeda dapat memiliki ulasan berbeda sesuai PRD.

**UAT:** UAT-19/UAT-20/UAT-21. **Batas:** moderasi dan pemilihan testimoni beranda masih P1.

### BE-13 — Dashboard operasional dan pemantauan voucher

**Penerimaan backend terbaru 23 Oktober 2026: Selesai.** 19-suite mencakup batas tanggal, total/status, stok fisik−reservasi, batas daftar, relasi/pagination serta snapshot ketika koneksi lain menulis; 7 kelompok HTTP baru mencakup dashboard/vouchers/policy dan akses. Rujukan [BE14-RECONCILIATION.md](BE14-RECONCILIATION.md). Catatan Ditinjau di bawah adalah hasil awal, bukan status saat ini.

**Hasil 23 Oktober 2026:** Ditinjau. Endpoint GET dashboard/vouchers/voucher-policy khusus admin tersedia sesuai PRD 1.8 FR-13, kontrak API 0.12. Periode createdAt sama untuk total/status/pesanan terbaru, seluruh status termasuk nol; produk aktif termasuk stok nol. Inventaris global saat ini menghitung fisik dikurangi reservasi, kelompok 1–5/0, hitungan penuh dengan daftar maksimal 10. Pemantauan voucher memakai status/owner/relasi database tanpa mutasi, reset atau promo umum. Tidak menambah metrik keuangan opsional, migrasi atau dependensi.

**Bukti dan batas:** 87 unit/fondasi (12 baru BE-13), lint/typecheck/build lulus. Prisma/HTTP handler memakai mock; SQL belum dieksekusi di PostgreSQL. Verifikasi agregasi aktual, batas tanggal/stok, relasi voucher dan HTTP nyata tertunda sesuai [DASHBOARD.md](DASHBOARD.md). Cluster 55433 tidak dinyalakan, worker/gateway tidak dipanggil manual dan task tidak diubah. BE-11/BE-13 belum ditutup penuh; BE-12 tidak menjadi dependensi BE-13.

**Acuan:** FR-13; bagian 24. **Dependensi:** BE-04/BE-06/BE-09/BE-11.

**Keluaran:** data dashboard sederhana dan daftar voucher untuk admin.

**Pekerjaan:**

- Hitung produk aktif, pesanan/status pada periode sama, pesanan terbaru, dan stok menipis/habis.
- Jika menampilkan pelanggan/nilai pembayaran, ikuti label serta definisi FR-13; jangan menyebut laba atau menyembunyikan pembayaran ganda/refund.
- Tampilkan aturan voucher tetap, pemilik, status, dan pesanan terkait dengan akses admin.
- Gunakan kueri data aktual, pagination jika diperlukan, dan keadaan kosong.

**Kriteria selesai:** ringkasan cocok dengan data uji; tidak ada CRUD promo umum; stok sudah memperhitungkan reservasi; voucher terpakai tidak dapat direset melalui endpoint ini.

**UAT:** UAT-36/UAT-37/UAT-38. **Batas:** grafik tahunan, ekspor, ranking penjualan lengkap, CMS, dan preferensi notifikasi tidak termasuk.

### BE-14 — Verifikasi terintegrasi dan serah terima frontend

**Penerimaan akhir backend 24 Oktober 2026: Selesai.** Pengguna menyelesaikan simulator. SQL read-only dan GET Status Sandbox untuk run baru terverifikasi 13:53:25 WIB: BNI bank_transfer settlement Rp14.000 IDR, referensi/transaction ID cocok, paid sebelum deadline; Payment SUCCESS/Order PROCESSING, 1 attempt/1 PaymentApplication/1 transisi PROCESSING/1 event WEBHOOK VERIFIED SUCCESS, stok 0/reservasi CONSUMED/voucher USED/firstPurchase=false. Dua HTTP 200 pada lifecycle bukan klaim dua settlement identik. Fixture baru/lama dipertahankan, server/tunnel milik run ditutup, dev tetap HTTP 200 dan worker 13:55 COMPLETED checked=0. O-06 ditutup; tanpa charge/rekonsiliasi tambahan, task/config/dev tidak diubah.

**Dasar dan batas:** 19-suite PostgreSQL/7 kelompok HTTP, regresi 108 bersih, migrasi DB baru/seed/role isolation/restore, dokumentasi/serah terima dan provider memenuhi kriteria backend. Cacat cleanup harness auth telah ditindaklanjuti; selisih retensi run pertama tetap tidak dapat dipastikan retrospektif, tidak dinyatakan pulih dan tidak dimasukkan sebagai bukti bersih. Penutupan berdasar run/evidence yang lengkap, bukan menghapus catatan audit itu. UI/Figma/responsif, hosting/volume foto/job server dan restore foto adalah penerimaan produk/deployment terpisah, belum selesai. Bukti dan pertimbangan status ada di bagian akhir [BE14-RECONCILIATION.md](BE14-RECONCILIATION.md). Paragraf Dikerjakan/menunggu di bawah adalah histori sebelum verifikasi provider.

**Pembaruan 24 Oktober 2026 setelah restart:** pengguna memulai cluster dan development server manual. SQL dev/test:55433, role test terisolasi, home/health 200 serta lima antrean dev nol terverifikasi. Task Ready/PT1M/LastTaskResult=0 pada 13:47 WIB; report worker 13:46 COMPLETED checked=0. Semua tiga transaksi lama memiliki tenggat lokal lewat dan tidak ada application/event webhook sukses tersimpan. Pengguna menyetujui tepat satu transaksi Sandbox baru Rp14.000; run/proof UUID baru siap 13:48 WIB dengan tenggat 14:48, menunggu interaksi VA. Tidak memakai referensi lama, menyalakan ulang cluster oleh agent, mengubah task/dev/.env atau menjalankan worker manual. Belum bukti provider lunas, BE-14 tetap Dikerjakan. Rincian pada laporan rekonsiliasi; statistik 23 Oktober berikut adalah histori.

**Pelaksanaan setelah persetujuan tambahan:** pengguna menyetujui target database/role sementara dan satu transaksi Sandbox baru Rp14.000. Verifier fresh DB lulus 15:36 WIB: dua migrasi Prisma, seed/idempotensi/role isolation, dump/restore ke database sementara kedua, cleanup kedua target/role dan fingerprint dev/test VERIFIED_UNCHANGED. Tidak mengubah allowlist runtime atau migrasi sumber; seed diekstrak menjadi fungsi bersama untuk CLI dan verifier. Satu server test/tunnel HTTPS baru lolos signature 403/root 404, Snap token baru tersedia dengan proof UUID unik, menunggu pengguna memilih VA/simulator. Belum mengklaim pembayaran berhasil atau menutup BE-14. Semua hasil baru pada [BE14-RECONCILIATION.md](BE14-RECONCILIATION.md); paragraf lama di bawah bersifat historis.

**Rekonsiliasi lanjutan 23 Oktober 2026:** Dikerjakan. Sumber/laporan 19 tes terverifikasi cakupannya tanpa rerun. Tambahan: 108 tes regresi lulus setelah perbaikan cleanup auth; 7 kelompok HTTP Next.js/cookie/SQL hingga ulasan lulus; 3 tahap migrasi SQL/dump/restore schema fixture lulus; ketiganya fingerprint 19 tabel cocok. Dua tick 14:09 dan 14:12 WIB COMPLETED/exit 0 checked=0. SQL read-only 14:17 membuktikan identitas dev/test:55433, lima antrean dev nol dan role test tidak punya CONNECT dev. Tidak memulai/mengubah task, DB dev, config pembayaran atau backup/rollback.

**Batas yang tetap terbuka:** regresi pertama 108 assertion lulus tetapi fingerprint mismatch, tidak boleh diklaim bersih; cacat cleanup counter auth diperbaiki untuk run berikutnya, selisih pertama tidak terpulihkan secara retrospektif dan tidak dihapus berdasarkan tebakan. Schema rehearsal bukan Prisma deploy database kosong baru. Dua bukti provider lama masih PENDING/applied=false; Snap config valid tetapi webhook HTTPS belum siap. Belum ada pembayaran VA baru. Rencana target baru dan satu Sandbox Rp14.000 disiapkan dengan persetujuan terpisah; lihat [BE14-RECONCILIATION.md](BE14-RECONCILIATION.md). Catatan awal di bawah dipertahankan sebagai histori.

**Hasil 23 Oktober 2026:** Dikerjakan, belum selesai. [BACKEND-VERIFICATION.md](BACKEND-VERIFICATION.md) memetakan seluruh 39 UAT, bukti saat ini/historis, pemeriksaan yang belum dilakukan dan urutan penutupan. [FRONTEND-HANDOFF.md](FRONTEND-HANDOFF.md) menyerahkan peta halaman/API, payload tanpa kredensial, izin, error dan perilaku UI. Kontrak tetap 0.13/PRD 1.9; tidak menambah fitur.

**Bukti aktual:** 103 tes unit/fondasi, 11 tes orkestrasi worker mock, 8 skenario penjadwal mock, lint/typecheck/build, smoke HTTP fondasi dan validasi statis Prisma lulus. Smoke lama diperbarui dari asumsi endpoint rencana ke dispatch metode tidak didukung pada route yang kini tersedia, tanpa mengakses handler bisnis/DB/provider. Percobaan awal tes worker gagal spawn EPERM sandbox lalu lulus dengan izin; validasi Prisma awal gagal wrapper tanpa detail, pengulangan dengan izin lulus (penyebab awal tidak dipastikan). Tidak menjalankan tes GUI launcher karena runner dapat membangun ulang binary aktif.

**Belum terpenuhi:** startup/antrean/tick sehat, regresi PostgreSQL dan HTTP bisnis pada kode terbaru, suite DB khusus BE-11–BE-13 serta alur terintegrasi sampai ulasan, migrasi pada DB kosong baru, backup/restore terisolasi, VA lunas/webhook provider Salvora, hosting/volume/job server dan UAT frontend. Task tetap tiap menit tanpa perubahan; cluster tidak dinyalakan dan worker tidak dijalankan manual. Bukti historis 108 tes DB BE-10 tidak menutup regresi baru. BE-11–BE-13 dan BE-14 tidak dinyatakan selesai; pemulihan memerlukan persetujuan terpisah sesuai arahan pengguna.

**Acuan:** bagian 16–17/22/25. **Dependensi:** BE-00 sampai BE-13.

**Keluaran:** laporan pemeriksaan aktual, kontrak API final untuk cakupan backend, panduan setup/migrasi/sandbox/penjadwal, dan daftar keterbatasan.

**Pekerjaan:**

- Jalankan alur akun baru → katalog → keranjang/alamat → voucher → checkout → pembayaran → pemenuhan → ulasan melalui backend.
- Jalankan pemeriksaan integritas, akses, concurrency, idempotensi, callback, timeout, expiry dan kegagalan yang relevan.
- Buktikan minimal satu kanal bank/VA sandbox nyata berhasil. Mock membantu pengujian tetapi bukan bukti integrasi provider selesai.
- Uji migrasi pada database baru, dokumentasikan seed serta pemulihan yang diperlukan, dan pastikan koneksi terpisah dari LanggananKu.
- Serahkan bentuk data, contoh payload tanpa rahasia, daftar kesalahan, hak akses, serta perilaku UI yang diperlukan frontend.
- Petakan UAT backend yang lulus, belum diuji, dan gagal. UAT visual/responsif dinyatakan menunggu integrasi frontend.

**Kriteria selesai:** tidak ada masalah kritis pada cakupan backend; seluruh kriteria task sebelumnya memiliki bukti; hambatan eksternal dilaporkan jujur. Jangan menyatakan keseluruhan produk selesai sebelum frontend dan UAT produk diselesaikan.

**UAT:** seluruh UAT yang berlaku pada backend; UAT-22/UAT-23/UAT-24/UAT-27 dan penerimaan visual lainnya tetap memiliki verifikasi frontend tersendiri.

## 4. Kandidat lanjutan — tidak otomatis dikerjakan

| Kandidat | Syarat sebelum menjadi task implementasi |
|---|---|
| Grafik dan analitik penjualan | Definisi metrik, periode, sumber data, dan UAT |
| Ekspor pesanan | Format, kolom, filter, akses, dan batas data |
| CMS profil toko | Kolom, validasi, unggahan, serta pemakaian pada halaman pelanggan |
| Moderasi ulasan/testimoni | Alasan moderasi, hak akses, aturan publikasi, dan audit |
| Formulir kontak/pesan | Tujuan penyimpanan, kontak balasan, anti-spam, serta halaman admin |
| Notifikasi | Kanal, pemicu, pusat baca, preferensi, dan mekanisme pengiriman |
| Pickup/gratis ongkir/tarif wilayah | Aturan hitung, status pemenuhan, snapshot kebijakan, dan pengujian checkout |
| Promo umum | Aturan kelayakan, penggabungan, periode, perhitungan, dan perubahan PRD |

COD dan transfer manual juga tidak diimplementasikan hanya karena ada pada gambar. Perubahan metode pembayaran memerlukan keputusan eksplisit serta penyelarasan seluruh alur.

## 5. Format catatan hasil task

Salin format berikut ke catatan task yang sedang dikerjakan atau laporan pada dokumen ini:

```markdown
### Hasil BE-xx — Judul

- Status: Dikerjakan / Ditinjau / Selesai / Terhambat
- PRD acuan: versi dan bagian/FR
- Penanggung jawab: belum ditetapkan / nama
- Tanggal: tanggal aktual
- Keputusan terkait: ID/catatan keputusan
- Implementasi dan dokumen yang berubah:
- Migrasi atau perubahan kontrak API:
- Pemeriksaan yang dijalankan dan hasil aktual:
- Kriteria yang belum terpenuhi:
- Hambatan dan dampak pada dependensi:
- Catatan untuk task berikutnya:
```

Jika task implementasi mengungkap kebutuhan baru, catat usulan dan dampaknya, lalu perbarui PRD sebelum mengerjakan perubahan yang bergantung padanya. Jangan menyisipkan keputusan bisnis baru hanya di kode atau catatan task.
