# Salvora Kitchen

Baru menjalankan proyek di laptop Windows? Ikuti [panduan instalasi Windows](docs/SETUP-WINDOWS.md).

**BE-00–BE-14 Selesai untuk cakupan backend**, PRD [1.9](PRD-Salvora-Kitchen.md). BNI VA Midtrans Sandbox nyata Rp14.000 settlement/webhook/GET status serta application/stok/voucher tepat sekali terverifikasi 24 Oktober 2026. Bukti lain: 103 unit/fondasi, 19 tes PostgreSQL terisolasi, 108 regresi bersih, 7 kelompok HTTP Next.js, fresh DB migration/seed/isolasi/restore, lint/typecheck/build dan tick antrean kosong. Keterbatasan retensi regresi pertama tetap tercatat, tidak diklaim dipulihkan. Detail [BE14-RECONCILIATION.md](docs/BE14-RECONCILIATION.md), [ORDERS.md](docs/ORDERS.md), [REVIEWS.md](docs/REVIEWS.md), [DASHBOARD.md](docs/DASHBOARD.md). Frontend React/backend Route Handlers satu proyek Next.js, Tailwind terhubung; halaman masih sementara, Figma/UI/responsif dan deployment belum diterima.

## Menjalankan

**FE-12 Ditinjau, belum Selesai:** **438 tes** dan lint/typecheck/build/boundary lulus. Bug fokus sesi yang membuang draft diperbaiki. Checkout browser berhasil menguji respons hilang → reload → recovery satu order; cleanup 15 tabel cocok. Admin fulfillment/cancel/receipt/note diamati, tetapi checkpoint timeout tetap FAIL dengan cleanup 18 tabel PASS. [Laporan penerimaan terbaru](docs/FE-VERIFICATION.md) merinci gap browser lintas halaman/state, VA Sandbox melalui UI serta aset visual final. Seluruh server fixture sudah berakhir; tidak mengubah dev/task atau memanggil provider. Bukti historis berikut tidak berarti seluruh frontend sudah diterima.

**FE-11 Ditinjau:** `/admin/voucher` menampilkan aturan tetap, status/pemilik/relasi pesanan dan pagination; `/admin/akun` kini dapat mengubah nama akun sendiri, dengan email/peran readonly. **437 unit/regresi**, lint/typecheck/build/boundary dan tujuh kelompok HTTP/PostgreSQL test lulus; cleanup 18 tabel cocok. [Laporan FE-11](docs/FE11-ACCOUNT-VOUCHER-VERIFICATION.md) mencatat isolasi dua admin, penolakan perubahan ID/email/role, nama Unicode dan gap browser. Seluruh menu P0 kini memiliki implementasi; penerimaan browser/visual FE-05–FE-11 masih terbuka. Berikutnya FE-12.

**FE-10 Ditinjau:** `/admin/pesanan`, detailnya dan `/admin/pembayaran` tersedia untuk filter/pagination, seluruh attempt, catatan privat serta Dikirim → Selesai dengan konfirmasi penerimaan manual. **415 unit/regresi** dan tujuh kelompok HTTP/PostgreSQL test lulus, cleanup 18 tabel cocok. [Laporan FE-10](docs/FE10-ORDERS-VERIFICATION.md) memisahkan pembayaran sintetis/API nyata dari browser: izin kontrol Chrome timeout, checkpoint UI belum lulus. Lint/typecheck/build/boundary lulus. Berikutnya FE-11; gap FE-05–FE-09 tetap terbuka.

**FE-09 Ditinjau:** `/admin/kategori` dan `/admin/produk` tersedia untuk daftar/filter/pagination, tambah/ubah/nonaktif, unggah foto dan stok berversi. **387 unit/regresi**, lint/typecheck/build/boundary serta tujuh kelompok HTTP/PostgreSQL test lulus; cleanup 16 tabel dan arsip foto cocok. [Laporan FE-09](docs/FE09-CATALOG-VERIFICATION.md) mencatat perilaku, kegagalan/recovery cleanup, dan gap browser CRUD/upload/stok/keyboard/responsif. FE-05–FE-08 tetap Ditinjau; berikutnya FE-10.

**FE-08 Ditinjau:** `/admin` kini dashboard operasional dengan sidebar/drawer, filter tanggal WIB, metrik status pesanan dan inventaris global saat ini. Profil readonly berada di `/admin/akun`; modul lain ditandai Belum tersedia sampai implementasinya. **359 unit/regresi**, lint/typecheck/build/boundary dan HTTP/PostgreSQL test lulus. [Laporan FE-08](docs/FE08-ADMIN-DASHBOARD-VERIFICATION.md) memuat sumber desain, cleanup dan gap browser/drawer/keyboard/responsif. Pembaruan sesudahnya: Produk/Kategori tersedia pada FE-09 di atas; FE-05–FE-07 tetap Ditinjau.

**FE-07 Ditinjau:** `/pesanan` dan detailnya menyediakan filter/pagination, snapshot dan history publik serta ulasan per item yang diizinkan server. Bukti historis 335 unit/regresi dan HTTP/PostgreSQL test: [laporan FE-07](docs/FE07-ORDERS-VERIFICATION.md). Browser/keyboard/responsif belum terverifikasi. FE-05/06 tetap Ditinjau; layout/dashboard admin kini FE-08 di atas.

**FE-06 Ditinjau:** hasil checkout menautkan `/pembayaran/[orderId]` untuk Snap Sandbox, status server, pemeriksaan manual dan countdown; `/payment/finish` memulihkan order dari konteks tab yang sama tanpa mempercayai query provider. **302 tes unit/regresi**, lint/typecheck/build/boundary dan integrasi HTTP/test DB lulus. [Laporan FE-06](docs/FE06-PAYMENT-VERIFICATION.md) membedakan mock/API nyata; browser/VA Sandbox baru dan webhook HTTPS belum terpenuhi. Belum membuat transaksi provider baru. FE-05 tetap Ditinjau.

**FE-05 Ditinjau:** `/checkout` tersedia dari keranjang, dengan pilihan alamat, quote server, persetujuan eksplisit dan recovery konfirmasi yang mempertahankan key/input sesudah refresh. Bukti historis 266 tes dan integrasi controller/Next HTTP/PostgreSQL test: [laporan FE-05](docs/FE05-CHECKOUT-VERIFICATION.md). Interaksi browser checkout belum terverifikasi; implementasi pembayaran kini FE-06 di atas.

Fungsi **FE-04 selesai**: buka `/keranjang` dan `/alamat` sebagai BUYER untuk ubah/hapus item, CRUD alamat, badge jumlah aktual dan informasi voucher. Bukti historis 245 unit/regresi serta lint/typecheck/build/boundary: [laporan FE-04](docs/FE04-BUYER-VERIFICATION.md). Pilihan alamat/quote/konfirmasi kini diimplementasikan pada FE-05 di atas; dashboard admin operasional tetap FE-08.

Fungsi **FE-03 selesai**: beranda `/`, katalog publik `/menu`, filter kategori/pagination, detail/ulasan server dan tambah keranjang BUYER tersedia. Bukti historis 218 unit/regresi serta browser/API test terisolasi: [laporan FE-03](docs/FE03-CATALOG-VERIFICATION.md). Aset/konten visual final masih terbuka.

Fungsi **FE-02 selesai**: buka `/login` atau `/register` pada origin `http://localhost:3000` yang cocok dengan konfigurasi lokal. Login/register/logout, navigasi peran dan proteksi akun/admin teruji di browser dengan database test; 183 unit/regresi lulus. [Laporan FE-02](docs/FE02-AUTH-VERIFICATION.md) memisahkan API nyata/mock serta gap aset auth final. Dashboard admin operasional tetap FE-08; katalog kini tersedia melalui FE-03. Provider sesi global juga berlaku pada header galeri development.

**FE-00/FE-01 selesai untuk audit dan fondasi.** Tema/font lokal, komponen shadcn/Radix, layout publik dan API client tersedia. Buka `/dev/ui` saat development untuk data contoh komponen (produksi 404); header kini mengikuti sesi FE-02. Bukti historis 142 tes pada FE-01: [UI-FOUNDATION.md](docs/UI-FOUNDATION.md), status aktif [TASKS-FRONTEND.md](docs/TASKS-FRONTEND.md). Angka 103 tes backend di atas tetap bukti historis BE-14.

BE-14 diterima backend. [Laporan verifikasi](docs/BACKEND-VERIFICATION.md) menyimpan histori dan batas UAT; [rekonsiliasi akhir](docs/BE14-RECONCILIATION.md) memuat provider nyata, DB/HTTP/restore dan catatan retensi. [Serah terima frontend](docs/FRONTEND-HANDOFF.md) memuat API/payload/UI/error. Setelah restart, periksa cluster/task dahulu; cluster perlu startup manual jika berhenti, bukan bootstrap/reset. Server/tunnel uji sudah ditutup, task tetap tiap menit. Penerimaan frontend/deployment masih terpisah.

Jika terminal Windows berkedip sendiri, baca [audit otomatisasi pembayaran](docs/WINDOWS-AUTOMATION-AUDIT.md). Task resmi tetap tiap menit, terpisah dari npm dev/build. Action lokal sudah dimigrasikan ke GUI launcher setelah persetujuan; tick normal mencatat tidak ada konsol terpasang pada launcher. Ini tidak mengukur konsol worker Node. Worker masih exit 1 dan keberhasilan pembayaran tidak diklaim. Installer tidak dijalankan otomatis oleh development server.

Diagnosis exit 1 sebelumnya membuktikan cluster 55433 berhenti. Setelah pemulihan manual, SQL dan dua tick kosong kini lulus. [Diagnostik worker](docs/PAYMENT-WORKER-DIAGNOSTICS.md) menyimpan histori; consoleAttached hanya mengukur launcher. Tidak ada startup ulang atau perubahan task/logika pembayaran pada rekonsiliasi.

BE-10 menyediakan reconcile/retry/release; regresi 108 diulang bersih pada BE-14 dan tick otomatis kosong dikonfirmasi setelah pemulihan. Komputer, login pengguna, PostgreSQL dan jaringan harus aktif; browser tidak diperlukan untuk task. BNI VA Sandbox/webhook nyata juga sudah diuji pada BE-14 melalui endpoint sementara yang kini ditutup. Hosting demo tetap terbuka. Rincian [RECONCILIATION.md](docs/RECONCILIATION.md), [PAYMENTS.md](docs/PAYMENTS.md), [WEBHOOKS.md](docs/WEBHOOKS.md). Order 60 menit, delivery Kota Tanjungpinang Rp10.000/pesanan, diskon floor 20% maksimal Rp100.000 tanpa ongkir tetap.

Gunakan Node.js 24.21.0 (24 LTS) dan npm. Di PowerShell yang membatasi script, gunakan `npm.cmd`.

```powershell
npm.cmd ci
npm.cmd run dev
```

Buka `http://localhost:3000`. Frontend dan API backend memakai satu server Next.js. Handler berdata membutuhkan konfigurasi dan PostgreSQL yang sehat; health tidak menguji koneksi DB/provider. Katalog/auth/keranjang/alamat sudah memiliki UI; checkout/pembayaran/riwayat/ulasan dan seluruh modul admin Ditinjau; penerimaan browser/responsif/visual lintas task mengikuti FE-12. Endpoint backend P0 tersedia sesuai [kontrak API](docs/API-CONTRACT.md); bukti BE-11–BE-14 ada pada laporan backend di atas. Keranjang dan quote tidak mereservasi stok; order yang berhasil dikonfirmasi mencadangkannya.

Startup harian: jalankan `npm run dev`. Pemeriksaan `predev` menyalakan cluster lokal Salvora yang sudah memiliki penanda kepemilikan bila berhenti, lalu menguji koneksi sebelum Next.js berjalan. Tidak ada bootstrap, reset, migrasi, atau seed otomatis. Jika database gagal menyala, startup dihentikan dengan pesan yang jelas.

Untuk pemeriksaan manual cluster existing setelah restart:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe' -D '.local\postgres\data' status
```

Jika cluster proyek terverifikasi berhenti, startup minimal berikut menyalakan data yang sudah ada. Task pembayaran aktif dapat kembali berjalan setelah database hidup; jangan memakai bootstrap/reset atau menghapus PID untuk mengatasi peringatan startup.

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe' -D '.local\postgres\data' -l '.local\postgres\server.log' start -w
npm.cmd run db:check
npm.cmd run dev
```

Startup 25 Oktober telah berhasil atas permintaan pengguna; tidak perlu diulang saat cluster/server masih aktif. Gunakan origin `http://localhost:3000` yang cocok dengan konfigurasi lokal.

BE-02 telah menyiapkan cluster PostgreSQL 18.6 khusus Salvora pada 127.0.0.1:55433 beserta database dev/test/shadow, migrasi, data katalog demo, dan admin internal baru. Kredensial ada di `.env.local` dan `.local/admin-demo.json`, diabaikan Git dan tidak dicetak. Login API sudah tersedia pada BE-03; lihat [AUTH.md](docs/AUTH.md). Untuk instalasi baru, ikuti [DATABASE.md](docs/DATABASE.md); helper tidak akan menimpa konfigurasi milik pengguna. Jangan salin `.env` atau akun LanggananKu.

Contoh provisioning lingkungan baru berikut bukan instruksi startup cluster existing yang sudah hidup. Jangan menjalankannya untuk mengulang pemulihan; helper db:local juga melakukan provisioning role/hak.

```powershell
npm.cmd run db:local
npm.cmd run db:generate
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run test:db
```

Pemulihan cluster existing mengikuti [diagnostik worker](docs/PAYMENT-WORKER-DIAGNOSTICS.md), bukan bootstrap ulang atau penggantian ke 5432. Gunakan hanya `salvora_kitchen_dev`/`salvora_kitchen_demo` untuk aplikasi, `salvora_kitchen_test` untuk pengujian. Siapkan konfigurasi baru sendiri jika memakai layanan PostgreSQL alternatif.

```powershell
npm.cmd run check:env
npm.cmd run check:env -- --snap
npm.cmd run check:env -- --payment
npm.cmd test
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:http
```

Perintah HTTP bisnis berikut membutuhkan database test terverifikasi dan menulis fixture. Jangan menjalankannya bersamaan dengan fingerprint/tes lain atau uji provider interaktif; smoke fondasi tidak menggantikannya. Hasil BE-14 yang sudah valid tidak perlu diulang tanpa perubahan/gap bukti.

```powershell
npm.cmd run test:http:auth
npm.cmd run test:http:catalog
npm.cmd run test:http:buyer
```

`npm.cmd start` menjalankan build produksi yang sudah dibuat; tidak menyalakan PostgreSQL atau memasang task. URL/config produksi tetap harus memenuhi aturan HTTPS.

`check:env -- --snap` memvalidasi dua key Sandbox, URL aplikasi dan expiry 60 untuk token lokal. `--payment` memeriksa kesiapan deployment webhook HTTPS; handler lokal BE-09 tetap dapat diuji dengan key tiruan. Pada `NODE_ENV=production`, URL aplikasi wajib HTTPS. Pemeriksaan konfigurasi tidak membuka koneksi provider atau memperpanjang tenggat order. Uji nyata opt-in `npm.cmd run test:midtrans:sandbox` memakai fixture database test dan mempertahankan referensi provider untuk rekonsiliasi. Uji tunnel interaktif tersedia di `scripts/webhook-live-sandbox.mjs`, dengan catatan lifecycle/retensi pada [WEBHOOKS.md](docs/WEBHOOKS.md). Jangan memasukkan uji provider nyata ke test default/CI tanpa tujuan jelas.

## Struktur dan batas task

- `src/app`: halaman dan HTTP adapters; `api/health` memakai runtime Node.js.
- `src/services`: koordinasi kasus penggunaan; health konfigurasi sebagai contoh pertama.
- `src/lib/api`: error, envelope respons, pembacaan JSON terbatas, pagination.
- `src/lib/auth`: validasi, token/digest/cookie, counter rate limit, adapter HTTP serta resolver sesi/role server-only.
- `src/services/auth.ts`: registrasi/login/logout dan profil admin sendiri; hook transaksi menerbitkan satu voucher untuk pembeli yang memenuhi syarat. Layanan harga `src/services/pricing.ts` memakai data cart/Product dan kebijakan diskon tetap; rincian [BE-06](docs/VOUCHERS.md).
- `src/lib/catalog` dan `src/services/catalog.ts`: validasi/adapter katalog, CRUD admin, stok, DTO dan query konsisten; detail [CATALOG.md](docs/CATALOG.md).
- `src/services/product-photos.ts`: validasi dan metadata/file foto; development memakai `.local/uploads/product-photos`, test folder terpisah. Production wajib direktori privat pada volume persisten dan konfigurasi eksplisit, tanpa fallback ephemeral.
- `src/lib/config`: validasi konfigurasi murni dan pembungkus khusus server.
- `src/lib/contracts`: DTO aman dan enum status aplikasi; bukan model ORM.
- `src/lib/db`: konfigurasi dan factory PrismaPg tervalidasi serta accessor khusus server yang lazy.
- `prisma`: schema/migrasi domain toko, tambahan metadata foto, dan seed katalog demo idempoten.
- `tests`: suite fondasi tanpa DB/provider; suite `tests/database` terpisah untuk PostgreSQL nyata. Alias `server-only` hanya untuk runner tes fondasi.

Prisma CLI memvalidasi database tanpa fallback melalui `prisma.config.ts`; wrapper memvalidasi target lagi sebelum menjalankannya. `db:generate` memerlukan konfigurasi URL Salvora dan tidak membuka koneksi DB. `test:db` memvalidasi TEST_DATABASE_URL, menerapkan migrasi hanya ke test, lalu menjalankan tes integritas/konkurensi dengan fixture terpisah. Tidak ada migrasi/seed otomatis saat install, build, atau start. Jalankan generate sebelum typecheck pada checkout baru; client generated diabaikan Git.

Rahasia tidak boleh masuk kode client. Gunakan pembungkus `config/server.ts` dan batas `server-only` untuk konfigurasi, database, dan layanan. DTO API selalu memakai whitelist; helper `success()` tidak otomatis menyaring object ORM. Jangan mengirim model ORM utuh atau error internal ke helper respons.

Lihat [keputusan dan dependensi](docs/DECISIONS.md), [kontrak API](docs/API-CONTRACT.md), dan [status task](docs/TASKS-BACKEND.md). Ongkir/wilayah dan expiry sudah ditetapkan pada BE-07. Hosting, volume foto persisten, akses merchant dan scheduler masih memiliki gerbang terbuka. Tidak ada fitur langganan/premium atau koneksi fallback proyek lama.
