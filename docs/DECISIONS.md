# Keputusan implementasi dan inventarisasi sumber — BE-00

Pembaruan 24 Oktober 2026: **BE-00–BE-14 Selesai backend, O-06 ditutup.** BNI VA Sandbox Rp14.000 settlement/webhook/GET status/application/stok/voucher tepat sekali terverifikasi. Cluster/tick kosong, PostgreSQL/HTTP dan DB kosong/seed/restore terbukti. Server/tunnel sementara ditutup, task/dev/config/backup lama tidak diubah. Retensi run regresi pertama tetap keterbatasan audit, tidak diklaim pulih; UI/deployment belum diterima. PRD 1.9 tetap. Rujukan [BE14-RECONCILIATION.md](BE14-RECONCILIATION.md), [BACKEND-VERIFICATION.md](BACKEND-VERIFICATION.md), [FRONTEND-HANDOFF.md](FRONTEND-HANDOFF.md). Histori dipertahankan.

| Metadata | Nilai |
|---|---|
| Proyek | Salvora Kitchen |
| Tanggal pemeriksaan | 22 Oktober 2026 |
| Acuan | [PRD versi 1.4](../PRD-Salvora-Kitchen.md), khususnya bagian 2, 14.1, 21, 24, 25; [task backend](TASKS-BACKEND.md) |
| Status BE-00 | Selesai untuk keputusan fondasi dan inventarisasi; keputusan terbuka beserta gerbang task dicatat di bagian 6 |
| Penanggung jawab keputusan bisnis/infrastruktur | Kelompok 11; nama individu belum ditetapkan |
| Batas keluaran | Dokumentasi; belum membuat aplikasi, migrasi, database, konfigurasi rahasia, atau integrasi runtime |

“Ditetapkan” berarti ketentuan PRD atau pilihan teknis BE-00 untuk implementasi berikutnya. “Terbuka” berarti belum boleh dianggap sebagai persetujuan kelompok. Hasil baca sumber, kompatibilitas metadata, dan keberhasilan runtime adalah bukti yang berbeda.

## 1. Kondisi proyek dan batas pemeriksaan

Lokasi implementasi adalah workspace **`Salvara Kitchen`** yang sedang dibuka. Ejaan direktori dipertahankan; nama produk mengikuti PRD, yaitu **Salvora Kitchen**. Jangan membuat aplikasi toko di folder LanggananKu.

Inventaris awal sebelum penambahan dokumen ini:

```text
Salvara Kitchen/
├── PRD-Salvora-Kitchen.md
├── docs/
│   └── TASKS-BACKEND.md
└── .Desain/
    ├── [20 ekspor halaman/desain PNG]
    └── Assets/
        └── Hero Page.png
```

| Kategori | Berkas/kondisi aktual | Perlakuan |
|---|---|---|
| Sumber aplikasi | Belum ada `src`, `app`, `package.json`, lockfile, Prisma, atau tes | Dibuat dalam workspace ini mulai BE-01; struktur rencana bukan implementasi yang sudah ada |
| Dokumentasi | PRD 1.4 dan `docs/TASKS-BACKEND.md` | PRD mengendalikan cakupan; task mengendalikan urutan kerja |
| Desain pelanggan | `Beranda pelanggan (1).png`, `Halaman menu.png`, `Login.png`, `Register.png`, `Ulasan Dan Rating.png` | Referensi desain, bukan fitur yang sudah tersedia |
| Desain admin/sistem | `Desain Sistem.png`, `Dashbord - Admin.png`, `Kategori - Admin.png`, `Kategori Produk fiks - Admin.png`, `Kelola Produk - Admin.png`, `Kelola Produk -_ Tambah Produk - Admin.png`, `Pesanan - Admin.png`, `Pesanan -_ Export Data - Admin.png`, `Promosi.png`, `Pengaturan - Produk.png`, `Pengaturan -_ profil toko - Admin.png`, `Pengaturan -_ Notifikasi - Admin.png`, `Pengaturan -_ Akun Admin - Admin.png`, `Pengaturan -_ Pembayaran - Admin.png`, `Pengaturan -_ Pengiriman - Admin.png` | Ikuti audit cakupan PRD bagian 24; menu pada gambar tidak mengesahkan fitur tambahan |
| Aset | `.Desain/Assets/Hero Page.png` | Aset pendukung; foto produk, logo, dan konten final masih perlu dilengkapi |

Tidak ditemukan `AGENTS.md` pada workspace, direktori leluhur yang diperiksa sampai root drive, atau pohon sumber LanggananKu di luar dependensi/generated build. Instruksi proyek yang tersedia adalah PRD dan daftar task. BE-00 menginventarisasi nama berkas desain; tidak melakukan audit visual ulang atau membaca file Figma langsung. Proposal PDF/diagram yang disebut PRD tidak tersedia sebagai berkas terpisah di workspace ini.

Sumber adaptasi ditemukan pada direktori lokal `Documents/LanggananKu` di luar workspace toko. Identitas paket sumber adalah `subspace`. Pemeriksaan hanya membaca berkas kode, manifest, lockfile, skema, migrasi, dan tes. `.env`, `.local`, akun, sesi, serta data pengguna tidak dibaca atau disalin. Folder `.next`, `node_modules`, dan client Prisma generated bukan sumber aplikasi toko yang akan dipindahkan.

## 2. Keputusan yang ditetapkan

| ID | Keputusan | Alasan dan dampak |
|---|---|---|
| D-01 | Satu proyek Next.js App Router, TypeScript, frontend React; API melalui Route Handlers dengan runtime Node.js | Mengikuti PRD; database, crypto, dan Midtrans berada pada server yang sama tanpa layanan backend terpisah |
| D-02 | Tailwind CSS 4 dan komponen shadcn/ui yang disesuaikan dengan Figma | Ketentuan frontend tetap berlaku pada BE-01; implementasi semua halaman tidak termasuk BE-00 |
| D-03 | Prisma ORM 7 + `@prisma/adapter-pg` + `pg`, PostgreSQL; migrasi baru khusus toko | Pola sumber dapat diadaptasi, mendukung transaksi dan SQL penguncian; skema/migrasi langganan tidak cocok untuk domain toko |
| D-04 | Database pengembangan `salvora_kitchen_dev`, pengujian `salvora_kitchen_test`, demo `salvora_kitchen_demo` | Seluruhnya terpisah dari database LanggananKu; nama tersebut rencana, belum database yang dibuat |
| D-05 | Pola sesi tersimpan di database, token acak di cookie, digest HMAC-SHA256 di database, `bcryptjs` cost 12 | Mengadaptasi sumber tanpa membawa sesi/akun; cookie baru `salvora_session`, HttpOnly, SameSite=Lax, Secure pada HTTPS, path `/` |
| D-06 | Baseline sesi 7 hari, rotasi saat login dan pencabutan saat logout; tanpa fitur Ingatkan Saya | Perilaku teknis eksplisit dari pola sumber; BE-03 wajib menguji expiry, rotasi, pencabutan, peran dan kepemilikan |
| D-07 | Validasi server memakai Zod; mutation berbasis cookie memeriksa Origin terhadap URL aplikasi | Pola dapat digunakan kembali; webhook memakai verifikasi provider dan tidak mensyaratkan sesi/CSRF pembeli. BE-01 merinci kontrak; BE-03 menguji perlindungannya |
| D-08 | Registrasi publik hanya pembeli, admin melalui mekanisme internal | Mengikuti PRD; jangan menerima peran dari browser. Baseline kata sandi minimal 8 karakter, maksimum 72 byte untuk bcrypt; normalisasi email trim/lowercase dan unique constraint |
| D-09 | Midtrans Snap **Sandbox saja**, wrapper server memakai `fetch` Node.js; tidak memerlukan SDK Midtrans tambahan | Memakai pola sumber dengan key dan URL toko sendiri; browser/redirect hanya menampilkan hasil, bukan menetapkan sukses |
| D-10 | Delivery manual; voucher pembeli baru 20%, maksimal Rp100.000, sekali pakai; ulasan hanya item pesanan sendiri berstatus Selesai | Aturan tetap PRD; bukan langganan/premium atau mesin promo umum |
| D-11 | Pisahkan nomor pesanan toko, ID percobaan pembayaran, `provider_order_id` unik per percobaan, dan ID transaksi Midtrans | `Payment.orderId` sumber tidak boleh sekaligus dianggap nomor pesanan toko. Penerapan sukses wajib dijaga per pesanan lintas percobaan |
| D-12 | Nominal disimpan sebagai Rupiah bulat; waktu tersimpan sebagai instant UTC/TIMESTAMPTZ, tampilan Asia/Jakarta | Konsistensi transaksi dan tenggat. O-10 ditutup pada BE-06: floor diskon sekali pada subtotal seluruh barang |

Pengamanan koneksi yang harus diterapkan pada BE-01/BE-02:

- `DATABASE_URL` wajib eksplisit. Hapus fallback sumber baik pada `src/lib/db/index.ts` **maupun** `prisma.config.ts`. Konfigurasi tidak lengkap harus gagal dengan pesan aman sebelum koneksi/migrasi.
- Gunakan akun database khusus Salvora dengan izin hanya pada database Salvora. Kesamaan server PostgreSQL tidak memberi izin menggunakan database atau akun LanggananKu.
- Test runner memerlukan `TEST_DATABASE_URL`, memetakannya secara eksplisit ke proses tes sebelum client diimpor, memeriksa nama database `salvora_kitchen_test`, serta menolak jika sama dengan koneksi aplikasi. Jangan fallback ke `DATABASE_URL` pengembangan.
- Migrasi/seed hanya dijalankan setelah tujuan database diverifikasi tanpa mencetak password/URL lengkap. Shadow database, bila diperlukan `migrate dev`, juga khusus Salvora dan tidak pernah database aplikasi/pengujian/legacy.
- Buat skema, seed, dan client Prisma baru. Jangan membawa dump, migrasi langganan, akun, sesi, folder generated, atau helper bootstrap database sumber tanpa penulisan ulang dan pemeriksaan target.

Struktur yang direncanakan untuk BE-01: `src/app` (halaman/Route Handlers), `src/services` (aturan bisnis), `src/lib` (validasi, auth, database, provider), `src/components` (UI), `prisma` (skema/migrasi baru), `tests`, dan `docs`. Ini pilihan pemisahan tanggung jawab, bukan kewajiban MVC klasik.

### 2.1 Baseline versi untuk BE-01

Gunakan npm dan buat `package-lock.json` baru di Salvora. Pin versi langsung berikut, jangan menyalin lockfile proyek lama. Angka paket berasal dari entri resolved `package-lock.json` LanggananKu yang dibaca pada pemeriksaan ini; rentang `package.json` sumber bukan versi resolved.

| Paket/runtime | Versi baseline yang dipilih |
|---|---|
| Node.js | 24.21.0; jalur runtime 24 LTS |
| `next`, `eslint-config-next` | 16.4.2, keduanya sama |
| `react`, `react-dom` | 19.3.1, keduanya sama |
| `prisma`, `@prisma/client`, `@prisma/adapter-pg` | 7.10.1, ketiganya sama |
| `pg` | 8.23.1 |
| `typescript` | 5.9.3 |
| `tailwindcss`, `@tailwindcss/postcss` | 4.3.3, keduanya sama |
| `postcss` | 8.5.31 |
| `zod` | 4.6.7 |
| `bcryptjs` | 3.0.3 |
| `dotenv` | 17.4.2; pemuatan konfigurasi CLI Prisma secara eksplisit |
| `vitest` | 4.1.12 |
| `eslint` | 9.39.5 |
| `tsx` | 4.23.15 |
| PostgreSQL | Target major 18; patch/image tepat dikunci saat BE-02 menyiapkan layanan |
| shadcn/ui dan tipe pendukung | Kode komponen ditambahkan sesuai kebutuhan; pin CLI/primitive serta `@types/*` yang kompatibel ketika pertama dipakai, bukan menyalin seluruh UI sumber |

Dasar kompatibilitas: metadata lockfile menyatakan Next membutuhkan Node >=20.9 dan menerima React 19; React DOM 19.3.1 menerima React ^19.3.1; Prisma 7.10.1 menerima Node 24 dan TypeScript >=5.4; Vitest menerima Node 24; ESLint config Next menerima ESLint >=9. Runtime lokal yang teramati adalah Node 24.21.0. Dokumentasi [Next.js](https://nextjs.org/docs/app/getting-started/installation), [persyaratan Prisma](https://docs.prisma.io/docs/orm/reference/system-requirements), dan [Prisma 7](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7) mendukung jalur ini. Prisma 7 memakai adapter dan konfigurasi CLI tersendiri; jangan mengadaptasi contoh Prisma versi lama tanpa penyesuaian.

Integrasi [Tailwind dengan Next.js](https://tailwindcss.com/docs/installation/framework-guides/nextjs) memakai plugin PostCSS; [shadcn/ui mendukung React 19 dan Tailwind 4](https://ui.shadcn.com/docs/tailwind-v4). Ini dasar pemilihan, **bukan bukti install/build lulus**. Akses langsung metadata registry melalui alat web tidak berhasil; keberadaan setiap patch belum diverifikasi ulang ke registry. BE-01 wajib memverifikasi resolusi paket dan peer dependencies, menghasilkan lockfile baru, lalu menjalankan generate, typecheck, lint, dan build. Jika patch tidak tersedia/bermasalah, catat pengganti kompatibel di sini sebelum melanjutkan; jangan memakai `--force` atau menganggap lockfile sumber sebagai bukti runtime.

## 3. Inventaris LanggananKu dan rencana adaptasi

Semua path pada bagian ini relatif terhadap root **LanggananKu**, bukan root Salvora.

| Modul/sumber yang dibaca | Temuan sumber | Perlakuan dan task tujuan |
|---|---|---|
| `src/services/auth.ts`, `src/lib/validations/auth.ts` | Registrasi dengan hash bcrypt cost 12; email dinormalisasi; duplicate Prisma P2002 ditangani; login memakai pesan generik dan pembanding hash untuk email tidak ditemukan | **Adaptasi** validasi/hash/pola respons minimum; paksa peran pembeli dan kait penerbitan voucher yang idempoten. BE-03/BE-06 |
| `src/lib/auth/index.ts`, `src/lib/auth/rate-limit.ts`, route login/register/logout | Cookie `subspace_session`, token acak 32 byte, digest HMAC, sesi 7 hari, rotasi/login, hapus/logout, pemeriksaan role/Origin; rate limit di PostgreSQL | **Ubah** identitas cookie/secret/URL, izin per sumber daya dan profil sendiri; verifikasi rate limit dan pembersihan record kedaluwarsa. BE-01/BE-03 |
| `src/lib/db/index.ts`, `prisma.config.ts`, `src/lib/env.ts` | Singleton PrismaPg untuk dev; validasi env ada, tetapi kedua entry koneksi masih punya fallback ke `subspace` | **Adaptasi dengan perbaikan wajib** D-03/D-04; validasi sebelum client/CLI. Kredensial Midtrans belum lengkap tidak perlu menghalangi auth/katalog, tetapi operasi pembayaran harus ditolak aman. BE-01/BE-02 |
| `prisma/schema.prisma`, `prisma/migrations/202610220001_init/migration.sql` | PostgreSQL, role/user/session, payment/event, TIMESTAMPTZ, unique/FK/check; skema terikat plan/subscription; unique partial index satu subscription aktif per user | **Tulis ulang** skema/migrasi toko berdasarkan PRD bagian 13; adaptasi prinsip constraint/transaksi saja. BE-02 |
| `src/lib/midtrans/index.ts` | URL Snap/status sandbox; Basic auth server key; timeout request 15 detik; token dan redirect URL divalidasi; finish URL dari URL aplikasi; satu item `planName`; expiry 60 menit | **Adaptasi wrapper, ubah payload** menjadi item toko, diskon/ongkir sesuai total server, referensi percobaan dan deadline tunggal; selaraskan callback/halaman finish. BE-08 |
| `src/components/payment/snap.tsx`, route pembayaran (diinventarisasi); `src/app/api/payments/[orderId]/route.ts` (dibaca) | Detail server memeriksa pemilik/admin; `GET ?refresh=1` menjalankan rekonsiliasi; token hanya pada pending sebelum waktu lokal habis | **Ubah** ke kontrak toko; rekonsiliasi eksplisit melalui POST berotorisasi/Origin/rate limit. Komponen browser perlu audit saat dipakai, belum dinyatakan siap adaptasi. BE-01/BE-08/BE-10 |
| `src/app/api/webhooks/midtrans/route.ts`, `src/lib/midtrans/index.ts` | Runtime Node; batas panjang body; schema; SHA512 signature dengan timing-safe comparison; lookup referensi/nominal; Get Status sebelum penerapan; 503 bila status belum tersedia | **Adaptasi dan uji ulang** signature/payload/referensi/nominal/status terbaru. Verifikasi jumlah byte body dan respons retry/error tanpa rahasia. BE-09 |
| `src/services/payments.ts` | Harga dari DB, reuse pending token, simpan Snap redirect, event; timeout pembuatan tetap pending; lock baris user; cek ID transaksi dan nominal; `appliedAt` per payment | **Tulis ulang orkestrasi domain**: pesanan/percobaan terpisah, lock pesanan/stok/voucher lintas pembeli, penerapan sekali per pesanan, transaksi atomik. BE-07 sampai BE-10 |
| `src/lib/payments/policy.ts` | Peta settlement/capture/fraud/deny/cancel/expire/refund; sukses tidak diturunkan oleh pending; sukses terlambat dapat diterima | **Adaptasi sebagian**: simpan status provider sebenarnya, pisahkan status pesanan, tangani reversal/refund sebagai Perlu Penanganan; jangan salin kebijakan sukses yang terkunci selamanya. BE-09/BE-10 |
| `src/lib/subscriptions/{index,policy}.ts`, skema, blok sukses `applyVerifiedStatus` | `Plan`, `Subscription`, `durationDays`, `subscriptionDates`, BASIC/PREMIUM, aktivasi/perpanjangan dan sisa hari | **Tidak digunakan**. Hapus dependensinya pada hasil adaptasi toko; tidak mengubah berkas sumber. Ganti efek sukses dengan pesanan, stok, voucher dan pembelian pertama |
| Route `/api/plans`, `/api/subscriptions/me`, pricing, dashboard subscription/premium; seed lama | Teridentifikasi dari inventaris path sebagai domain langganan | **Tidak dibawa**; tidak mengaudit detail UI/seed atau menyalin data demo/akun lama |
| `scripts/local-postgres.mjs` (pola konfigurasi diperiksa) | Bootstrap dan nama database `subspace`/`subspace_test`, dapat menulis konfigurasi lokal | **Tidak dijalankan/disalin**; penyiapan database Salvora harus eksplisit dan baru. BE-02 |

### 3.1 Kekurangan yang harus ditutup saat adaptasi pembayaran

- Sumber membatasi pending berdasarkan user dan `expiryTime > now`. Setelah waktu lokal lewat, pola ini dapat membuka percobaan baru sebelum provider dipastikan terminal. Toko harus menutup celah ini, termasuk timeout dengan hasil belum diketahui.
- Lock user tidak melindungi unit stok terakhir yang diperebutkan user berbeda. Lock/constraint pesanan, stok dan voucher harus memakai urutan konsisten serta pengujian concurrency database nyata.
- `appliedAt` per payment tidak cukup mencegah dua percobaan sukses menerapkan pesanan yang sama. Guard tingkat pesanan dan pencatatan pembayaran ganda wajib; pemenuhan tetap sekali.
- Tidak ditemukan mekanisme scheduler pada daftar sumber yang diperiksa. Rekonsiliasi berdasarkan pembukaan halaman/refresh bukan pengganti job terjadwal.
- Waktu HTTP timeout 15 detik berbeda dari tenggat pembayaran 60 menit pada sumber, dan berbeda lagi dari durasi langganan 30 hari yang dibuang.
- Expiry halaman Snap tidak selalu mengakhiri transaksi kanal pembayaran, dan expiry halaman tidak mengirim webhook. Selaraskan tenggat order/reservasi/kanal/Snap/UI, lalu pastikan keadaan provider sebelum melepas reservasi. Rujukan: [expiry Snap](https://docs.midtrans.com/reference/expire-a-snap-session). Pola signature dan Get Status didukung [dokumentasi notifikasi Midtrans](https://docs.midtrans.com/reference/handle-notifications).
- Refund/reversal terverifikasi setelah sukses dicatat beserta Perlu Penanganan; tidak otomatis membalik stok/voucher atau menjalankan refund. Sukses setelah reservasi dilepas tidak otomatis mengirim barang.

## 4. Inventaris pengujian dan batas bukti

| Sumber tes yang diperiksa | Dapat digunakan kembali | Perubahan wajib |
|---|---|---|
| `tests/unit/signature.test.ts`, `env.test.ts` | Signature valid/palsu/pendek, error env aman, sandbox-only, auth tanpa key pembayaran | Nama env/data uji baru; tambahkan larangan fallback aplikasi/CLI/test dan penolakan target legacy |
| `tests/unit/policy.test.ts` | Pemetaan provider, nominal identik, duplicate/out-of-order, refund | Pisahkan dan buang blok hak akses serta durasi subscription; tambah reversal, status asing, late success, deadline dan Perlu Penanganan |
| `tests/integration/auth.test.ts`, `authorization.test.ts` | Hash/duplikasi/login dan sesi/peran dengan repository/cookie mock | Data toko baru; tambah logout/revokasi/rotasi, Origin, eskalasi peran, kepemilikan alamat/keranjang/pesanan/ulasan; voucher login terpisah BE-06 |
| `tests/integration/payments.test.ts`, `webhook.test.ts`, `routes.test.ts` | Harga server, reuse token, timeout vs penolakan pasti, signature/nominal/referensi, GET provider sebagai acuan, penolakan akses | Ganti assertion aktivasi subscription dengan stok/voucher/pesanan; uji rollback, duplicate lintas percobaan, expiry dan dua akun berebut stok |
| `tests/integration/database.test.ts`, `vitest.db.config.ts` | Pola pengujian PostgreSQL nyata terpisah dari suite mock, constraint dan concurrency | Guard lama khusus `subspace_test` wajib diganti; fixture dan cleanup seluruhnya memakai database test Salvora. Buang pengujian penambahan hari premium |
| `vitest.config.ts`, `scripts/verify-core.mjs`, `scripts/verify-http.mjs` | Pemisahan suite dan pola verifikasi teridentifikasi | Suite default mengecualikan tes DB; nama integration tidak membuktikan koneksi provider/DB nyata. Tinjau ulang helper sebelum digunakan |

**Bukti aktual BE-00:** membaca sumber dan metadata lockfile, inventaris path, menelaah PRD/task, serta memeriksa dokumentasi resmi kompatibilitas dan Midtrans. Tidak menjalankan install/build/lint/typecheck, tes LanggananKu, tes toko, migrasi/seed, koneksi database, merchant dashboard, Snap, atau webhook. Tidak ada hasil tes lulus yang diklaim. Tes yang memakai mock/test double bukan bukti integrasi Midtrans berfungsi di Salvora.

## 5. Inventaris konfigurasi tanpa kredensial

Nama berikut adalah kontrak konfigurasi **yang direncanakan**, belum berkas `.env` yang dibuat. BE-01 membuat `.env.example` hanya dengan placeholder dan validasi terpisah untuk fondasi/pembayaran/infrastruktur opsional.

| Nama | Visibilitas | Kegunaan dan waktu diperlukan |
|---|---|---|
| `DATABASE_URL` | Rahasia server/CLI | Koneksi PostgreSQL Salvora sesuai lingkungan; BE-01/BE-02; tanpa default/fallback |
| `TEST_DATABASE_URL` | Rahasia proses tes | Hanya `salvora_kitchen_test`, diverifikasi sebelum operasi DB tes |
| `SHADOW_DATABASE_URL` | Rahasia CLI, opsional | Jika strategi migrasi lokal membutuhkan shadow DB, target khusus Salvora yang terpisah |
| `AUTH_SECRET` | Rahasia server | Dibuat baru, minimal 32 karakter acak; digest sesi; jangan pakai secret sumber |
| `NEXT_PUBLIC_APP_URL` | Publik | Origin aplikasi sendiri; redirect/Origin check; HTTPS pada demo |
| `MIDTRANS_SERVER_KEY` | Rahasia server | Server key sandbox baru untuk konfigurasi Salvora; wajib saat pembayaran diaktifkan |
| `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` | Publik | Client key sandbox untuk Snap browser; tidak menggantikan server key |
| `MIDTRANS_IS_PRODUCTION` | Server, bukan rahasia | Hanya `false`; nilai produksi ditolak |
| `MIDTRANS_WEBHOOK_URL` | Server/konfigurasi merchant, bukan rahasia | URL HTTPS publik `${NEXT_PUBLIC_APP_URL}/api/webhooks/midtrans`; konsisten dengan Dashboard Sandbox, bukan rahasia autentikasi webhook |
| `SESSION_TTL_DAYS` | Kebijakan server | Baseline 7 jika dijadikan env; cookie `salvora_session` adalah konstanta proyek, bukan kredensial |
| `PAYMENT_EXPIRY_MINUTES` | Kebijakan server | Dipilih pengguna 60 pada BE-07; paymentConfig menolak nilai berbeda agar selaras dengan deadline order/reservasi |
| `NODE_ENV` | Runtime | Disediakan proses Next.js untuk mode dev/test/production; sandbox tetap ditentukan terpisah |

Foto/penjadwal belum dipilih. Nama konfigurasi final ditetapkan saat O-07/O-08 ditutup. Jika memakai object storage kompatibel S3, kontrak kandidat adalah `STORAGE_ENDPOINT`, `STORAGE_REGION`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, dan `STORAGE_PUBLIC_BASE_URL`; key rahasia hanya di server dan bucket khusus toko. Jika job dipanggil lewat HTTP internal, kandidat `CRON_SECRET` dibuat baru dan disimpan server/penjadwal. Daftar kandidat ini tidak berarti provider sudah dipilih atau kredensial harus tersedia pada BE-01.

Jangan mencetak env lengkap pada error/log. Server key, digest/token sesi, password/hash, dan kredensial database/storage tidak boleh masuk respons publik. Client key dan URL aplikasi adalah konfigurasi publik. Seed admin tidak boleh mengandung akun/password nyata; mekanisme input secret internal dirinci pada BE-02/BE-03.

## 6. Keputusan terbuka dan dependensi

Keputusan bisnis PRD yang masih berlabel usulan tetap terbuka sampai dicatat keputusan kelompok. Pemilik tindak lanjut adalah Kelompok 11, dengan pengembang menyiapkan verifikasi teknis. Tidak satu pun baris ini menghalangi fondasi BE-01 atau pekerjaan auth/katalog yang independen.

| ID | Keputusan/kondisi saat ini | Dampak dan gerbang sebelum pekerjaan terkait |
|---|---|---|
| O-01 | **Ditutup oleh pengguna pada BE-07: 60 menit sejak order dibuat** | Order.paymentDeadline dan StockReservation.expiresAt sama; parameter expiry Snap/UI mengikuti sisa tenggat ini. paymentConfig wajib 60. Retry tidak memperpanjang tenggat; BE-10/BE-14 tetap menguji rekonsiliasi/late success |
| O-02 | **Ditutup untuk delivery manual awal BE-07: Kota Tanjungpinang, Kepulauan Riau, Rp10.000 per pesanan** | Pengguna memilih menetapkan wilayah/tarif, menyebut Tanjungpinang lalu menyetujui ongkir awal 10k; cakupan dinyatakan sebagai seluruh Kota Tanjungpinang saat tindak lanjut. Checkout menolak luar city/province, tanpa tarif per jarak/minimum/pickup/gratis ongkir. Tidak memakai opsi demo Rp0 |
| O-03 | **Ditutup 23 Oktober 2026 oleh pengguna:** stok tersedia 1–5 menipis, 0 habis, >=6 normal | Berlaku BE-04/BE-13; hitung setelah reservasi, uji ulang bersama BE-07 |
| O-04 | **Ditutup 23 Oktober 2026 oleh pengguna:** JPEG/PNG/WebP maksimum **2.000.000 byte** | BE-04 memvalidasi isi/MIME/ukuran, key server; bukan unggahan avatar |
| O-05 | **Ditutup BE-12, disetujui pengguna:** integer 1–5, satu ulasan per item, trim **10–1.000 karakter** | Owner/completed/unique/concurrent/rollback dan agregasi terbukti PostgreSQL/HTTP BE-14. Jumlah unit tidak menambah kuota, pembelian berbeda dapat mengulas lagi |
| O-06 | **Ditutup 24 Oktober BE-14:** BNI VA Sandbox Rp14.000 settlement terverifikasi webhook nyata + GET Status + SQL | Nominal/reference/transaction ID cocok, paid sebelum deadline, satu PaymentApplication/transisi, stok/reservasi/voucher tepat sekali. Bukti privat UUID baru, proof lama tidak ditimpa. Tunnel test sudah ditutup; bukan kesiapan webhook deployment atau bukti dari redirect/token |
| O-07 | **Lokal dipilih pada BE-04:** adapter filesystem privat `.local/uploads/product-photos`, metadata DB; test terpisah | Deployment tetap memerlukan volume persisten atau adapter provider yang dipilih sebelum upload hosting diterima. Production tidak memakai default ephemeral dan wajib konfigurasi eksplisit; backup mencakup DB+file |
| O-08 | Pilihan lokal ditutup BE-10: Windows Task Scheduler tiap menit. Rekonsiliasi BE-14 mengamati dua tick 14:09/14:12 WIB exit 0, COMPLETED, checked=0; task tidak diubah. Hosting/job server demo belum dipilih | Launcher GUI, akun Limited, lock/jeda durable. Tick antrean kosong bukan pembayaran provider, bukan jaminan seluruh tick masa depan. Startup manual pengguna tidak diulang |
| O-09 | **Akses katalog/detail: publik. Penerimaan BE-11:** manual admin dengan receiptConfirmed=true dan catatan wajib, tanpa penyelesaian otomatis. Disetujui 23 Oktober. Konten menu/kontak final terbuka | Keranjang/transaksi wajib login; BE-11 PostgreSQL/HTTP telah diterima. Fixture tetap demo; konten final memengaruhi UI/UAT |
| O-10 | **Ditutup 23 Oktober 2026:** pengguna menyetujui penetapan aturan sesuai kebutuhan bisnis; dipilih pembulatan ke bawah ke Rupiah penuh sesuai usulan PRD | Floor sekali pada subtotal seluruh barang, diskon min(floor(subtotal × 20 / 100), 100000). Tanpa minimum tambahan; ongkir tidak didiskon. PRD 1.6 dan rumus/tes BE-06 sudah selaras |
| O-11 | Lokal ditutup BE-02. BE-14 setelah izin: dua database sementara baru dan role khusus, Prisma deploy dua migrasi, seed/idempotensi/isolasi serta dump/restore lulus 15:36 WIB; cleanup target dan fingerprint dev/test cocok | Tidak memperluas allowlist aplikasi, reset/provision ulang existing atau memakai 5432. Foto/hosting/retensi deployment tetap memerlukan bukti terpisah |

Keputusan final ditambahkan dengan tanggal, pemilik, pilihan dan alasan pada dokumen ini serta diselaraskan ke PRD bila aturan bisnis berubah (PRD bagian 25.3). Tidak mengubah usulan menjadi aturan tersembunyi di kode. Hosting, storage dan scheduler dapat ditentukan bertahap, tetapi tidak boleh menunda pemilihannya melewati gerbang di atas.

## 7. Kesiapan BE-01 dan catatan penutupan

**BE-01 siap dimulai** dalam workspace Salvora: stack, ORM/driver, baseline paket, pola sesi, pemisahan database, struktur tanggung jawab, dan konfigurasi minimum sudah ditentukan. BE-01 belum dikerjakan melalui BE-00 ini.

Urutan serah terima:

1. Inisialisasi aplikasi di root yang sudah berisi PRD/desain; pertahankan dokumen/aset yang ada. Jangan memakai generator yang menimpa seluruh direktori.
2. Resolusi dan pin paket D-01–D-03; hasilkan lockfile sendiri dan lakukan pemeriksaan dasar. Bedakan pemeriksaan paket/build dari tes integrasi database/provider.
3. Buat `.env.example` placeholder serta validasi server/CLI tanpa fallback. Konfigurasi Midtrans belum lengkap tidak perlu memblokir auth/katalog.
4. Buat `docs/API-CONTRACT.md`: bentuk respons, error, input, pagination, status, otorisasi/kepemilikan dan operasi PRD. Endpoint yang belum diimplementasikan diberi status rencana; O-09 dicantumkan pada kontrak akses katalog.
5. Lanjutkan skema baru BE-02. Checkout/pembayaran menunggu O-01/O-02 dan akses sandbox; unggahan menunggu O-04/O-07; scheduler menunggu O-08. Auth dan katalog dapat maju tanpa menunggu ongkir.

Pemeriksaan penutupan dokumentasi:

- [x] Keputusan fondasi untuk BE-01 tercatat, termasuk keterbatasan verifikasi versi.
- [x] Adaptasi sumber dibedakan dari logika Plan/Subscription/premium yang dibuang.
- [x] Database dev/test/demo direncanakan terpisah; larangan fallback berlaku di runtime, CLI dan test runner.
- [x] Keputusan terbuka memiliki task dan gerbang yang jelas.
- [x] Pemeriksaan sumber dibedakan dari runtime; belum ada klaim transaksi sandbox berhasil.
- [x] Dokumentasi hanya memuat nama konfigurasi/kebijakan, tanpa kredensial atau data pengguna.
- [x] Tidak ada operasi tulis, migrasi, seed, atau perubahan kode/database LanggananKu yang dilakukan.
- [x] Tidak menambahkan COD, transfer manual, promo umum, pickup, gratis ongkir bersyarat, refund otomatis, atau fitur P1 sebagai pekerjaan awal.

### Hasil BE-00

- Status: Selesai untuk cakupan task keputusan dan inventarisasi.
- PRD acuan: 1.4, bagian 2, 14.1, 21, 24, 25.
- Penanggung jawab: belum ditetapkan oleh kelompok.
- Tanggal: 22 Oktober 2026.
- Dokumen berubah: `docs/DECISIONS.md`; status dan catatan serah terima BE-00 pada `docs/TASKS-BACKEND.md`.
- Migrasi/kontrak API berubah: tidak ada.
- Pemeriksaan aktual: inventaris filesystem, pembacaan sumber/tes/migrasi/metadata paket, rujukan resmi dan tinjauan isi dokumentasi. Runtime belum diuji.
- Kriteria dokumentasi yang belum terpenuhi: tidak ada; O-01–O-11 adalah tindak lanjut yang membatasi task dependen, bukan hasil implementasi yang diklaim selesai.
- Catatan berikutnya: mulai BE-01 sesuai baseline dan validasi yang dijelaskan di atas.

## 8. Pembaruan BE-01 — 23 Oktober 2026

Fondasi dibuat pada workspace yang sama: Next.js App Router, Tailwind 4, validasi konfigurasi bertingkat, envelope API, pembacaan JSON berbatas byte, pagination, helper Origin/peran/kepemilikan, whitelist user dan enum status. Hanya halaman sementara serta `GET /api/health` yang tersedia; [API-CONTRACT.md](API-CONTRACT.md) menyatakan seluruh endpoint bisnis sebagai rencana. shadcn/ui tetap ketentuan UI berikutnya dan belum perlu dipasang untuk halaman sementara.

Baseline paket bagian 2.1 berhasil di-resolve dari npm registry dan dipasang dengan lockfile baru Salvora. Paket tambahan dikunci: `@next/env` 16.4.2, `server-only` 0.0.1, `@types/node` 24.19.2, `@types/pg` 8.23.1, `@types/react`/`@types/react-dom` 19.3.0. Tidak memakai `--force`/`--legacy-peer-deps`. Tidak ada paket/dependensi, akun atau konfigurasi yang disalin dari LanggananKu.

Prisma generator/provider dibuat tanpa model domain; generate berhasil dengan URL fixture khusus Salvora (tanpa kredensial dan tanpa koneksi DB). Client generated diabaikan Git. Pemakaian client/database nyata, migrasi dan seed menunggu BE-02. Validasi runtime/CLI menolak database legacy dan placeholder; akses data test hanya menerima `TEST_DATABASE_URL` dengan nama `salvora_kitchen_test`. Belum ada runner integrasi DB/migrasi test; tidak boleh memanfaatkan koneksi dev sebagai penggantinya.

Konfigurasi dibaca secara lazy agar halaman statis/build dapat berjalan sebelum provisioning. `check:env` dan health memvalidasi fondasi; `--payment` memerlukan sandbox key, HTTPS webhook dan expiry eksplisit. Tidak membuat `.env`/`.env.local` atau mengisi O-01 diam-diam. TLS produksi dan Origin berasal dari URL aplikasi yang tervalidasi, bukan header Host dari client.

Catatan audit dependensi: registry melaporkan **5 temuan high pada rantai tooling lint pengembangan** (`eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces`, GHSA-vfj7-8cjw-p6xm). `npm audit --omit=dev` melaporkan **0**. Pada pemeriksaan ini npm hanya menawarkan downgrade lint config ke 14.2.35 sebagai perubahan major; tidak diterapkan karena tidak konsisten dengan Next 16.4.2. Ini keterbatasan tooling yang tetap dicatat, bukan klaim audit penuh bersih; tinjau patch upstream sebelum upgrade. npm juga memberi pemberitahuan ESLint 9 tidak lagi didukung dan pemberitahuan allowScripts untuk empat paket; operasi generate/build/test aktual telah diverifikasi. Tidak menjalankan auto-fix major atau menyetujui script paket secara massal.

Keputusan terbuka O-01–O-11 tetap berlaku. Kontrak akses katalog publik diberi label usulan O-09; endpointnya belum diimplementasikan. Tidak ada perubahan aturan bisnis PRD. Hasil pemeriksaan aktual dan status serah terima tercatat pada TASKS-BACKEND.

## 9. Pembaruan BE-02 — 23 Oktober 2026

Status: **Selesai untuk skema, migrasi, seed dan pembuktian integritas penyimpanan**. Rincian/prosedur ada pada [DATABASE.md](DATABASE.md). Tidak mengimplementasikan endpoint bisnis BE-03 dan seterusnya.

O-11 ditutup **untuk pengembangan/pengujian lokal**: PostgreSQL **18.6**, binary yang sudah terpasang, cluster baru khusus workspace pada 127.0.0.1:55433. Database dev/test/shadow dibuat dengan role/password acak berbeda dan autentikasi SCRAM; role test terbukti tidak punya CONNECT ke dev. Layanan PostgreSQL yang sudah ada, kode/database LanggananKu dan konfigurasi lamanya tidak diubah. Provisioning demo hosting, kapasitas/role produksi dan retensi backup tetap menunggu O-08/O-11 pada lingkungan demo. Pool client lokal dibatasi 5 koneksi per instance; ini bukan kapasitas deployment yang sudah diukur.

Skema mencakup entitas P0 PRD plus Session/RateLimit (fondasi auth), CheckoutQuote (referensi ringkasan BE-01), StockReservation dan PaymentApplication (integritas reservasi/penerapan). Tidak membuat tabel P1 atau model premium. PaymentApplication memakai PK orderId dan FK ke percobaan sukses milik order yang sama, sebagai mekanisme setara applied_at pada pesanan. Partial unique index membatasi satu percobaan CREATED/PENDING/UNCONFIRMED; banyak percobaan historis dan dua pembayaran sukses tetap dapat dicatat. Efek bisnis dan verifikasi provider tetap tugas BE-07–BE-10.

Nominal diputuskan memakai INTEGER PostgreSQL, maksimum **2.147.483.647 Rupiah** per nilai, tanpa floating point. Ini batas teknis penyimpanan yang harus divalidasi API BE-04/BE-06; bukan kebijakan harga/ongkir baru. Snapshot Order/OrderItem immutable melalui trigger, waktu TIMESTAMPTZ(3), dan deadline/ongkir tidak memiliki default keputusan bisnis. Rating menyimpan FK item dan menurunkan pembeli/produk melalui relasi; tidak menduplikasi atribut kepemilikan yang bisa bertentangan. Batas komentar final/otorisasi ulasan masih BE-12/O-05.

Migrasi baru `202610230001_init` diterapkan pada dev dan test kosong; status migrasi berhasil dan diff struktur yang dikenali Prisma tidak menunjukkan perbedaan. SQL CHECK/trigger/partial index tetap disimpan pada migrasi dan diuji langsung, karena tidak seluruhnya direpresentasikan Prisma. Schema/client generated tervalidasi; tidak memakai db push/reset atau mengedit migrasi setelah diterapkan.

Seed idempoten membuat 2 kategori dan 2 produk **Data Demo** dengan isDemo; rerun tidak mengubah stok/data existing. Admin demo baru diprovisikan internal dengan password acak dan bcrypt cost 12; kredensial hanya di `.local/admin-demo.json`. `.env.local` dibuat dengan database credentials dan AUTH_SECRET baru; kedua lokasi privat serta `.local/postgres/owner.json` diabaikan Git. Variabel `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` opsional hanya untuk provisioning CLI internal, bukan browser. Tidak ada rahasia disalin ke dokumentasi/chat atau berasal dari LanggananKu.

Backup manual pg_dump custom-format berhasil dibuat dan lolos pemeriksaan pg_restore --list. Restore penuh **belum diuji** karena target demo kosong belum disediakan; prosedurnya tercatat, tidak disebut lulus. Scheduler backup/demo masih menunggu hosting.

Bukti aktual: **12 tes PostgreSQL nyata**, **15 tes fondasi**, lint/typecheck, generate, production build dan smoke HTTP lulus. Pembacaan Prisma dev menunjukkan PostgreSQL 18.6, 2 kategori demo, 2 produk demo, 1 admin, 0 order. Ini bukti database, bukan bukti login/checkout/Snap/webhook berjalan. O-01–O-10 tetap sesuai gerbang task; autentikasi BE-03 siap dilanjutkan tanpa menunggu ongkir.

## 10. Pembaruan BE-03 — 23 Oktober 2026

Status: **Selesai untuk backend auth/otorisasi/profil sendiri**. [AUTH.md](AUTH.md) menjelaskan implementasi, cara verifikasi dan batasnya. Kontrak API naik ke 0.2 dengan auth/profil ditandai tersedia; endpoint produk/transaksi tetap rencana. Tidak ada migrasi baru, data pengguna lama atau fitur di luar PRD.

D-05–D-08 diterapkan: bcrypt cost 12, email normalisasi/unik, public BUYER, token random 32 byte di cookie, HMAC digest pada DB, sesi absolut 7 hari, rotasi saat login, revoke sebelum sukses logout. Role dibaca dari DB setiap resolusi sesi. Cookie HttpOnly/SameSite=Lax/host-only/path `/`, Secure mengikuti URL HTTPS; response no-store, Vary Cookie, whitelist user. Origin tepat sama wajib pada semua mutation auth/profil; duplicate/malformed cookie ditolak. Profil admin hanya mengubah nama akun dari sesi, bukan ID/email/role dari browser.

Kebijakan teknis limiter ditetapkan: bucket fixed-window 15 menit, login 10/email dan 200 global, register 5/email dan 50 global, HMAC key dengan counter PostgreSQL atomik. Sukses/gagal dihitung dan 429 memberi Retry-After. Tidak mempercayai X-Forwarded-For client sebelum kontrak hosting/proxy; batas per jaringan dan cleanup/retensi terjadwal menyusul pemilihan O-08. Ini tidak mengubah aturan bisnis toko.

Hook `afterAuthenticatedLogin(tx,user)` tersedia pada registrasi yang membuat sesi/login pertama dan login biasa, dalam transaksi akun/sesi yang sama. Kegagalan hook me-rollback akun/sesi baru serta pencabutan sesi lama. Implementasi penerbitan voucher BE-06 **belum ada**; hook saat ini tidak menerbitkan Discount atau mengubah isFirstPurchase. BE-06 wajib memvalidasi role/kelayakan dan uniqueness saat mengisinya.

Konfigurasi mode test diselaraskan: appConfig dan factory DB hanya memakai TEST_DATABASE_URL jika NODE_ENV=test, tanpa fallback dev. Ini memungkinkan server hasil build diuji HTTP dengan fixture khusus test; mode aplikasi development/production tetap menolak koneksi test/legacy. Skrip HTTP memakai AUTH_SECRET acak baru, membuktikan runtime auth tanpa kunci Midtrans, lalu membersihkan akun/sesi/counter fixture dan menghentikan servernya. Kredensial admin demo pribadi tetap tidak dipakai/diubah.

Bukti aktual: **21 tes unit/fondasi**, **22 tes PostgreSQL** (12 integritas + 10 auth), lint/typecheck dan production build lulus. Uji HTTP auth nyata lulus: register/duplikat/role injection, error login generik, cookie flags, rotasi/revokasi/expiry, Origin, admin sendiri dan peran terbaru, serta 10 login lalu 429/Retry-After. Smoke HTTP fondasi tetap lulus. Frontend lengkap, UAT browser/TLS hosting, performa dan alur belanja tetap belum dibuktikan oleh task ini. Audit tooling dev BE-01 tetap tercatat tanpa perubahan dependensi.

## 11. Pembaruan BE-04 — 23 Oktober 2026

Status: **Selesai untuk backend kategori, produk, stok dan unggahan lokal**. PRD aktif **1.5**, mengikuti jawaban pengguna untuk stok menipis, format/batas foto, serta katalog publik. Keputusan bisnis tersebut tidak dipilih diam-diam. Kontrak v0.3 dan [CATALOG.md](CATALOG.md) mencatat perilaku endpoint serta gerbang deployment.

Read publik hanya produk/kategori aktif, stok habis tetap tampil, rating/count dari data tersimpan. Admin memakai sumber kategori sama, pencarian/filter/pagination, CRUD kategori, tambah/ubah/nonaktifkan produk, dan endpoint stok khusus. Count publik hanya produk aktif, admin semua produk kategori. Snapshot order/item historis tidak berubah mengikuti katalog. Stock update atomik menolak nilai di bawah reservasi dan versi stale, dengan updatedAt meningkat minimal 1 ms. Tidak ada DELETE produk rutin, promo umum, varian kompleks atau pencarian katalog P1.

O-07 lokal diputuskan adapter filesystem persisten privat; production wajib PRODUCT_PHOTO_STORAGE_DIR absolute di luar public dan PRODUCT_PHOTO_STORAGE_PERSISTENT=true, tanpa default ephemeral. Pemilihan/tes volume hosting tetap menunggu O-08. sharp **0.35.5** dikunci sebagai dependensi langsung (versi yang sebelumnya sudah menjadi dependensi Next). Multipart/file dibatasi byte aktual, format isi dicocokkan MIME, full decode dengan batas 20 juta piksel, orientasi diterapkan, metadata dibuang lewat WebP quality 85, output tetap <=2.000.000 byte. File/key UUID server, bukan nama/path client. Metadata ProductPhoto menyimpan dimensi/ukuran/hash/pembuat; file pending/nonaktif hanya terlihat admin, publik hanya file yang dipakai produk dan kategori aktif. Tidak ada avatar/CMS.

Migrasi `202610230002_product_photos` menambah model metadata, Product.photoId nullable dan constraint; kolom imageUrl/photoKey lama dipertahankan. Diterapkan pada dev/test Salvora; migrasi 001 tidak diedit. Tidak mengubah LanggananKu atau menyalin foto/akun/data lamanya. Backup DB harus disertai volume foto; restore volume/retensi dan garbage collection belum dibuktikan/diimplementasikan pada hosting.

Bukti aktual: **28 tes unit/fondasi + 31 tes PostgreSQL**, lint/typecheck dan production build lulus. HTTP katalog/foto, regresi HTTP auth dan smoke fondasi lulus pada server sementara, fixture/test DB dan direktori foto test terpisah. Kasus penting: nonaktif/habis, rating/count/pagination/filter, admin/Origin, snapshot, dua edit stok bersamaan/lantai reservasi, byte/MIME/path upload, preview privat/foto publik, cleanup file baru jika insert metadata gagal. Audit runtime 0; temuan tooling dev BE-01 tetap ada. Belum membuktikan checkout/reservasi BE-07, UI Figma, performa atau ketahanan volume hosting.

## 12. Pembaruan BE-05 — 23 Oktober 2026

Status: **Selesai untuk backend alamat dan keranjang pembeli**, PRD 1.5 FR-03/FR-04. Layanan memakai skema BE-02 tanpa migrasi, konfigurasi atau dependensi baru. Kepemilikan berasal dari sesi BUYER, DTO tanpa userId, Origin pada mutasi, respons no-store/Vary Cookie, referensi asing/tidak ditemukan sama-sama 404. Tidak ada perubahan pada proyek atau database LanggananKu.

Keranjang dibuat lazily saat mutasi berhasil; GET tidak menulis dan mengembalikan id null jika belum ada. Lock User per akun sebelum mutasi dan constraint unik menjaga penggabungan produk saat request bersamaan. Pemeriksaan stock aktif/stok tersedia memakai shared row lock; tidak membuat reservasi atau mengurangi stok. Harga/stok dibaca terkini; barang tidak tersedia dipertahankan untuk ditinjau/dihapus. BigInt menjaga hitungan sebelum batas INTEGER Rupiah diperiksa; mutasi invalid di-rollback. DELETE item mengembalikan null sesuai pola delete umum agar perubahan harga yang membuat subtotal terlalu besar tidak menghalangi penghapusan. Frontend memuat ulang cart setelahnya. Kontrak diperbarui v0.4, rincian [BUYER.md](BUYER.md).

Alamat memuat field minimum PRD dengan batas teknis input; postcode/notes opsional/null, tanpa asumsi wilayah delivery atau ongkir baru. CRUD alamat tidak menyentuh snapshot order. Pemilihan alamat memakai daftar akun; BE-07 tetap harus memvalidasi ulang addressId dan menyalin snapshot. BE-06 tetap terpisah; BE-07 wajib menolak keranjang kosong, menghitung ulang harga/stok dan membuat reservasi atomik dengan urutan lock konsisten. Keputusan terbuka wilayah/ongkir, expiry, hosting dan pembulatan tidak ditutup oleh BE-05.

Bukti aktual: **31 tes unit/fondasi + 41 tes PostgreSQL**, lint/typecheck/build, HTTP pembeli dengan sesi nyata serta smoke fondasi lulus. Pengujian mencakup ownership/Origin/role, snapshot alamat, penggabungan bersamaan, jumlah/stok/produk nonaktif, harga terkini dan batas nominal/rollback/penghapusan. Akun/cookie/secret fixture dan DB test terpisah dari dev, dibersihkan spesifik setelah uji. Ini belum membuktikan frontend, checkout, Midtrans atau performa hosting. Audit tooling dev yang sudah dicatat tetap tidak diubah.

## 13. Progres awal BE-06 — 23 Oktober 2026, sebelum penutupan O-10

Status: **Dalam pengerjaan; O-10 masih menunggu keputusan pengguna**. Penerbitan idempoten dan GET /api/me/voucher telah tersedia. Registrasi bersesi dihitung sebagai login pertama. User dikunci sebelum insert sesi, kemudian kelayakan role/flag/riwayat pembayaran dibaca dalam transaksi yang sama. Langkah ini memperbaiki deadlock upgrade lock foreign key sesi yang ditemukan pengujian login bersamaan. Unique Discount.userId menjadi pengaman penyimpanan terakhir; voucher lama termasuk RESERVED/USED tidak direset. Gagal hook merollback akun/sesi/voucher dan rotasi. isFirstPurchase tetap true sampai penerapan pembayaran sukses task BE-09.

Helper subtotal/total memakai BigInt dan batas INTEGER Rupiah, tanpa floating point atau nominal browser. Pembacaan input harga/kandidat voucher berasal dari cart/Product pemilik dalam transaksi konsisten, tanpa reservasi. Rumus diskon final dan uji batas pembulatan menunggu jawaban usulan ke bawah ke Rupiah penuh; belum ada default terselubung, endpoint quote atau pilihan ongkir baru. Kontrak status AVAILABLE/RESERVED/USED dan tanggung jawab BE-07/BE-09/BE-10 dijelaskan di [VOUCHERS.md](VOUCHERS.md). Tidak ada migrasi, dependensi/config baru, perubahan data/proyek LanggananKu atau fitur promo umum.

Bukti aktual bagian yang tersedia: **35 tes unit/fondasi + 50 tes PostgreSQL**, lint/typecheck/build dan HTTP auth/voucher, regresi katalog/foto, alamat/keranjang serta smoke fondasi lulus. Empat login pertama bersamaan menghasilkan satu voucher dan sesi valid; admin/pembeli lama/riwayat sukses/refund/reversal tidak diterbitkan voucher, read privat tidak menerbitkan dan rollback diuji. Input harga memakai harga terkini serta stok setelah reservasi; nominal invalid/overflow ditolak. Fixture spesifik dibersihkan pada test DB; constraint restriksi voucher ditangani cleanup fixture tanpa mengubah data lain. Belum membuktikan rumus diskon final, persaingan checkout/reservasi, penggunaan/pelepasan voucher atau Midtrans.

## 14. Penutupan BE-06 dan O-10 — 23 Oktober 2026

Status: **BE-06 selesai**. Pengguna menjawab persetujuan dan memberi kewenangan menetapkan aturan sesuai kebutuhan bisnis. Dipilih usulan PRD: pembulatan diskon ke bawah ke Rupiah penuh. Alasannya: nominal Rupiah tetap integer, hasil deterministik tanpa pecahan, serta konsisten dengan cap Rp100.000. PRD aktif diperbarui ke **1.6**, kontrak API **0.6**, tanpa perubahan cakupan fitur.

Rumus final memakai BigInt: diskon layak = min(floor(subtotal seluruh barang × 20 / 100), 100000), tidak layak = 0; total = subtotal - diskon + ongkir. Pembulatan dilakukan sekali, bukan per item. Tidak ada minimum tambahan: subtotal Rp1–Rp4 menghasilkan diskon Rp0 akibat pembulatan. Layanan priceBuyerCart mengambil input dan kelayakan dari database akun dalam transaksi caller, menerapkan rumus otomatis, serta mengembalikan breakdown dan voucher kandidat. Ongkir wajib argumen kebijakan server; tidak dipilih Rp0 atau tarif/wilayah baru. Tidak ada endpoint quote, reservasi atau perubahan status voucher dari perhitungan ini.

Bukti akhir: **38 tes unit/fondasi + 51 tes PostgreSQL**, lint/typecheck dan production build lulus. Tes tambahan membuktikan pecahan (Rp10.003 → Rp2.000), agregat (Rp20.007 → Rp4.001), batas cap (Rp499.999/Rp500.000/Rp500.001), subtotal kecil tanpa minimum, batas INTEGER, ongkir tidak terdiskon, harga terkini, voucher tidak ada/reserved/tidak layak, serta cap pada data cart nyata. HTTP auth/voucher, katalog/foto, alamat/keranjang dan smoke fondasi lulus selama pengerjaan BE-06; rumus final dibuktikan tes unit/database, bukan endpoint checkout yang belum ada. Tidak ada migrasi/dependensi/config baru, rahasia di dokumentasi atau perubahan LanggananKu. BE-07 masih memerlukan keputusan ongkir/wilayah dan expiry serta uji reservasi/idempotensi/konkurensi checkout.

## 15. Penutupan BE-07 ? 23 Oktober 2026

Status: **Selesai untuk quote, order dan reservasi**, PRD aktif 1.7, kontrak API 0.7. Pengguna memilih batas pembayaran 60 menit dan ongkir awal Rp10.000 untuk Tanjungpinang; cakupan operasional dinyatakan seluruh Kota Tanjungpinang, Kepulauan Riau. Tidak memakai opsi demo Rp0. Checkout menolak luar cakupan, tidak menambah tarif per jarak/pickup/gratis ongkir. PAYMENT_EXPIRY_MINUTES pada .env.example dan konfigurasi lokal nonrahasia diselaraskan ke 60; paymentConfig menolak nilai lain. Key Sandbox tetap belum diisi/diuji.

Quote TTL 5 menit dipilih sebagai batas teknis peninjauan, bukan reservasi atau batas pembayaran. Snapshot canonical hash mengikat alamat, cartItemId/item/harga, voucher, ongkir dan kebijakan. Konfirmasi membangun ulang di bawah lock User ? Address ? Product sorted ? Category sorted ? Discount; perubahan harus ditinjau ulang dengan quote baru. Order/item/history, reservasi stok/voucher dan penghapusan item cart atomik; physicalStock dan isFirstPurchase tidak berubah. Deadline order dari jam database persis sama dengan expiresAt reservasi.

Idempotensi unik per akun dan key, hash order mengikat quoteId. Replay membaca snapshot order tanpa menghitung ulang/mereservasi atau memperpanjang tenggat, bahkan jika quote expired atau alamat dihapus. Key/hash dipertahankan selama order tersimpan. Quote yang sudah menghasilkan order ditolak untuk key baru. Tidak ada migrasi/dependensi baru: schema BE-02 mencukupi. Retry deadlock/serialization dibatasi dua kali setelah percobaan awal.

Bukti aktual: **40 tes unit/fondasi + 65 tes PostgreSQL**, lint/typecheck/build dan HTTP pembeli/checkout serta smoke fondasi lulus. Diuji last-unit dua pembeli, empat konfirmasi key sama, satu voucher satu order aktif, kegagalan setelah reservasi yang me-rollback semuanya, mutasi cart bersamaan, quote berubah/expired, ownership/Origin/role, wilayah/tarif, snapshot/replay dan deadline 60 menit. Fixture spesifik test dibersihkan, tidak menyentuh database dev/LanggananKu atau akun pribadi. Tidak ada panggilan provider. Detail [CHECKOUT.md](CHECKOUT.md).

BE-08 harus memakai snapshot dan sisa deadline order untuk Snap. BE-09/BE-10 menangani konsumsi/release dengan verifikasi provider; saat ini deadline belum menyebabkan pelepasan reservasi otomatis. Hosting/webhook, merchant/kanal Sandbox dan penjadwal masih gerbang terbuka. Baca riwayat/detail order BE-11, frontend, UAT browser dan performa hosting belum dibuktikan.

## 16. Penutupan BE-08 — 23 Oktober 2026

Status: **Selesai untuk pembuatan/reuse token Snap Sandbox**, PRD tetap 1.7 (tidak ada perubahan aturan bisnis), kontrak API 0.8. Pola Basic Auth/native HTTP dan format expiry sumber LanggananKu dibaca ulang; payload diganti snapshot item/diskon/ongkir toko dengan ref SV-UUID per attempt. Tidak menyalin env/akun/sesi/data atau Plan/Subscription, tidak mengubah proyek/database LanggananKu. Tidak ada migrasi/dependensi baru.

Payment CREATED dan event disimpan sebelum satu POST provider di luar transaksi. Partial index dan lock User → Order menjaga satu attempt potensial aktif; klik bersamaan/reuse tidak mengirim ulang. Token valid menjadi PENDING internal, timeout/network/5xx/duplicate/body/URL invalid menjadi UNCONFIRMED. CREATED yang tertinggal karena proses mati atau gagal persist tetap penghalang retry. Expiry lokal tidak membuka attempt baru. Hanya penolakan request definitif yang tercatat REJECTED memungkinkan ref baru; status terminal lain tetap menunggu BE-09/BE-10. Raw error/body/Authorization tidak disimpan/log. Detail state/error/guard [PAYMENTS.md](PAYMENTS.md).

Expiry sejak order.createdAt selama 60 menit, tidak di-reset saat token dibuat. Percobaan baru dengan sisa waktu <60 detik ditahan sebagai buffer teknis; token aktif tetap sampai deadline. finish URL aplikasi memiliki halaman informasi tanpa mutasi atau kepercayaan pada query/browser. Kanal awal request bank_transfer sesuai fokus minimal VA, tanpa klaim semua bank/kanal merchant sudah aktif. Snapshot/stock/voucher/first-purchase flag tidak diubah oleh pembuatan token.

Pengguna mengisi dua key Sandbox Salvora di .env.local dan menunda konfigurasi URL webhook. Validasi dipisah: snapConfig/--snap untuk token lokal dengan URL finish localhost atau HTTPS; paymentConfig/--payment menambah kesiapan webhook HTTPS untuk BE-09. Key tidak dicetak/didokumentasikan/disalin; --snap lulus. Tidak mengisi URL webhook palsu atau mempublikasikan aplikasi pada BE-08.

Bukti: **46 tes unit/fondasi + 77 tes PostgreSQL**, lint/typecheck/build, HTTP buyer/checkout/payment guards/finish, katalog dan smoke fondasi lulus. Test double membuktikan single dispatch, token reuse, unknown, penolakan definitif, histori terminal tanpa bukti, expired lokal, kegagalan penyimpanan token, deadline, late-success race, partial index dan akses/payload/201/200/202. Tes HTTP biasa mengosongkan key merchant pada child process.

**Bukti provider nyata terpisah:** 23 Oktober 2026 03:01:32 WIB (2026-10-22T20:01:32Z), HTTP 201/token Snap Sandbox berhasil untuk order fixture salvora_kitchen_test Rp14.000. Token/URL disimpan privat, tidak dicetak. Proof aman tanpa key/token di .local/midtrans-sandbox-proof.json; fixture/attempt tetap disimpan untuk rekonsiliasi karena token mungkin masih dapat dibayar. Tidak membuka/membayar VA, memanggil simulator, menerima webhook atau menerapkan sukses. Ini membuktikan key/request token bekerja, bukan pembayaran terintegrasi atau penutupan O-06. Tidak menyentuh order/akun dev atau data pribadi. BE-09 memerlukan HTTPS publik dan verifikasi status; BE-10 scheduler/recovery/release; UI Snap lengkap/UAT masih belum tersedia.

## 17. BE-09 — Webhook dan penerapan pembayaran (23 Oktober 2026)

Backend mengikuti PRD 1.7 tanpa fitur tambahan, migrasi atau dependensi baru. Signature diverifikasi sebelum lookup pembayaran, lalu Get Status Sandbox terbaru harus cocok referensi, identitas, nominal dan currency IDR. Waktu pembayaran provider yang valid menjadi dasar tenggat, bukan kedatangan callback. Status tidak lengkap/asing atau provider tidak tersedia memberi 503 tanpa menganggap transaksi gagal.

Penerapan satu transaksi mengunci pemilik/order/produk/voucher/payment, mengonsumsi stok dan voucher, mencatat PaymentApplication unik, memperbarui pembelian pertama serta riwayat SYSTEM. Duplicate/out-of-order tidak menerapkan ulang; dua sukses, refund/reversal dan sukses sesudah reservasi lepas menjadi Perlu Penanganan tanpa pemulihan stok/voucher otomatis. Retry Snap kini menolak bukti penolakan lama jika identitas/status provider sudah terikat. Tidak membawa logika langganan atau mengubah LanggananKu.

Bukti: 50 unit/fondasi + 93 PostgreSQL lulus, lint/typecheck/build dan HTTP handler webhook dengan key tiruan lulus. HTTPS sementara khusus POST webhook berhasil menolak signature palsu 403 dan root 404. Token Sandbox nyata Rp14.000 dengan X-Override-Notification berhasil dibuat; belum memilih/membayar VA atau menerima webhook provider sukses. Pengguna meminta melanjutkan berdasarkan pengalaman proyek lain; pengalaman tersebut tidak menutup O-06/UAT Salvora. Uji VA nyata ditunda ke BE-14.

O-08 tetap terbuka untuk hosting stabil dan penjadwal BE-10. Quick Tunnel dipilih hanya untuk tes sementara dan sudah dihentikan bersama child server; tidak mengubah merchant Dashboard atau .env.local. Proof tanpa key/token serta fixture test dipertahankan privat untuk rekonsiliasi. Kontrak API menjadi v0.9. Rincian konfigurasi, pengujian dan batas kompatibilitas currency di [WEBHOOKS.md](WEBHOOKS.md).

## 18. BE-10 — Rekonsiliasi, retry dan kedaluwarsa (23 Oktober 2026)

Pengguna memilih Windows Task Scheduler lokal tiap 1 menit. Task SalvoraKitchen-PaymentReconciliation-Local dipasang dengan akun login pengguna, hak Limited dan launcher tersembunyi. Tidak menyimpan password Windows/key dalam argumen, tidak membuka HTTP cron, tidak bergantung pada browser/Next.js dev. Komputer/login pengguna, PostgreSQL dan jaringan harus tersedia. Tick otomatis 05:02:38 WIB lulus dengan LastTaskResult 0 dan jadwal berikutnya satu menit kemudian. Ini menutup O-08 untuk lokal; hosting HTTPS, volume persisten dan penjadwal server demo tetap terbuka sebelum deployment.

Rekonsiliasi POST orders/{orderId}/payments/reconcile memakai pemilik/admin+Origin, 20/akun/15 menit dan 1/order/30 detik pada jendela tetap DB. GET Sandbox server dan service penerapan BE-09 dipakai bersama, event dibedakan STATUS_API/SCHEDULER/WEBHOOK. Seluruh attempt dipastikan sebelum release; 404, timeout, pending atau unknown tidak membuktikan gagal. Retry hanya dengan bukti terminal seluruh attempt atau penolakan request definitif, order/snapshot/tenggat 60 menit tidak berubah. Deadline saja tidak membuka charge atau release. Respons Core API legacy tanpa currency diterima menurut kontrak nominal IDR resmi; currency eksplisit salah tetap ditolak.

Release atomik mengurangi cadangan saja, menyelesaikan reservasi, mengembalikan voucher milik order dan mencatat EXPIRED+riwayat sekali. Sukses sesudah release tetap NEEDS_ATTENTION tanpa pemenuhan otomatis. Worker memakai koneksi pg khusus untuk session advisory lock, antrean berjeda 60/300 detik, maksimal 25 kandidat/pass dan batas mulai order baru 50 detik. Pass tidak membuka transaksi row lock selama HTTP. Ringkasan aman .local/payment-job-last.json serta LastTaskResult menjadi bukti operasi; exit 2 berarti masih ada hasil belum pasti, bukan gagal bayar.

Bukti: 50 unit/fondasi + 108 PostgreSQL, typecheck/lint/build, HTTP reconcile, webhook dan pembeli/checkout lulus. Test DB khusus, fixture spesifik dan cleanup terarah; fixture provider BE-08/BE-09 dipertahankan. CLI dev nyata selesai pada 0 order, bukan bukti transaksi sukses. Tidak ada migrasi/dependensi/config rahasia baru; tidak mengubah LanggananKu. O-06/VA lunas tetap BE-14 sesuai arahan pengguna. Kontrak API v0.10, rincian dan panduan operasi [RECONCILIATION.md](RECONCILIATION.md). BE-11 siap dilanjutkan.

## 19. Audit terminal Windows — launcher pembayaran (23 Oktober 2026)

Audit baca-saja menemukan task resmi BE-10 masih Ready/PT1M dengan action PowerShell Hidden dan LogonType Interactive. Launcher lama kemudian membuat Node Hidden; console host induk interaktif adalah kandidat kuat kilatan. History Operational nonaktif dan process start trace ditolak akses; belum ada bukti mengaitkan setiap kilatan dengan task ini. LastTaskResult 1/proof lama dicatat sebagai kegagalan runtime belum terdiagnosis, bukan pembayaran gagal. Tidak ditemukan auto-install melalui npm dev/build/postinstall atau task proyek duplikat.

Solusi kode: launcher WindowsApplication lokal menjalankan Node langsung dengan CreateNoWindow/UseShellExecute=false, exit code tetap dan log whitelist tanpa stdout/stderr mentah. Tidak mengganti principal/privilege ke SYSTEM/S4U atau mengubah keamanan global. Interval 1 menit, backoff/lock/idempotensi dan seluruh logika pembayaran dipertahankan. Installer kini Plan/WhatIf/Update action task yang sama, backup privat, guard ownership/hash, Disable/Enable serta Rollback action. Tidak ada task/data/transaksi yang dihapus. run-payment-job.ps1 lama dipertahankan untuk rollback.

Source dan kompilasi GUI, smoke fixture inert 0/1/2, delapan skenario cmdlet mock, parser PS, lint/typecheck/50 unit, Plan serta Update -WhatIf terhadap task asli lulus. Tidak menjalankan worker pembayaran manual, tes DB, provider atau Start-ScheduledTask. Setelah pengguna menyetujui secara eksplisit, action task yang sama dimigrasikan dengan backup XML privat. Export Triggers/Principals/Settings terbukti identik; jumlah task proyek tetap satu dan PT1M. Tick otomatis normal mencatat consoleAttached=false, tetapi worker exit 1 masih sama seperti sebelum migrasi dan belum terdiagnosis. Rollback -WhatIf backup asli lulus tanpa mutasi. Tidak memicu rekonsiliasi manual. Bukti, file/perintah, status penerapan dan diagnosis tambahan di [WINDOWS-AUTOMATION-AUDIT.md](WINDOWS-AUTOMATION-AUDIT.md).

## 20. Diagnosis worker exit 1 — database lokal (23 Oktober 2026)

Bukti tick otomatis normal 11:45:37 WIB: FAILED/database_connection/CONNECTION_REFUSED pada Node 24.21.0. Probe tanpa koneksi memvalidasi konfigurasi target DEV loopback 55433 dan seluruh impor/dependensi. Windows tidak memiliki listener 55433, dan pg_ctl status pada data directory khusus workspace menyatakan no server running. PostgreSQL lain di 5432 tidak digunakan sebagai fallback. Penyebab saat ini adalah cluster proyek yang tidak berjalan; alasan berhentinya dan semua kegagalan historis belum dipastikan. Tidak menyalakan cluster, menghapus PID, mengganti URL, atau menjalankan rekonsiliasi/gateway manual.

Hipotesis awal default export env ditarik kembali: namespace dinamis berbeda, tetapi fixture impor statis lama membuktikan loader tersedia. Resolver bentuk export dan pemindahan bootstrap ke orkestrasi terproteksi merupakan penguatan diagnostik, bukan bukti env pernah menyebabkan exit 1. Worker sekarang mencatat kegagalan fase/kode whitelist sehingga tidak menyamakan startup/config/connect/lock/batch/cleanup/logging. Callback observasi lock tidak mengubah algoritme SQL/lock atau kebijakan pembayaran.

55 unit lulus (termasuk 5 pg-mock), 11 tes orkestrasi mock lulus, 8 skenario scheduler mock lulus, lint/typecheck dan node --check lulus. Tidak ada tes DB, HTTP transaksi, provider manual, task start manual, atau perubahan jadwal/status/principal/task binary/backup. consoleAttached=false berlaku hanya pada proses C# pemanggil GetConsoleWindow, bukan pengukuran konsol Node atau bukti pembayaran berhasil. Worker belum dinyatakan normal. Bukti, kode terkait, pemeriksaan aman dan langkah operasional berikutnya [PAYMENT-WORKER-DIAGNOSTICS.md](PAYMENT-WORKER-DIAGNOSTICS.md).

## 21. BE-11 — riwayat dan pemenuhan (23 Oktober 2026)

Pengguna menyetujui Selesai hanya setelah admin menerima konfirmasi melalui komunikasi manual, mengirim receiptConfirmed=true dan catatan wajib. Tidak ada penyelesaian otomatis. PRD aktif 1.8 dan kontrak API 0.11 mencatat keputusan ini; bagian penerimaan O-09 ditutup.

Kode menyediakan daftar/detail pembeli/admin, filter/pagination, pemantauan attempt, catatan internal dan transisi PROCESSING → SHIPPED → COMPLETED. Pembayaran harus SUCCESS yang telah diterapkan, sesuai nominal/currency/tenggat dan reservasi CONSUMED; attempt lain yang aktif/sukses/refund/reversal memblokir pemenuhan. Mutasi memakai urutan lock User → Order, expectedStatus dan riwayat pelaku/waktu dalam satu transaksi. Snapshot nominal/alamat/item tetap. DTO whitelist dan catatan admin privat. Tidak ada migrasi, dependensi baru, provider call atau perubahan logika pembayaran.

75 unit/fondasi (20 BE-11), lint/typecheck/build lulus. Mock service/handler tidak membuktikan lock, atomicity, rollback atau HTTP PostgreSQL nyata. Status BE-11 Ditinjau sampai pengujian terisolasi tersebut dilakukan. Pengguna menunda startup cluster 55433 sampai dampak antrean dipastikan; tidak memakai 5432, menjalankan worker manual atau mengubah task setiap menit. Worker belum pulih. Daftar verifikasi tertunda dan kontrak rinci: [ORDERS.md](ORDERS.md). O-06/VA lunas, hosting dan konten final tetap terbuka.

## 22. BE-13 — dashboard dan pemantauan voucher (23 Oktober 2026)

Pengguna mengizinkan BE-13 mendahului BE-12, sesuai dependensi task. Kontrak 0.12, PRD tetap 1.8 FR-13. Total/status/pesanan terbaru memakai periode UTC order.createdAt yang sama; seluruh status termasuk nol. Produk aktif memakai isActive, termasuk stok nol dan kategori nonaktif. Inventaris global saat ini mencakup produk nonaktif dengan penanda jelas, memakai physicalStock − reservedStock: menipis 1–5, habis 0. Daftar ringkas maksimal 10 dengan hitungan penuh; katalog admin berhalaman membuka sisanya. Tidak menambah metrik pelanggan/nilai pembayaran opsional atau laporan keuangan.

Voucher admin hanya menampilkan status tersimpan, owner whitelist, reservasi/penggunaan dan pesanan terkait. Policy tetap 20%, maksimum Rp100.000 sekali per akun. Tidak menerbitkan/reset/mengubah kelayakan, melepas reservasi lewat pembacaan atau menambah promo umum. Tiga endpoint GET khusus admin memakai no-store/Vary Cookie, transaksi baca RepeatableRead untuk dashboard dan daftar voucher. Tidak ada migrasi atau dependensi baru.

87 tes unit/fondasi (12 baru BE-13), typecheck/lint/build lulus. Status Ditinjau: mock dan inspeksi SQL bukan bukti hasil PostgreSQL, konsistensi snapshot concurrent atau HTTP database nyata. Cluster tidak dinyalakan, worker/gateway tidak dipanggil manual, Scheduled Task tidak diubah. Pengujian data aktual terisolasi tetap menunggu pemulihan yang disetujui secara terpisah. Rincian kontrak, metrik dan verifikasi tertunda: [DASHBOARD.md](DASHBOARD.md). Saat BE-13 dikerjakan, BE-11 belum ditutup dan BE-12 belum dimulai; perkembangan BE-12 ada pada bagian 23.

## 23. BE-12 — ulasan terverifikasi (23 Oktober 2026)

Pengguna menyetujui usulan PRD: rating integer 1–5, komentar 10–1.000 karakter setelah trim dan satu ulasan per item; pembelian sama pada pesanan berbeda dapat diulas lagi. O-05 ditutup dan PRD menjadi 1.9, kontrak API 0.13. Implementasi membatasi input, mengunci User → Order dan memeriksa ulang owner/status COMPLETED sebelum insert Rating. Unique constraint item BE-02 tetap dipakai, tanpa migrasi/dependensi baru atau perubahan logika pembayaran.

GET publik hanya pada produk/kategori aktif; DTO nama tampilan/rating/komentar/waktu tanpa ID akun/pesanan atau alamat. Pagination dan agregasi seluruh ulasan dalam satu snapshot RepeatableRead; katalog BE-04 tetap menghitung rating dari tabel yang sama. Hak Submit item selesai tidak hilang karena produk nonaktif; daftar publik tetap tersembunyi. Ulasan yang sah saat Submit tidak otomatis dihapus bila status kemudian berubah karena refund/reversal; tidak memperkenalkan moderasi P1. Frontend wajib merender komentar sebagai teks.

103 tes unit/fondasi (16 baru BE-12), typecheck/lint/build lulus. Mock tidak membuktikan konkurensi, rollback atau rata-rata setelah insert PostgreSQL nyata; BE-12 tetap Ditinjau bersama BE-11/BE-13. Cluster 55433 tidak dinyalakan, task tidak diubah, worker/provider tidak dijalankan manual. Rincian kontrak dan pengujian terisolasi yang tertunda: [REVIEWS.md](REVIEWS.md). Pemulihan operasional, VA lunas dan penerimaan BE-14 tetap belum ditutup.

## 24. BE-14 — verifikasi aman dan serah terima parsial (23 Oktober 2026)

103 unit/fondasi, 11 tes orkestrasi worker mock, 8 skenario penjadwal mock, lint/typecheck/build, smoke HTTP fondasi dan validasi statis Prisma lulus. Smoke diperbarui karena GET orders/admin/orders bukan lagi endpoint rencana; hanya home/health dan dispatch metode yang tidak didukung dijalankan, tanpa handler bisnis/DB/provider. Tidak mengulang tes launcher yang dapat membangun binary aktif. Rincian termasuk kegagalan awal sandbox/wrapper dan batas hasil di [BACKEND-VERIFICATION.md](BACKEND-VERIFICATION.md).

BE-14 Dikerjakan, tidak selesai. Pemetaan seluruh 39 UAT dan [FRONTEND-HANDOFF.md](FRONTEND-HANDOFF.md) tersedia. PostgreSQL/HTTP bisnis terbaru, suite DB BE-11–BE-13 dan alur hingga ulasan, migrasi DB kosong baru, backup/restore, VA lunas/webhook provider serta UI/hosting belum diterima. Startup tetap ditunda pengguna sampai dampak antrean dipastikan; tidak meminta ulang atau menyimpulkan persetujuan dari permintaan BE-14. Task tetap tiap menit, tidak ada worker/gateway manual atau perubahan data/konfigurasi pembayaran. Dokumentasi pemulihan diperjelas: helper start juga melakukan provisioning; startup minimal cluster existing memakai pg_ctl setelah verifikasi identitas dan persetujuan terpisah. Tidak ada startup yang dijalankan.

## 25. Rekonsiliasi BE-14 setelah pemulihan manual (23 Oktober 2026)

Laporan 19 tes/cakupannya diperiksa pada sumber tanpa rerun. Regresi tambahan 108 tes lulus; run pertama fingerprint mismatch dan tidak diterima retensinya. Cleanup RateLimit auth diperbaiki hanya untuk key run berikutnya, termasuk email fixture tidak terdaftar. Run ulang bersih 108, 7 kelompok HTTP Next.js/cookie hingga ulasan/admin dan 3 tahap schema migration/dump/restore mempunyai fingerprint 19 tabel cocok. Selisih run regresi pertama tidak dapat dipastikan per tabel karena runner awal hanya menyimpan hasil global; tidak ada cleanup menebak atau reset. Keterbatasan ini tetap terbuka, tidak diklaim pulih.

SQL read-only 14:17 WIB memverifikasi dev/test 55433, lima hitungan antrean dev nol dan role test tidak punya CONNECT dev. Dua tick normal 14:09/14:12 dengan task PT1M, LastTaskResult 0, launcher exit 0 dan worker COMPLETED checked=0 dikorelasikan. Tidak mengubah task/launcher/backup atau menjalankan worker dev manual. Kedua provider fixture lama tersimpan PENDING/applied=false, bukan bukti status provider terbaru; tidak ada VA lunas baru. Snap config valid, webhook HTTPS belum valid. Tidak ditemukan artefak tindak lanjut bernama “gas tuntaskan” selain bukti yang disebut.

BE-11–BE-13 Selesai backend berdasarkan gabungan PostgreSQL/HTTP/regresi; BE-14 tetap Dikerjakan. Rencana persetujuan terpisah untuk database sementara baru dan satu transaksi Sandbox Rp14.000 (proof unik, HTTPS process-only, interaksi VA pengguna) ada pada [BE14-RECONCILIATION.md](BE14-RECONCILIATION.md). Schema rehearsal bukan database kosong baru; penerimaan provider/produk/deployment tidak digabung dengan penyelesaian fitur backend.

## 26. Penutupan provider dan BE-14 backend (24 Oktober 2026)

Setelah restart pengguna memulai cluster dan development server; SQL/antrean nol serta tick kosong pulih. Run 23 Oktober telah lewat tenggat tanpa application. Pengguna memberi izin baru untuk tepat satu transaksi Sandbox Rp14.000 dan menyelesaikan simulator. Run UUID baru 24 Oktober diverifikasi 13:53 WIB: GET Status Midtrans nyata settlement/bank_transfer/bni, ID/reference/nominal cocok, paid sebelum deadline, Payment SUCCESS/Order PROCESSING, tepat satu application/transisi PROCESSING/event webhook VERIFIED SUCCESS, stok 0/reservasi CONSUMED/voucher USED/firstPurchase=false. Dua HTTP 200 lifecycle tidak dianggap dua callback settlement identik. Tidak membuat charge/rekonsiliasi tambahan atau memanggil referensi lama.

O-06 ditutup dan BE-14 Selesai untuk backend berdasarkan gabungan bukti PostgreSQL/HTTP/regresi/fresh DB migration-seed-restore/provider, bukan token/redirect. Catatan mismatch retensi run regresi pertama tetap dipertahankan dengan ketidakpastian retrospektifnya; cleanup harness diperbaiki dan run bersih diterima tanpa mengklaim baseline awal dipulihkan atau mereset test. Produk/UI/Figma/deployment tetap belum diterima. Pertimbangan dan checklist penerimaan pada bagian akhir BE14-RECONCILIATION.

Server/tunnel uji milik run ditutup setelah identitas/waktu/parent PID diverifikasi karena stdin sesi tertutup; proof menyimpan stopMethod dan hasil terverifikasi. Aplikasi dev tetap HTTP 200, worker dev 13:55 COMPLETED checked=0, task/dev/.env/backup/rollback tidak diubah dan fixture provider tetap. HTTPS permanen, volume foto/job server serta restore foto belum dipilih/diterima untuk deployment. Lint/syntax verifier baru lulus; tidak mengulang suite mahal atau build tanpa perubahan kode bisnis.
