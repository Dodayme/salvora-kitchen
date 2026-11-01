# FE-08 — Layout admin dan dashboard operasional

25 Oktober 2026. PRD 1.9 FR-13/bagian 24, kontrak API 0.13, [DASHBOARD](DASHBOARD.md), [audit desain](FE-DESIGN-AUDIT.md).

**Status: Ditinjau.** Implementasi, unit/controller dan HTTP/PostgreSQL test lulus. Browser 360/768/1440px, drawer, logout, fokus/keyboard dan perbandingan render belum dilakukan; tidak ditandai Selesai. Gap browser/provider FE-05–FE-07 tetap terbuka. FE-09 dapat mulai tanpa mengubah status penerimaan tersebut.

## Implementasi

| Bagian | Perilaku |
|---|---|
| `/admin` | Dashboard operasional khusus ADMIN, menggantikan kartu profil sementara. Sesi dan API tetap otoritas akses |
| Layout | Sidebar desktop dan Sheet kiri pada layar kecil, skip link, header nama admin dari sesi, akun dan logout FE-02. Menu P0: Dashboard, Produk, Kategori, Pesanan, Pembayaran, Voucher Pembeli Baru, Akun Saya, Keluar |
| Modul belum ada | Produk/Kategori/Pesanan/Pembayaran/Voucher diberi label **Belum tersedia**, bukan link 404 atau kontrol CRUD palsu. Diaktifkan saat FE-09–FE-11 mengimplementasikan route masing-masing |
| `/admin/akun` | Memindahkan tampilan profil sesi readonly yang sebelumnya berada di `/admin`. Nama/email/peran dari sesi yang sudah terkonfirmasi; tidak ada edit profil baru. GET/PATCH profil khusus tetap FE-11 |
| Periode | Tanggal awal/akhir WIB inklusif pada form. Request UTC from inklusif/to eksklusif, sampai sebelum tengah malam hari setelah tanggal akhir. Default hari ini WIB dari jam perangkat, **ditampilkan jelas**, bukan filter API tersembunyi |
| Metrik periode | Total pesanan, seluruh enam status termasuk nol, cuplikan latestOrders pada rentang createdAt yang sama. Bukan paidAt/perubahan status/laporan keuangan |
| Inventaris | Bagian terpisah: produk aktif saat ini, termasuk stok nol dan kategori nonaktif; stok global semua produk termasuk nonaktif. Tersedia = fisik − direservasi; menipis 1–5, habis 0 |
| Daftar stok | Nama, aktif/nonaktif, demo, fisik/reservasi/tersedia. Hitungan penuh dipisahkan dari cuplikan maksimal 10; tidak menampilkan angka sebagai harga Rupiah |
| Pesanan terbaru | Nomor, waktu WIB, snapshot ringkasan item, jumlah unit, total, status order/payment dan kanal dari server. Maksimal 10, tidak diklaim sebagai daftar lengkap atau ranking |
| State | Loading/error/retry/kosong/zero asli. Ganti periode menyembunyikan data lama; respons terlambat diabaikan. Draft tanggal invalid tidak mengubah label/rentang data yang sedang ditampilkan |

Tidak ada revenue/laba/pelanggan opsional, grafik dummy, ranking terlaris, promo umum, toggle pembayaran atau pengaturan generik. API dashboard hanya GET; tidak ada gateway, mutasi transaksi, reset voucher atau perubahan status pesanan dari task ini.

## Tanggal dan data privat

`todayWib` memakai Intl Asia/Jakarta. Form mengubah hari WIB UTC+07 menjadi UTC: pilihan 25 Oktober 2026 → from `2026-10-24T17:00:00.000Z`, to `2026-10-25T17:00:00.000Z`. Hari tunggal diperbolehkan. Tanggal kosong/tidak mungkin/terbalik ditolak sebelum request. Rentang yang sedang ditampilkan disebut terpisah dari draft form; user dapat mengganti default bila jam perangkat salah.

Decoder memeriksa period respons cocok dengan request, seluruh status unik/lengkap dan totalnya konsisten; stock scope/threshold/list limit sesuai kontrak; stok fisik/reservasi/tersedia konsisten dan baris berada pada kelompoknya. Field yang tidak diperlukan dibuang. Tidak mengganti nilai yang hilang dengan nol atau menghitung inventaris global dari sepuluh baris.

Controller membatalkan/menandai superseded GET lama dan memeriksa akun/role lagi sebelum menerapkan hasil. Unmount/logout/perubahan role menyembunyikan data dan membatalkan pembacaan. Strict-effect remount dapat mengulang GET aman dan tidak meninggalkan loading yang macet. Tidak menyimpan metrik/periode/sesi di localStorage. UI gate bukan pengganti otorisasi API; document terlindungi dapat HTTP 200 dengan gate.

## Sumber visual

`.Desain/Dashbord - Admin.png` dibaca sebagai referensi sidebar/header, latar krem-peach, kartu putih dengan bayangan, judul serif dan navigasi oranye. Source PNG tidak dijadikan gambar UI. Nilai contoh 25/250/50/pendapatan, grafik dan ranking tidak diimplementasikan karena di luar DTO minimum/PRD. Logo individual tetap belum tersedia; dipakai wordmark teks yang sudah ada, bukan klaim logo final. Tidak mencoba ulang kuota Figma atau mengklaim render identik Figma.

## Berkas berubah

- `src/lib/admin-client/dashboard-model.ts`: DTO whitelist/invariant, hari WIB dan path UTC.
- `src/lib/admin-client/dashboard-controller.ts`: default/periode eksplisit, GET terbaru, retry/error/invalid dan lifecycle.
- `src/components/admin/admin-shell.tsx`, `dashboard-screen.tsx`: layout/nav/drawer dan dashboard.
- `src/app/admin/layout.tsx`, `page.tsx`, `akun/page.tsx`: gate, dashboard dan profil readonly yang dipindahkan.
- `src/components/auth/account-menu.tsx`: opsi menyembunyikan link akun yang duplikat di sidebar; mekanisme logout sama. `account-summary.tsx`: judul opsional untuk pemindahan profil.
- `tests/admin-dashboard-client.test.ts`: 24 tes baru.
- `scripts/dashboard-client-fixtures.mjs`, `scripts/verify-checkout-ui-http.mjs`: mode `--dashboard-client` dan persiapan `--dashboard-ui`, namespace fixture/result FE-08.
- `scripts/verify-auth-ui.mjs`: harness auth lama mengizinkan GET dashboard readonly pada test DB karena entry admin kini membacanya; mock mode memberi 503 tanpa metrik palsu. Proxy UI mode lain juga memberi 503 pada dashboard di luar cakupannya, bukan memicu siklus revalidasi sesi dari 403 fixture saat akun admin tetap sah.

Service/API backend, schema/migrasi, PRD, konfigurasi, `.env`, dependency, task Windows dan database dev tidak diubah. Tidak menyalakan cluster, mengubah port, membuat role/database baru, menjalankan worker/reconcile manual atau menghubungi provider.

## Pemeriksaan aktual

| Pemeriksaan | Hasil/batas |
|---|---|
| `npm.cmd test` | **21 file / 359 tes lulus**, 24 baru. Hari WIB, midnight/leap/month rollover, invalid range, query UTC; zero/count/scope/inactive/reservasi; period mismatch, stale response meskipun abort diabaikan, invalid draft, retry, auth/dispose dan strict-remount |
| `npm.cmd run lint` | Lulus |
| `npm.cmd run typecheck` | Lulus |
| `npm.cmd run build` | Lulus, `/admin` dan `/admin/akun` tercantum; bukan bukti browser |
| `npm.cmd run check:client` | PASS: **62 source files / 35 browser artifacts / empat nilai privat** diperiksa tanpa dicetak |
| `node --import tsx scripts/verify-checkout-ui-http.mjs --dashboard-client` | **PASS empat kelompok** pada controller frontend + HTTP Next + PostgreSQL test: tiga regresi checkout harness dan kelompok dashboard baru |
| `--dashboard-ui` | Baru disiapkan/diperiksa sintaks, **belum dijalankan**. Bukan bukti browser/drawer/keyboard/logout |

### Cakupan HTTP/SQL

1. Memastikan periode fixture 15 April 2094 WIB tidak memiliki order existing sebelum membuat data. Lima order sintetis pada from, from+1ms, to−1ms, tepat to dan from−1ms. Dashboard menghitung **3**, batas from masuk/to tidak masuk; semua enam status hadir dengan 1/1/1 dan nol status lain. LatestOrders sama periode dan total.
2. Periode kosong 1 Januari 2095 menghasilkan orderCount=0/status nol/latest kosong, sementara activeProductCount, lowStockCount dan cuplikan inventaris sama dengan pembacaan sebelumnya. Tidak mengarang zero untuk gangguan jaringan.
3. Enam belas produk fixture dengan stok fisik/reservasi menghasilkan tersedia 1/5/0, termasuk nonaktif, stok nol, reservasi penuh dan kategori nonaktif. Hitungan global dicocokkan ke SQL independen terhadap **seluruh produk test**, bukan hanya fixture. lowStockCount>10, baris tetap 10, isi/urutan lowStockProducts cocok SQL dan memuat produk nonaktif. Produk aktif kategori nonaktif tetap masuk activeProductCount.
4. Tanpa cookie → 401, BUYER → 403, ADMIN → data. Sesi admin fixture dicabut → controller error 401 tanpa report lama. Produk/order fixture sebelum–sesudah GET sama; pembacaan tidak mengubah data tersebut.

Order dan counter stok baru adalah **fixture sintetis**, bukan pembayaran, penerimaan manual, atau proses reservasi stok baru yang dibuktikan. Gateway mock/provider tidak diperlukan/dipanggil. Bukti backend BE-13/BE-14 tetap terpisah.

## Isolasi dan cleanup

URL loopback 55433 dan identitas SQL `salvora_kitchen_test` diverifikasi sebelum fixture ditulis. Namespace `fe08-<UUID>`; auth secret baru, DATABASE_URL child kosong, kedua key pembayaran kosong. Mode dashboard hanya menambah jalur auth login dan GET dashboard pada transport yang terkontrol; tidak membuka payments/reconcile/provider. Akun admin baru khusus run, bukan akun dev/pengguna.

Cleanup hanya email/ID run, termasuk produk stok yang ID-nya dicatat sebelum create. Menolak jika ada Payment/bukti provider pada order fixture. **15 fingerprint cocok**, sisa user fixture nol: User, Session, Address, Category, Product, Cart, CartItem, Discount, CheckoutQuote, Order, OrderItem, StockReservation, OrderStatusHistory, Payment, Rating. Rate-limit dibersihkan hanya key secret/email/window run. Tidak reset test, mengubah fixture provider lama atau memakai 5432/LanggananKu.

Artefak tersanitasi `.local/fe08/http-result.json`: PASS, cleanupPass=true, browserTested=false, providerCalls=0. Server test telah dihentikan; server development pengguna tetap aktif. Metadata/screenshot dari desain bukan bukti render aplikasi.

## Gap dan langkah browser

```powershell
node --import tsx scripts/verify-checkout-ui-http.mjs --dashboard-ui
```

Perlu build dan cluster test yang sudah hidup. Mode ini menjalankan fixture/API test lalu menunggu `UI_READY`; **belum diuji runtime UI pada FE-08**. Buka origin sementara pada `/admin`; proxy memasang cookie admin fixture. Ini menguji UI dashboard, bukan penerimaan cookie/login browser.

1. Default hari ini WIB terlihat pada form. Pilih kedua tanggal 15 April 2094 seperti `fixtureDates` pada output UI_READY. Periksa orderCount 3, semua status, tiga latest order, dan batas periode WIB yang benar.
2. Pilih periode kosong 1 Januari 2095: metrik pesanan nol, inventaris global tetap sama. Uji tanggal invalid/terbalik, loading/error/retry dan pergantian periode tanpa data lama muncul sebagai periode baru.
3. Periksa 360/768/1440px, sidebar/drawer, navigasi aktif Dashboard/Akun Saya, menu belum tersedia, Tab/fokus/skip link, nama panjang, stok tanpa Rp serta label aktif/nonaktif/demo/menipis/habis. Daftar max10 berbeda dari hitungan penuh.
4. Ubah `.local/fe08/ui-control.json` scope menjadi buyer/anonymous/admin lalu refresh untuk pemeriksaan sesi/gate. Jangan menganggap perubahan cookie proxy tanpa refresh sebagai perubahan sesi browser yang sudah terkonfirmasi. Uji logout terakhir; tombol memakai logout backend fixture yang sesinya benar-benar dicabut.
5. Simpan bukti visual aman. Tulis `{"stop":true}` pada control file untuk menutup harness. Checkpoint hanya memastikan GET periode fixture sudah terjadi, bukan seluruh penerimaan visual. Cleanup harus PASS. Bila browser tidak dapat dipakai, tutup juga; checkpoint FAILED dengan cleanup PASS tidak diklaim berhasil.

FE-08 baru Selesai setelah browser/role/state/responsif terbukti. Produk/kategori lengkap berikutnya FE-09; pesanan/pembayaran admin FE-10; voucher/profil edit FE-11. Navigasi baru diaktifkan sesuai implementasi masing-masing. Penerimaan seluruh produk/Figma/deployment tetap FE-12 dan pekerjaan deployment terpisah.
