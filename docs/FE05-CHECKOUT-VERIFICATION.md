# FE-05 — Quote dan konfirmasi checkout idempoten

Pembaruan FE-12, 25 Oktober 2026: recovery checkout browser sesudah reload kini PASS, dengan 15 fingerprint cleanup cocok. Bug fokus sesi diperbaiki; hasil checkout smoke pada 360/768/1440. Seluruh state/keyboard/responsif belum lengkap, status tetap Ditinjau. [Bukti terbaru](FE-VERIFICATION.md); bagian di bawah mempertahankan hasil tahap FE-05 sebelumnya.

25 Oktober 2026. Acuan PRD 1.9 FR-06, [kontrak API 0.13](API-CONTRACT.md), [checkout backend](CHECKOUT.md), dan [hasil FE-04](FE04-BUYER-VERIFICATION.md).

**Status: Ditinjau.** Implementasi, unit/controller dan integrasi HTTP/PostgreSQL test lulus. Interaksi browser checkout, fokus/keyboard dan responsif belum terbukti: browser DOM tidak terhubung dan persetujuan kontrol Chrome melalui computer-use habis waktu. **Belum Selesai.** Penerimaan backend sebelumnya tetap berlaku; provider/pembayaran UI adalah FE-06.

## Implementasi

| Bagian | Hasil |
|---|---|
| `/checkout` | Gate BUYER, pilih alamat milik sendiri dari GET addresses, pagination enam per halaman, tautan kelola alamat/keranjang |
| Quote | Tindakan eksplisit POST `/api/checkout/quote` dengan hanya `{addressId}`. Snapshot alamat/item/harga, diskon, ongkir, total, label delivery dan warnings berasal dari server |
| Persetujuan | Checkbox tidak dicentang otomatis. Quote baru meremount form dan menghapus persetujuan sebelumnya. Quote lima menit belum mereservasi stok/voucher |
| Expiry | Tenggat WIB; indikator jam lokal mematikan konfirmasi quote yang sudah lewat, server tetap otoritas. Tidak ada perubahan status/API otomatis karena timer |
| Konfirmasi | Simpan referensi pemulihan dahulu, lalu POST `/api/orders` dengan hanya `{quoteId}` dan `Idempotency-Key`. Lock sinkron menahan klik bersamaan. Tidak melakukan pembayaran |
| Belum pasti | Network/protocol/5xx mempertahankan input/key. Quote pengganti diblokir. Retry eksplisit memakai input/key sama, termasuk setelah quote kedaluwarsa |
| Perubahan definitif | CHECKOUT_CHANGED/QUOTE_EXPIRED/INSUFFICIENT_STOCK/PRODUCT_UNAVAILABLE/CART_EMPTY/NOT_FOUND/DELIVERY_UNAVAILABLE meminta quote/pemeriksaan baru. Tidak mengambil quote atau menyetujui total secara otomatis |
| Konflik referensi | IDEMPOTENCY_CONFLICT/QUOTE_ALREADY_USED menahan konfirmasi pengganti dan mempertahankan referensi. Tidak mengganti key untuk menutupi konflik |
| Retry-After | Controller memeriksa tenggat lagi saat klik; timer hanya memperbarui tampilan |
| Hasil | Nomor/status/deadline serta rincian order dari respons server. Reload hasil yang sudah diketahui memakai GET order; bukan POST baru. Badge cart diinvalidasi setelah hasil diketahui |
| Navigasi | Tautan checkout dari keranjang yang telah dibaca dan berisi item. Checkout baru hanya ditawarkan setelah hasil sebelumnya diketahui |

Delivery tetap server: Kota Tanjungpinang, Kepulauan Riau, Rp10.000 per pesanan. Alamat luar wilayah boleh tersimpan tetapi quote ditolak DELIVERY_UNAVAILABLE. Browser tidak menghitung otoritas diskon/total. Decoder memvalidasi/menyaring DTO; nama/alamat/warnings dirender sebagai teks React.

## Pemulihan tab dan sesi

`sessionStorage`, key `salvora-checkout-recovery-v1`, berisi versi, ID pemilik, quoteId, idempotency key acak dan orderId opsional. Tidak menyimpan snapshot alamat/item/harga, nominal, cookie, token sesi, Snap token, redirect provider atau kredensial. Idempotency key adalah referensi deduplikasi, bukan autentikasi; API tetap memerlukan sesi pemilik.

- Record disimpan **sebelum POST pertama**. Storage gagal → tidak mengirim konfirmasi baru.
- Hydrate tidak mengirim request otomatis. Pending ditampilkan tanpa nominal lama; pengguna memilih pemeriksaan konfirmasi sama.
- Jika penulisan hasil sukses gagal, record pending sebelumnya tetap aman direplay.
- Pemilik berbeda membuang record lama. Record rusak/field tambahan diblokir, tidak ditebak/diganti key baru.
- Notifikasi auth lokal/antar-tab dan anonymous/401 menghapus recovery. Refresh sesi biasa mempertahankan konteks akun sama. Hasil tidak diterapkan setelah unmount/akun tidak lagi terotorisasi.
- Logout sengaja menghapus referensi tab; ini **bukan pembatalan pesanan**. Pemeriksaan setelah login ulang tanpa referensi mengikuti riwayat FE-07.
- Tidak ada referensi recovery pada URL/log/analytics/localStorage. Tidak ada auto-submit dari effect, timer, reload, pemilihan alamat atau perubahan sesi.

## Berkas

- `src/lib/checkout-client/model.ts`: decoder quote/order dan record pemulihan minimal.
- `src/lib/checkout-client/recovery.ts`: storage, validasi/isolasi pemilik dan penghapusan saat auth berubah.
- `src/lib/checkout-client/controller.ts`: lock/persetujuan/konfirmasi/replay/expiry/konflik/hasil.
- `src/components/checkout/checkout-screen.tsx`, `src/app/checkout/page.tsx`: pilihan alamat, review, rincian biaya, pemulihan dan hasil sementara sebelum pembayaran.
- `src/components/auth/session-provider.tsx`: pembersihan recovery pada auth berubah, termasuk tanpa BroadcastChannel.
- `src/components/buyer/cart-screen.tsx`: tautan checkout.
- `tests/checkout-client.test.ts`: 21 tes risiko recovery/konkurensi/isolasi/data.
- `scripts/verify-checkout-ui-http.mjs`: controller frontend produksi diuji melalui Next HTTP/SQL nyata; mode UI opsional terpisah.

Tidak mengubah service/API backend, PRD, schema/migrasi, konfigurasi, dependensi atau task Windows. Penulisan hanya fixture baru pada database test terverifikasi. Tidak menjalankan worker/reconcile manual, pembayaran atau provider baru, dan tidak menulis data dev.

## Pemeriksaan aktual

| Pemeriksaan | Hasil/batas |
|---|---|
| `npm.cmd test` | **18 file / 266 tes lulus**, 21 baru FE-05. Persistence sebelum POST, double submit, respons hilang/reload/expiry/key sama, explicit acceptance, cooldown, owner/corrupt storage, storage gagal, disposal, GET hasil dan DTO whitelist diuji in-memory |
| `npm.cmd run lint` | Lulus pada kode final |
| `npm.cmd run typecheck` | Lulus. Percobaan bersamaan build sempat membaca generated AppRoutes/ParamMap lama untuk route baru; penutup setelah build exit 0 |
| `npm.cmd run build` | Lulus, `/checkout` tercantum; bukan bukti interaksi browser/pembayaran |
| `npm.cmd run check:client` | PASS: 50 source files, 31 browser artifacts, empat nilai privat diperiksa tanpa dicetak. Grafik impor FE dan `.next/static`, bukan seluruh artefak server |
| `node --import tsx scripts/verify-checkout-ui-http.mjs` | **PASS, tiga kelompok** controller frontend + HTTP Next + PostgreSQL `salvora_kitchen_test:55433`. Bukan mock database atau tes browser/DOM |
| `--ui` | **Checkpoint browser belum lulus.** DOM connector tidak ada; izin kontrol Chrome timeout sebelum klik/navigasi. Tiga kelompok HTTP pada run ini tetap lulus, cleanup PASS, hasil checkpoint FAILED dipertahankan |

Loader tsx percobaan awal ditolak sandbox spawn EPERM; pengulangan berizin dipakai untuk server/SQL test. Percobaan integrasi awal gagal pada **setup fixture expiry**: expiresAt diubah ke epoch tetapi createdAt tetap baru, bertentangan dengan `CheckoutQuote_valid_hash_expiry` di `prisma/migrations/202610230001_init/migration.sql:497`. Fixture diperbaiki dengan dua timestamp lampau yang tetap `expiresAt > createdAt`; constraint/database aplikasi tidak diubah. Seluruh run yang menulis fixture selesai dengan cleanup cocok.

### Tiga kelompok HTTP/SQL

1. Quote dua unit Rp10.000 → total server Rp26.000, stok belum direservasi. Satu konfirmasi commit 201, transport sengaja kehilangan respons. Controller baru membaca recovery dan replay setelah fixture quote kedaluwarsa → **200, body/key sama**, Order satu, orderId/deadline tetap, satu StockReservation untuk quantity dua, reservedStock dua, voucher RESERVED, cart kosong. Record hasil reload memakai GET saja. Ini fault injection setelah commit, bukan gangguan provider nyata.
2. Harga fixture berubah Rp12.000 setelah review → CHECKOUT_CHANGED dan nol order buyer tersebut. Quote baru total Rp29.200 dari server; confirm(false) tidak mengirim order. Persetujuan eksplisit berikutnya memakai key baru dan membuat satu order.
3. Quote lewat TTL server → QUOTE_EXPIRED; stok setelah reservasi fixture lain tidak mencukupi → INSUFFICIENT_STOCK, nol order untuk buyer tersebut. Alamat Batam → DELIVERY_UNAVAILABLE sebelum konfirmasi. Payment count fixture tetap nol.

Timestamp/harga/stok yang diubah hanya ID fixture run. Input/key dibandingkan di memori tanpa dicetak.

## Isolasi dan cleanup

Script memvalidasi URL loopback 55433 dan identitas SQL `current_database()/inet_server_port()` sebelum menulis. Next sementara memakai NODE_ENV=test, DATABASE_URL kosong, TEST_DATABASE_URL terverifikasi, secret sesi baru dan key provider kosong. Transport mengizinkan hanya endpoint auth/addresses/cart/quote/orders yang diperlukan; jalur payment/provider ditolak sebelum fetch. Task Windows tidak dijalankan/diubah.

Cleanup hanya email/ID acak milik run `fe05-<UUID>`; jika ditemukan Payment pada order fixture, cleanup menolak menghapus bukti provider. Relasi order/reservasi/history/akun, produk dan kategori fixture dibersihkan terarah. Tidak reset/migrasi, memakai 5432, menghapus provider fixture lama, atau menulis produk existing.

**15 fingerprint tabel sebelum–sesudah cocok:** User, Session, Address, Category, Product, Cart, CartItem, Discount, CheckoutQuote, Order, OrderItem, StockReservation, OrderStatusHistory, Payment, Rating. Rate-limit dibersihkan hanya key HMAC dari secret/email/window run. Sisa user fixture nol; provider call nol. Server uji dihentikan, server development pengguna dibiarkan aktif.

Artefak tersanitasi, diabaikan Git:

- `.local/fe05/http-result.json`: PASS final.
- `.local/fe05/http-pass-before-browser.json`: PASS sebelum percobaan UI.
- `.local/fe05/ui-blocked-result.json`: checkpoint FAILED, cleanupPass=true, browserTested=false.

Script versi akhir memisahkan `http-result.json` dan `ui-result.json`. Bukti gagal bukan bukti browser berhasil.

## Menutup verifikasi browser

Setelah build, dengan cluster test yang sudah hidup:

```powershell
node --import tsx scripts/verify-checkout-ui-http.mjs --ui
```

Script menampilkan origin `UI_READY`. Proxy hanya memakai cookie buyer fixture run ini; tidak perlu akun dev. **Tidak menguji penerimaan cookie/login browser**—bukti itu tetap FE-02. Payment endpoint diblokir; order hanya fixture test.

1. Buka origin `UI_READY` pada `/checkout`. Pilih alamat, buat quote, periksa snapshot/biaya dari server.
2. Pastikan confirm nonaktif sebelum checkbox disetujui. Periksa keyboard/fokus dan 360/768/1440px.
3. Setujui, klik konfirmasi satu kali. Respons sukses pertama sengaja diganti 503 setelah commit; tidak boleh auto-submit/auto-quote baru.
4. Refresh tab; nominal lama tidak dipercaya. Klik **Periksa / lanjutkan konfirmasi yang sama**. Order yang sama harus tampil. Saat penutupan script memeriksa HTTP 201→200 dengan body/key sama dan Order count satu.
5. Simpan bukti render, lalu tulis `{"stop":true}` ke `.local/fe05/ui-control.json` melalui editor/CLI. Script memeriksa SQL/cleanup. Jika browser gagal diakses, tetap tutup: checkpoint FAILED adalah hasil yang benar, cleanup harus PASS.

Tambahkan browser check logout/pergantian akun saat pending, reset centang pada quote baru, dan expired/konflik tanpa auto-confirm. Unit mencakup ownership/disposal, persetujuan dan referensi; pembersihan storage melalui event sesi dan centang komponen tetap perlu dibuktikan di browser.

Desain individual checkout belum terverifikasi pada audit FE-00; layout mengikuti tema/primitives/form yang tersedia. Tidak mengarang aset atau mencoba ulang kuota Figma. Visual/Figma/UAT menyeluruh tetap FE-12. FE-06 dapat mengintegrasikan Snap dari hasil order ini, tetapi tidak menutup gap FE-05 otomatis.
