# FE-03 — Beranda, kategori, katalog dan detail produk

24 Oktober 2026. PRD 1.9 FR-02/bagian 7/24; kontrak API 0.13. **Selesai untuk fungsi FE-03**, dengan gap aset/visual yang dinyatakan di bawah. Tidak mengubah service backend, schema, kontrak, `.env`, database dev, pembayaran atau task Windows.

## Hasil implementasi

| Bagian | Perilaku |
|---|---|
| `/` | Hero lokal, ketentuan voucher pembeli baru, kategori dari API, pilihan katalog tanpa ranking terlaris, tentang toko dan informasi delivery manual tetap |
| `/menu` | Publik tanpa login; kategori aktif dan produk dari server, filter categoryId/page pada URL, 9 produk per halaman. Daftar kategori memiliki pagination terpisah jika lebih dari 8 kategori. Tidak membuat pencarian/sort lanjutan |
| `/menu/[productId]` | Foto/fallback, nama/deskripsi, harga Rupiah integer, kategori, stok tersedia, demo label, jumlah, akses tambah keranjang dan ulasan publik |
| Header | Beranda/Menu/Tentang kami serta menu akun FE-02; drawer hingga breakpoint lg. Tidak menautkan keranjang penuh/checkout yang belum diimplementasikan |
| State | Loading, kosong/filter kosong, halaman di luar hasil, query invalid, produk nonaktif/404, error/retry dan konflik. Request lama dibatalkan/diabaikan; data daftar lama tidak ditampilkan sebagai hasil filter baru |

Source UI: `src/components/catalog/*`, `src/lib/catalog-client/model.ts`, route beranda/menu/detail dan PublicShell. Decoder Zod browser memvalidasi/menyaring DTO produk/kategori/ulasan/cart; tidak mengimpor Prisma/config/validasi Buffer server. Tidak merender nama, deskripsi atau komentar sebagai HTML.

Semua nama/harga/stok/status/demo/ulasan berasal dari endpoint yang tersedia. ProductCard menggunakan aggregate pada DTO produk; bagian ulasan menggunakan **meta.ratingSummary** dari server, tidak menghitung average dari baris halaman. Null foto/rating tidak diganti dengan foto/angka contoh. API pagination tetap menjadi sumber total; page di luar hasil tidak diam-diam digeser, tersedia tindakan kembali ke halaman pertama.

## Tambah keranjang dan batas FE-04

- Tamu diarahkan login dengan returnTo detail internal yang tervalidasi; setelah login/registrasi kembali ke detail **tanpa auto-add**.
- Hanya BUYER bersesi terkonfirmasi dapat menambah; ADMIN melihat aksi nonaktif. Principal diperiksa lagi dari store saat klik, sementara otorisasi sebenarnya tetap pada API backend.
- Jumlah integer positif dibatasi stok terakhir untuk UX; server memeriksa stok/harga aktual dan jumlah kumulatif keranjang. Payload hanya productId/quantity, tidak mengirim harga/userId/role.
- Pending mengunci klik ganda. Tidak ada POST pada effect, polling, pergantian filter atau login. Keranjang tidak mereservasi stok/harga.
- 409 meminta muat ulang produk dan mengunci penambahan sampai snapshot dimuat ulang; tidak mengulang mutasi otomatis.
- Network/protocol/5xx memberi keadaan **belum pasti** dan mengunci add. Pengguna dapat melakukan GET `/api/cart` untuk melihat jumlah produk saat ini sebelum memutuskan menambah lagi. Pembacaan itu tidak mengklaim operasi sebelumnya pasti gagal/berhasil. 429/Retry-After menahan aksi sesuai jeda.
- Feedback terkait owner sesi; hasil akun lama tidak ditampilkan setelah akun berubah. 401/403 mengikuti useAccountRequest FE-02.

Pemeriksaan jumlah keranjang adalah pemulihan terbatas untuk aksi FE-03. Halaman `/keranjang`, pengubahan/penghapusan item, badge total, alamat dan informasi voucher akun tetap **FE-04**; quote/checkout/payment belum dibuat oleh FE-03. Pembatalan/refresh browser dapat menghilangkan feedback in-memory; ini bukan jaminan idempotensi lintas reload untuk endpoint add yang bersifat menambah jumlah.

## Aset, visual dan konten

| Sumber | Pemakaian/batas |
|---|---|
| `.Desain/Assets/Hero Page.png` | Disalin tanpa perubahan ke `public/images/salvora-hero.png`, 1440×552, 1.200.872 byte. SHA-256 kedua file sama: `81D9118418B49EBFB90189DDF44D643887D14A6ACF5B4A1B30A58B763DC496DB`. Slot hero beranda/menu, bukan foto produk |
| Hero browser | Next/Image width/height eksplisit, preload/sizes. Desktop terukur sekitar 1424,8×546,16 (rasio asli); mobile mempertahankan rasio foto dengan teks di bawah pada bidang cokelat, bukan memotong makanan menjadi gambar lain |
| Foto produk | imageUrl API; Next/Image unoptimized untuk URL dinamis agar optimizer server tidak mengambil origin arbitrer. URL HTTPS/relative publik divalidasi, credential URL/protokol lain/API privat ditolak; no-referrer. Null/gagal memuat memakai fallback bernama jelas |
| Figma/PNG | Tema/font/hero mengikuti audit FE-00 dan ekspor beranda/menu. Tidak mencoba ulang kuota Figma, memakai URL MCP sementara atau menganggap screenshot satu halaman sebagai UI |
| Belum tersedia | Logo, cutout kategori, foto about dan gambar banner terpisah. Kategori menjadi kartu teks, about/bannernya memakai komposisi teks sementara. Bukan klaim visual identik Figma; export aset dan penerimaan visual masih terbuka untuk penyempurnaan FE-03/FE-12 |

Banner menyebut 20% pembeli baru, maksimal Rp100.000, sekali pakai, tidak termasuk ongkir; tidak membuat promo umum/minimum belanja baru. “Pilihan kami” adalah cuplikan katalog, bukan statistik paling banyak dipesan. Informasi delivery mengikuti keputusan tetap Kota Tanjungpinang, Kepulauan Riau, Rp10.000/pesanan. Teks cerita toko masih copy awal dan belum menjadi penerimaan konten final pemilik.

Nomor kontak/alamat/jam resmi belum tersedia: tidak menerbitkan nomor contoh screenshot, form kontak palsu, testimonial kurasi, CMS atau klaim pengiriman cepat/kualitas yang belum dikonfirmasi. Form ulasan tetap FE-07.

## Pemeriksaan aktual

| Lapisan | Hasil |
|---|---|
| Unit in-memory | **35 tes baru**: query invalid/duplikat/halaman, deep link, jumlah/stok, URL foto/protokol/credentials, DTO harga/rating/status, null/demo, author whitelist, teks komentar dan cart kosong |
| Regresi | `npm.cmd test`: **16 file / 218 lulus**. Suite PostgreSQL BE lengkap tidak diulang; tidak ada tes provider |
| Statis | Lint/typecheck/build lulus. `check:client` lulus pada 40 file grafik sumber/25 artefak browser; 4 nilai privat dicocokkan tanpa dicetak, tidak ditemukan impor/marker/nilai yang diperiksa |
| Database | Probe read-only memverifikasi salvora_kitchen_test, PostgreSQL 18.6, 55433. Cluster sudah hidup; agent tidak menjalankan pg_ctl/initdb/reset/migrasi atau memakai 5432 |
| Browser + API Next/PostgreSQL nyata, run pertama | Katalog publik, kategori 11 produk aktif → 9+2 pada pagination; kategori kosong; inactive product 404; broken photo fallback; tamu→login/register→detail; add 2 unit; GET cart; konflik stok 409/reload; admin purchase disabled; page 999 tetap kosong tanpa clamp; retry setelah error terkendali |
| Bukan provider nyata | Respons cart sukses sengaja ditahan oleh harness dan diganti 503 **setelah backend commit**. UI mengunci add, GET membaca 3 unit tanpa replay. Produk tetap physicalStock=8/reservedStock=0. Perubahan stok fixture ke 1 membuat POST berikutnya 409, cart tetap 3 dan reserved=0. Semua orderCount fixture 0 |
| Overlay mock terpisah | Dua baris review rating 5/1 dengan meta aggregate 4,6 dan 10 ulasan. Browser menampilkan 4,6/10, bukan average halaman 3; komentar `<script>` muncul literal dan tidak menjadi node script. Satu 503 katalog mensimulasikan kegagalan baca; tidak digabung sebagai keberhasilan endpoint nyata untuk skenario itu |
| Retest | Run kedua mengonfirmasi wrap kategori panjang 360px, katalog 768px, detail/home 360px tanpa overflow; tombol setelah 409 benar-benar disabled sampai reload. Hero/desktop 1440px diperiksa pada run pertama |
| Cleanup kedua run | Exit 0, nol user fixture tersisa, baseline fingerprint **Category/Product/Order/Payment/Rating** cocok sebelum fixture katalog dan sesudah cleanup per run. Fixture provider lama tidak dihapus/diubah oleh cleanup. Bukan klaim fingerprint seluruh tabel database |

SQL read-only pada run pertama mencatat: add 2 → cartQuantity 2/physicalStock 8/reservedStock 0; respons hilang +1 → cartQuantity 3/physicalStock 8/reservedStock 0; setelah kontrol stock-low dan konflik → cartQuantity 3/physicalStock 1/reservedStock 0. Dua commit cart tersebut hanya fixture test. Tidak ada order/payment/review DB baru.

Run pertama mencatat GET products 200×9/categories 200×5/session 200×22; detail fixture 200×6 dan inactive 404×1; reviews nyata 200×4; register 201×1/login 200×1/logout 200×1; cart items respons 201×1/503 overlay×1/409×1 dan GET cart 200×1. MockCalls=3 (dua ulasan, satu error daftar), lostCommittedResponses=1. Run kedua terbatas pada layout/konflik: register 201×1, cart add 409×1, logout 200×1; tanpa commit cart sukses tambahan.

Temuan dan perbaikan: kategori panjang awalnya membuat overflow 360px; chip diberi batas lebar dan wrapping, kartu kategori/nama juga dapat membungkus teks. Retest tidak melebar. Konflik stok mengunci add sampai reload. Metadata kontrol harness semula menampilkan unknown untuk perintah katalog yang telah diterapkan; daftar kontrol diperbaiki, retest mencatat stock-low dengan nama yang benar.

Artefak tersanitasi di `.local/fe03`: `cart-proof.json`, `cleanup-functional.json` (run pertama), `cleanup-result.json` (retest), `functional-results.json`; screenshot `home-1440.jpg`, `home-360.jpg`, `catalog-360.jpg`, `catalog-768.jpg`, `detail-360.jpg`. `catalog-360-before-fix.jpg` dipertahankan sebagai bukti temuan, bukan hasil lulus. File private fixture terpisah, tidak dicetak/publik. Browser otomatis sempat sangat lambat pada pembukaan origin baru; bukan benchmark waktu muat aplikasi.

## Menjalankan dan serah terima

```powershell
npm.cmd run dev
# http://localhost:3000/ dan /menu
npm.cmd test
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
npm.cmd run check:client
```

Origin login tetap harus cocok dengan NEXT_PUBLIC_APP_URL; tidak ada perubahan .env. Fixture browser opt-in memakai `node --import tsx scripts/verify-auth-ui.mjs --test-db --catalog` setelah build, hanya database test existing terverifikasi. Kredensial baru berada pada file private yang ditunjuk `.local/fe03/current.json`; jangan cetak/kirim nilainya. Tidak menjalankan dua harness bersamaan. Kontrol hanya melalui file run lokal:

```powershell
node --import tsx scripts/verify-auth-ui.mjs --catalog --control stock-low
node --import tsx scripts/verify-auth-ui.mjs --catalog --control reviews-mock
node --import tsx scripts/verify-auth-ui.mjs --catalog --control catalog-error
node --import tsx scripts/verify-auth-ui.mjs --catalog --control catalog-recover
node --import tsx scripts/verify-auth-ui.mjs --catalog --control cart-response-lost
node --import tsx scripts/verify-auth-ui.mjs --catalog --control stop
```

QUEUED bukan bukti kontrol selesai; tunggu CONTROLLED. Stop membersihkan hanya akun/cart/voucher/category/product milik run; cleanup menolak jika fixture memperoleh referensi order, dan memeriksa fingerprint. API selain auth/katalog/cart ditolak proxy uji, key Midtrans child dikosongkan; tidak ada worker manual/task Windows/tunnel/checkout/provider call. Gunakan stop untuk cleanup, bukan mengandalkan Ctrl+C pada exec non-TTY.

**FE-04 siap** untuk halaman keranjang, alamat dan informasi voucher. Fungsi FE-03 tidak menutup gap aset final, konten resmi, UAT visual seluruh produk, semua perangkat/browser, SEO detail produk yang masih dibaca client, atau kesiapan deployment.
