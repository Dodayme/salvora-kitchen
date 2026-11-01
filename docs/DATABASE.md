# PostgreSQL dan migrasi — BE-02

Tanggal: 23 Oktober 2026. Fondasi BE-02 mengacu PRD 1.4; pembaruan foto BE-04 mengikuti PRD 1.5. Schema sumber `prisma/schema.prisma`, migrasi awal `202610230001_init` dan tambahan `202610230002_product_photos`. Tidak ada model Plan/Subscription atau data pengguna dari proyek lama.

## 1. Lingkungan lokal yang disiapkan

PostgreSQL **18.6** dari binary lokal, Prisma/adapter-pg **7.10.1**, driver pg **8.23.1**. Cluster baru berada di `.local/postgres/data`, hanya mendengarkan **127.0.0.1:55433**, dengan autentikasi SCRAM-SHA-256. Tidak memakai, menghentikan, mengubah konfigurasi, atau memigrasi service `postgresql-x64-18` yang sudah ada.

| Lingkungan | Database | Role lokal | Kegunaan |
|---|---|---|---|
| Pengembangan | `salvora_kitchen_dev` | `salvora_dev` | Migrasi, katalog demo, admin internal baru |
| Pengujian | `salvora_kitchen_test` | `salvora_test` | Migrasi dan tes PostgreSQL nyata; tidak memakai data dev |
| Shadow | `salvora_kitchen_shadow` | `salvora_shadow` | Disediakan untuk pengembangan migrasi nanti; bukan target runtime/test |
| Demo hosting | `salvora_kitchen_demo` | Belum diprovisikan | Menunggu pilihan hosting/DB demo; tidak dianggap sudah deploy |

Role dev/test/shadow bukan superuser, tidak dapat membuat database/role. Hak CONNECT publik dicabut pada database khusus tersebut; tiap role hanya mendapat database miliknya. Kredensial bootstrap cluster baru hanya ada di `.local/postgres/owner.json`, tidak dipakai runtime. Tes membuktikan role test tidak punya CONNECT ke dev. Role owner database lokal cukup untuk pengembangan/migrasi; deployment nanti perlu pemisahan role migrasi dan runtime sesuai hosting.

`.env.local` dibuat dengan kredensial acak khusus Salvora dan AUTH_SECRET baru. `.env.example` tetap placeholder. `.env.local`, `.local` dan client generated diabaikan Git. Tidak ada nilai rahasia di dokumen, output perintah, atau kontrak API. Folder lokal privat ini bukan bagian paket serah terima sumber.

## 2. Setup dan perintah

**Status operasional terbaru:** cluster existing telah dipulihkan manual dan SQL dev/test:55433 serta dua tick antrean kosong terverifikasi. Tidak perlu menjalankan startup/provisioning lagi. Setelah persetujuan terpisah BE-14, dua database dan role sementara dibuat untuk Prisma migrate deploy, seed/idempotensi dan dump/restore; lulus 15:36 WIB, target sementara dibersihkan dan fingerprint dev/test cocok. [BE14-RECONCILIATION.md](BE14-RECONCILIATION.md) membedakan hasil aktual, target dan histori. Contoh setup di bawah untuk provisioning lingkungan baru, bukan instruksi mengubah cluster existing atau mereset test.

```powershell
npm.cmd ci
npm.cmd run db:local
npm.cmd run db:generate
npm.cmd run db:validate
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run test:db
npm.cmd run dev
```

`db:local` hanya untuk Windows dengan PostgreSQL 18. Override lokasi binary lewat `SALVORA_POSTGRES_BIN` bila diperlukan. Helper membuat cluster baru jika belum ada; marker mengikatnya ke workspace dan port. Jika `.env`/`.env.local` atau data cluster sudah ada tanpa marker miliknya, helper menolak menimpa/mengadopsinya. Jika port 55433 dipakai proses lain, helper tidak mengubah proses itu. `pg_ctl` berjalan tersembunyi; aplikasi GUI tidak diluncurkan. Helper dapat dijalankan ulang untuk menyalakan cluster yang sama, tanpa mengganti password atau mereset data.

```powershell
npm.cmd run db:local -- status
npm.cmd run db:local -- stop
npm.cmd run db:status
npm.cmd run db:check
npm.cmd run db:migrate:test
npm.cmd run db:seed:test
```

Stop hanya ditujukan cluster `.local/postgres/data` milik proyek ini dan tidak dilakukan oleh rekonsiliasi. Startup berikutnya setelah restart tetap perlu memperhatikan task aktif; cluster saat ini sudah hidup. Service PostgreSQL lain tidak perlu dihentikan. URL aplikasi lokal tetap `http://localhost:3000`; konfigurasi produksi mensyaratkan HTTPS.

Untuk server PostgreSQL alternatif, buat database/role **baru** dengan nama sesuai allowlist, pasang konfigurasi Salvora sendiri di `.env.local`, lalu mulai dari generate/migrate. Tidak ada auto-create database pada `migrate`, tidak ada fallback koneksi, dan tidak ada migrasi/seed otomatis saat install/build/start. Nilai `DATABASE_URL` harus dev/demo, `TEST_DATABASE_URL` hanya test; test runner memvalidasinya sebelum membuat client atau mengimpor tes.

`scripts/database.mjs` memvalidasi target sebelum menjalankan Prisma dan menyembunyikan diagnostik yang berpotensi memuat URL koneksi. Pada target test, koneksi dipetakan ke subprocess secara eksplisit serta divalidasi ulang oleh `prisma.config.ts`; tidak menggunakan koneksi aplikasi sebagai cadangan. `db:check` membaca nama database/versi dan hitungan data tanpa mengeluarkan akun/hash/kredensial. Perintah CLI memuat env melalui `@next/env`. `src/lib/db/index.ts` memberi client server secara lazy; `client.ts` adalah factory untuk infrastruktur/CLI/test, tidak boleh diimpor UI client.

## 3. Model, constraint dan penyimpanan

| Model | Fungsi dan batas utama |
|---|---|
| User, Session, RateLimit | Role BUYER default, email unik trim/lowercase, hash password; token sesi hanya digest HMAC 64 hex, expiry; counter/hash limiter dengan indeks cleanup. Resolver sesi dan rate limiting API tetap BE-03 |
| Address | Alamat akun pemilik; dapat dihapus tanpa menghilangkan snapshot pesanan karena order tidak mereferensikan alamat hidup |
| Category, Product | Kategori aktif, produk aktif terpisah dari ketersediaan, stok fisik/reservasi, foto URL/key nullable; CHECK harga >0 dan `0 <= reservedStock <= physicalStock`; FK mencegah penghapusan produk/kategori yang masih dirujuk |
| ProductPhoto (BE-04) | Metadata foto privat: UUID/key server, MIME WebP, ukuran/dimensi/hash dan pembuat; Product.photoId nullable mereferensikannya. File disimpan terpisah pada storage persisten, bukan kolom blob atau folder public |
| Cart, CartItem | Satu keranjang per user, unik keranjang+produk, jumlah positif. Keranjang bukan reservasi |
| CheckoutQuote | Referensi quote milik user, inputHash, snapshot JSON object dan expiresAt. Mendukung kontrak BE-01; TTL dan validasi payload/repricing BE-07, bukan fitur tambahan atau reservasi |
| Discount | Satu voucher NEW_BUYER per user; CHECK 20%/Rp100.000; state AVAILABLE/RESERVED/USED beserta link order dan waktu penggunaan yang konsisten |
| Order | Nomor unik, FK user/voucher, idempotency key+inputHash per user, snapshot alamat/nominal, status dan deadline; CHECK total = subtotal − diskon + ongkir, seluruh nominal valid, IDR/manual delivery |
| OrderItem | Snapshot produk/nama/harga/jumlah/lineSubtotal; produk sama satu baris per order, jumlah positif, perkalian konsisten; snapshot immutable |
| StockReservation | Satu per OrderItem, status RESERVED/CONSUMED/RELEASED, expiry/finalizedAt. Produk/jumlah/order diturunkan lewat item, tidak diduplikasi |
| Payment | Percobaan terpisah dari pesanan; providerOrderId dan ID transaksi provider unik. FK gabungan mengikat order+amount+currency ke total/currency order. Banyak percobaan historis, maksimal satu status CREATED/PENDING/UNCONFIRMED per order lewat partial unique index |
| PaymentApplication | **Primary key orderId** untuk penanda penerapan satu kali lintas percobaan; paymentId unik dan FK gabungan harus milik order yang sama. Trigger hanya mengizinkan record payment SUCCESS dengan paidAt. Ini pengganti `appliedAt` tingkat pesanan, bukan aktivasi langganan |
| PaymentEvent | Unik paymentId+deduplicationKey, sumber/verifikasi/status mentah/status hasil/errorCode. Tidak menyimpan seluruh payload, signature, token atau server key |
| Rating | Unik orderItemId, integer 1–5; pembeli dan produk diperoleh dari join item→order→user. CHECK DB komentar tidak kosong; BE-12 memvalidasi trim 10–1.000 karakter sesuai O-05 yang disetujui pengguna. Runtime PostgreSQL BE-12 belum diuji |
| OrderStatusHistory | Status lama/baru, waktu, SYSTEM atau ADMIN+FK pelaku, catatan aman; indeks urutan riwayat |

Semua waktu memakai TIMESTAMPTZ(3); tampilkan Asia/Jakarta. ID internal opaque/cuid dari Prisma; nomor pesanan dan referensi Midtrans ditentukan service berikutnya, tidak sama fungsi. Nominal menggunakan PostgreSQL **INTEGER** Rupiah, rentang positif maksimum **2.147.483.647**; total/line subtotal juga harus dalam rentang itu. Ini subset aman angka JSON, tidak memakai float atau BigInt yang tidak bisa langsung diserialisasi. BE-04/BE-06 harus menolak overflow sebelum penyimpanan. Perkalian/penjumlahan pada CHECK di-cast bigint agar pemeriksaannya tidak overflow.

FK gabungan Discount↔Order menjaga pemilik voucher dan pesanan sama. Voucher boleh muncul pada beberapa order historis setelah reservasi dilepas; status/usedOrderId tunggal menunjukkan penggunaan akhirnya. BE-06/BE-07 harus memastikan hanya order yang memegang reservasi mendapat hak memakainya. Tidak ada `@unique` satu payment per order atau satu order seumur hidup per voucher yang menghalangi retry.

Trigger SQL menjaga snapshot Order (alamat, total, voucher, identitas, tenggat asli) dan seluruh OrderItem agar tidak bisa diedit mengikuti data akun/katalog. Status, attentionReason dan updatedAt order tetap dapat diubah oleh service sesuai transisi. Tenggat **tidak memiliki default 30/60 menit**; caller harus menyuplai batas yang nanti diputuskan O-01. Ongkir juga tanpa default operasional; angka fixture/seed bukan kebijakan toko.

## 4. Invarian yang tetap membutuhkan service

Constraint bukan bukti seluruh checkout/pembayaran sudah berjalan. BE-07/BE-09/BE-10 masih harus:

- Memvalidasi role/pemilik, harga/stok, quote dan inputHash; menerapkan Idempotency-Key pada request, bukan hanya mengandalkan unique index.
- Mengunci stok/voucher/pesanan dalam urutan konsisten, memperbarui counter reservedStock **bersama** StockReservation dalam transaksi; jumlah counter lintas baris bukan CHECK otomatis.
- Membuat PaymentApplication dalam transaksi yang sama dengan perubahan order, stok, voucher dan penanda pembelian pertama; insert gagal berarti tidak boleh mengulangi efek. Jangan mengubah/menghapus penanda yang sudah dibuat untuk mencoba menerapkan lagi.
- Memastikan signature/provider/reference/nominal/status terbaru terverifikasi. Trigger SUCCESS hanya memeriksa record lokal, tidak bisa membuktikan Midtrans sudah dihubungi.
- Mencatat dua sukses historis tanpa menerapkan pesanan dua kali; mengarahkan late success setelah reservasi dilepas ke Perlu Penanganan.
- Menjaga expiry percobaan/reservasi sesuai deadline order dan terminal provider; melepas reservasi tepat sekali. Partial unique index tidak boleh diakali dengan FAILED lokal jika provider belum pasti terminal.
- Memeriksa pesanan Selesai dan pemilik saat submit ulasan BE-12; DB menjamin rating/uniqueness, belum mengimplementasikan otorisasi/transisi ulasan.
- Menjaga riwayat status dan izin admin, sanitasi DTO/log, serta limiter/cleanup record sesi dan quote kedaluwarsa.

Tidak membuat tabel P1 kontak/moderasi/promo umum/CMS/notifikasi, paket premium, pickup, COD atau transfer manual.

## 5. Seed katalog dan admin internal

`db:seed` bersifat idempoten: dua kategori (Risol/Cookies) dan dua produk dengan label **Data Demo**, metadata `isDemo=true`. Harga/stok adalah fixture pengembangan. ID demo stabil; upsert tidak memperbarui record yang sudah ada, sehingga rerun tidak mereset stok, harga, aktif/nonaktif atau data operator. Jika ID milik data non-demo, seed gagal dan transaksi dibatalkan. Foto nullable sampai aset dan storage disepakati. Tidak menerbitkan voucher atau membuat pesanan/pembayaran contoh.

Admin dibuat terpisah, hanya melalui CLI internal lokal:

```powershell
npm.cmd run db:admin
```

Tanpa input, script membuat akun demo baru dengan password acak dan hash bcrypt cost 12, lalu menyimpan kredensial hanya ke `.local/admin-demo.json` (diabaikan Git). Password tidak dicetak dan tidak di-hardcode. Dengan `SEED_ADMIN_EMAIL` dan `SEED_ADMIN_PASSWORD` yang diisi lewat mekanisme rahasia lokal, script memakai keduanya; password minimal 12 karakter/maksimal 72 byte. Script menolak akun email yang sudah ada: tidak mempromosikan pembeli menjadi admin, tidak mereset password, tidak menimpa file kredensial. Tidak dijalankan saat seed normal, production atau test. Akun hasil provisioning belum dapat dipakai melalui API sampai BE-03 selesai.

Kredensial lokal yang sudah dibuat pada sesi BE-02 dapat dibaca sendiri dari file tersebut; tidak disalin ke README, .env.example, atau chat. Tidak ada data akun/sesi lama yang diimpor.

## 6. Migrasi dan pengujian

Migrasi awal disusun dari diff **from-empty**, kemudian dilengkapi CHECK, partial index dan trigger SQL; dibungkus BEGIN/COMMIT. Diterapkan ke database dev dan test kosong, bukan db push/reset. Perubahan berikutnya harus migrasi baru: jangan mengedit migrasi yang sudah diterapkan atau menghapus `_prisma_migrations` untuk menyamakan checksum.

Prisma 7 schema tidak merepresentasikan seluruh CHECK/trigger/partial index yang dipakai. Simpan dan tinjau SQL tersebut pada migrasi; jangan memakai `db push` sebagai pengganti migrasi. CLI versi terpasang diperiksa melalui help; panduan Prisma versi major lain tidak otomatis berlaku. [Prisma Migrate](https://docs.prisma.io/docs/cli/migrate), [PostgreSQL initdb](https://www.postgresql.org/docs/18/app-initdb.html), dan [autentikasi PostgreSQL](https://www.postgresql.org/docs/18/auth-pg-hba-conf.html) menjadi rujukan prosedur.

`npm test` hanya suite fondasi. `npm run test:db` memerlukan TEST_DATABASE_URL, menjalankan deploy migrasi pada **test saja**, lalu suite terpisah. Mayoritas fixture memakai transaksi rollback; tes concurrency membuat UUID khusus dan menghapus hanya fixture itu, tanpa TRUNCATE, DROP atau reset. Seed test meninggalkan dua produk demo yang eksplisit. Tes mencakup CHECK/FK/unique, snapshot, voucher, nominal dan percobaan, event/rating, transaksi Prisma rollback, idempotensi seed dan conditional stock update bersamaan. Ini bukti integritas penyimpanan, bukan bukti UAT checkout/provider selesai.

## 7. Backup dan pemulihan

```powershell
npm.cmd run db:backup
```

Helper memvalidasi target aplikasi Salvora, menjalankan pg_dump custom-format tanpa owner/privilege, lalu memeriksa arsip dengan `pg_restore --list`. Kredensial diberikan lewat environment subprocess, bukan argument command line. Arsip berada di `.local/backups`, bersifat privat karena dapat memuat data/hash akun. Jadwal/retensi backup hosting menunggu O-08/O-11; helper ini backup lokal manual.

Sejak BE-04, backup DB saja **tidak mencakup berkas foto**. Buat pasangan backup/snapshot dengan direktori upload persisten dan pulihkan keduanya; referensi key dan hash harus cocok. Panduan dan batas verifikasi volume foto ada pada [CATALOG.md](CATALOG.md). Tidak ada klaim restore hosting/file sudah diuji.

Pemulihan tidak berjalan otomatis. Prosedur pada lingkungan demo baru:

1. Siapkan database **kosong** `salvora_kitchen_demo` dan role pemilik khusus baru pada PostgreSQL 18.6/versi kompatibel. Verifikasi host/port/nama dan hak akses. Jangan menarget dev, test, shadow, atau database LanggananKu.
2. Periksa arsip dengan `pg_restore --list`. Pulihkan skema+data sekaligus ke target kosong; jangan menjalankan migrasi awal terlebih dahulu. Gunakan password prompt/secret environment, tanpa URL berpassword dalam command line.
3. Contoh bentuk perintah: `pg_restore --host=<host> --port=<port> --username=<role-demo> --dbname=salvora_kitchen_demo --no-owner --no-privileges --exit-on-error <arsip.dump>`. **Tanpa** `--clean`/`--create`; bila target tidak kosong, hentikan dan pilih target kosong yang benar.
4. Atur DATABASE_URL Salvora demo secara privat, periksa `db:status`, jumlah tabel/data dan akses role, lalu terapkan hanya migrasi yang belum ada. `_prisma_migrations` ikut diarsipkan, sehingga migrasi lama tidak perlu diulang.
5. Gunakan key Midtrans dan URL HTTPS demo sendiri; putar secret/password yang perlu sebelum membagikan lingkungan. Jalankan pemeriksaan aplikasi dan UAT terkait sebelum menyebut pemulihan berhasil.

Pada BE-02 hanya backup/list diperiksa. BE-14 kemudian membuktikan dump/restore DB penuh ke database sementara kosong baru pada cluster lokal, termasuk riwayat migrasi, data seed dan constraint, setelah persetujuan. Bukti dan cleanup pada BE14-RECONCILIATION. Ini bukan restore demo hosting atau berkas foto; keduanya tetap perlu diterima pada lingkungan deployment.
