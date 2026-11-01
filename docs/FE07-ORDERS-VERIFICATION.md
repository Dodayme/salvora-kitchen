# FE-07 — Riwayat, detail pembeli dan ulasan item

25 Oktober 2026. PRD 1.9 FR-08/FR-11; kontrak API 0.13; [ORDERS](ORDERS.md), [REVIEWS](REVIEWS.md), [FE-05](FE05-CHECKOUT-VERIFICATION.md) dan [FE-06](FE06-PAYMENT-VERIFICATION.md).

**Status: Ditinjau.** Implementasi, unit/controller dan HTTP/PostgreSQL test lulus. Interaksi browser, keyboard/fokus dan responsif belum dijalankan pada FE-07. Koneksi browser DOM sebelumnya tidak tersedia dan izin kontrol Chrome timeout pada FE-05; kegagalan tersebut tidak diulang tanpa perubahan kondisi. FE-05/FE-06 tetap Ditinjau dan uji provider UI-nya tidak dianggap selesai oleh task ini.

## Implementasi

| Bagian | Perilaku |
|---|---|
| `/pesanan` | BUYER, GET orders milik sendiri; lima per halaman, filter enam status order sesuai kontrak, filter mereset page ke 1. Empty/error/loading, page di luar hasil dan kembali ke page pertama |
| Kartu riwayat | Nomor, waktu WIB, jumlah unit, ringkasan seluruh item, total server, dua badge order/payment, seluruh kanal dan status attempt bila lebih dari satu. Tidak menganggap status ringkas sebagai seluruh attempt |
| `/pesanan/[orderId]` | GET detail dengan otorisasi server; snapshot nama/harga/jumlah item, alamat, subtotal/diskon/ongkir/total, deadline dan history publik. Di-remount per orderId dan akun/revisi sesi |
| History | Transisi dan waktu server; tanpa identitas actorUser/catatan admin. Decoder juga membuang admin note dan entri admin same-status secara defensif; tidak menyusun ulang catatan privat |
| Ulasan | Form per item hanya ketika order COMPLETED, canReview=true dan reviewId=null. Rating bulat 1–5, komentar trim 10–1.000 karakter, payload hanya `{rating,comment}`. Tidak ada productId/ownerId/orderId/author dari browser |
| Submit | Lock sinkron menahan klik bersamaan. Berhasil → baca ulang order dan hilangkan form untuk item yang sudah diulas; item lain tetap independen. Tidak ada auto-submit/retry pada effect, timer, render atau pergantian sesi |
| Konflik/unknown | REVIEW_EXISTS, ORDER_NOT_COMPLETED, 404/409, network/protocol/5xx meminta GET order. Tidak mengulang POST karena respons hilang. 422 memberi pesan field; 429 menghormati Retry-After |
| Sesi | RequireRole/useAccountRequest/useBuyerRead FE-02/04. Anonymous/401 menyembunyikan data dan mengarahkan login; admin ditahan oleh gate BUYER; API tetap otoritas. Document dapat HTTP 200 dengan gate/error UI, bukan klaim HTTP document 403/404 |
| Navigasi | Tombol Pesanan saya pada akun; pembayaran menautkan detail pesanan. Detail menautkan halaman pembayaran/status FE-06 tanpa token/provider reference |

Data lama katalog/alamat tidak dipakai membangun ulang snapshot. canReview server tetap diperlukan meskipun order Selesai; reviewId membatasi satu ulasan per item, bukan satu per produk selamanya. Produk nonaktif tidak ditambahkan sebagai alasan baru untuk menghilangkan hak ulasan item selesai. Nama, catatan dan komentar dirender sebagai teks React; tidak memakai HTML mentah. Tidak membuat moderasi/edit/hapus ulasan, retur/refund otomatis, pembatalan atau perubahan status oleh pembeli.

Draft ulasan hanya state komponen yang terkait akun/item. Tidak dipersist ke URL/localStorage/sessionStorage. Hasil terlambat diabaikan setelah unmount/akun tak lagi terotorisasi. Komentar bersifat publik; UI mengingatkan pengguna tidak memasukkan data pribadi. Ini bukan janji sanitasi otomatis isi komentar pengguna.

## Temuan panjang komentar

Dokumen backend lama menyebut UTF-16, sedangkan source **Zod 4.6.7 terpasang** mengukur Unicode code points untuk min/max string: `node_modules/zod/src/v4/core/checks.ts` sekitar 568–572 dan 615–620. Backend `reviewInputSchema` memakai min/max tersebut. PRD tetap 10–1.000 karakter setelah trim.

Frontend mempertahankan validator yang sama, memperbaiki penghitung tampilan menjadi code points, dan mengoreksi dokumentasi. Tidak mengubah service/schema/policy backend. Tes awal FE-07 yang mengasumsikan 501 emoji harus ditolak gagal; asumsi tes diperbaiki berdasarkan source aktual. Tes unit membandingkan schema backend dan frontend untuk 9/10/1.000/1.001 emoji. HTTP nyata membuktikan 9 dan 1.001 ditolak 422, 1.000 diterima. Ini bukan pengujian grapheme/emoji visual gabungan sebagai satu karakter.

## Perubahan berkas

- `src/lib/order-client/model.ts`: DTO summary/detail, review flags, history whitelist, filter/query, validasi rating/komentar dan penghitung Unicode.
- `src/lib/order-client/review-controller.ts`: validasi, single submit, cooldown, conflict/unknown, dan lifecycle owner.
- `src/components/orders/order-screens.tsx`: daftar, filter/pagination, detail/snapshot/history dan form ulasan.
- `src/app/pesanan/page.tsx`, `src/app/pesanan/[orderId]/page.tsx`: route/gate.
- `src/components/auth/account-summary.tsx`, `src/components/payment/payment-screen.tsx`: navigasi.
- `tests/order-client.test.ts`: 33 tes baru.
- `scripts/order-client-fixtures.mjs`, `scripts/verify-checkout-ui-http.mjs`: mode `--orders-client`, fixture/review fault injection dan persiapan `--orders-ui`.

Tidak mengubah service/API backend, PRD, migrasi/schema, dependensi, konfigurasi/key, database dev, task Windows, backup/rollback atau fitur bisnis di luar PRD. Tidak menjalankan worker/reconcile manual maupun gateway/provider baru.

## Verifikasi aktual

| Pemeriksaan | Hasil dan batas |
|---|---|
| `npm.cmd test` | **20 file / 335 tes lulus**, 33 baru FE-07. DTO/snapshot/privacy, eligibility, query, Unicode/backend parity, input/422/429, exact payload, double submit, conflict/unknown, owner/disposal |
| Sandbox | Satu pengulangan unit ditolak spawn EPERM oleh Vite; pengulangan berizin lulus. Tidak diartikan sebagai bug aplikasi |
| `npm.cmd run lint` | Lulus |
| `npm.cmd run typecheck` | Lulus |
| `npm.cmd run build` | Lulus, `/pesanan` dan detail tercantum |
| `npm.cmd run check:client` | PASS, **58 source files / 31 browser artifacts / empat nilai privat** diperiksa tanpa dicetak |
| `node --import tsx scripts/verify-checkout-ui-http.mjs --orders-client` | **PASS empat kelompok**: tiga regresi controller checkout yang dipakai harness, ditambah kelompok riwayat/ulasan baru melalui controller produksi + HTTP Next + PostgreSQL test |
| `--orders-ui` | Baru disiapkan/diperiksa sintaks; **belum dijalankan** dan bukan bukti browser |
| Browser/provider | Tidak ada uji browser FE-07 atau panggilan provider. Bukti FE-03/BE-14 lama tidak dipakai sebagai pengganti |

### Cakupan HTTP/SQL FE-07

- Satu order checkout fixture + enam order sintetis milik buyer → daftar 5+2 tanpa duplikat; filter COMPLETED total 2, EXPIRED kosong, page 999 kosong tanpa clamp.
- Detail dua item, harga/nama historis berbeda dari katalog kini, alamat snapshot tetap setelah alamat hidup fixture diubah, total server tetap. Raw DTO tidak berisi catatan ADMIN/actorUser privat.
- Buyer asing detail/review → 404; login admin fixture → GET daftar buyer 403.
- Review 201 sengaja dihilangkan transport **sesudah commit**; controller membutuhkan reload, rating SQL tepat satu dan POST tidak di-replay. GET detail menunjukkan reviewId/canReview=false pada item itu, item lain tetap dapat diulas.
- Submit stale lagi → REVIEW_EXISTS 409. Item belum Selesai → ORDER_NOT_COMPLETED 409. Produk sama pada order Selesai berbeda boleh diulas lagi → 201.
- Dua ulasan produk utama rating 5/3 → metadata average 4, count 2 meskipun pageSize=1. Author hanya displayName; tidak ada orderItemId pada DTO publik. Komentar `<script>` tersimpan sebagai teks yang di-trim; render DOM belum diuji.
- Batas Unicode HTTP: 9/1.001 emoji → 422 dan tidak ada baris, 1.000 emoji → 201 pada item produk tambahan. Tidak ada perubahan nilai pembayaran atau stok karena submit review.

**Batas fixture:** order COMPLETED/SHIPPED/PROCESSING/NEEDS_ATTENTION pada bagian baru dibuat sebagai fixture SQL sintetis, bukan hasil provider/penerimaan manual/admin fulfillment. Tidak mengklaim bukti alur bayar→Selesai baru dari fixture tersebut. Pengujian backend BE-11/12 yang valid tetap bukti terpisah.

## Isolasi dan cleanup

Harness memvalidasi URL loopback 55433 serta identitas SQL `salvora_kitchen_test` sebelum menulis. Namespace UUID `fe07-...`, secret sesi baru, DATABASE_URL child kosong dan kedua key provider kosong. Transport mode orders melarang endpoint payments/reconcile/provider. Akun admin fixture baru dibuat hanya untuk history/guard test; tidak menyalin akun/sesi pengguna.

Cleanup hanya email/ID run termasuk rating milik order fixture, relasi order/history, cart, user dan dua produk/kategori fixture. Menolak cleanup jika ada Payment/bukti provider. **15 fingerprint sebelum–sesudah cocok**, sisa user fixture 0: User, Session, Address, Category, Product, Cart, CartItem, Discount, CheckoutQuote, Order, OrderItem, StockReservation, OrderStatusHistory, Payment, Rating. Rate-limit hanya key HMAC dari secret/email/window run. Tidak reset database, menghapus provider fixture lama atau memakai port 5432/LanggananKu.

Artefak tersanitasi `.local/fe07/http-result.json`: PASS, cleanupPass=true, browserTested=false, providerCalls=0. Server HTTP sementara sudah dihentikan; development server pengguna tetap dibiarkan aktif.

## Menutup gap browser

Setelah build dan PostgreSQL test hidup, harness persiapan tersedia:

```powershell
node --import tsx scripts/verify-checkout-ui-http.mjs --orders-ui
```

Mode ini menjalankan setup/API test lalu menunggu di `UI_READY`. Buka origin sementara pada `/pesanan`. Proxy hanya menyuntikkan cookie **fixture**; bukan bukti login/penerimaan cookie browser. Orders POST, pembayaran, provider dan mutasi admin diblokir. Mode ini belum diuji runtime pada FE-07; hasil berikut tidak boleh diasumsikan lulus.

1. Periksa daftar 5+2, filter/kosong/page di luar hasil, detail dua item, snapshot, dua status dan tanpa catatan admin. Periksa 360/768/1440px, keyboard dan fokus error.
2. Pilih item yang masih canReview (produk tambahan pada order Selesai kedua), uji input invalid tanpa POST, lalu kirim **satu** ulasan valid. Proxy sengaja mengganti respons sukses pertama menjadi 503 setelah commit. Form harus terkunci hingga GET order; setelah GET item sudah diulas dan tidak ada replay POST.
3. Untuk scope test, edit `.local/fe07/ui-control.json` dengan `scope` buyer/other/admin/anonymous, lalu refresh/navigasikan halaman agar GET sesi memperbarui identitas. Periksa foreign detail 404, gate admin dan anonymous redirect tanpa data akun lama. Perubahan hanya cookie fixture pada proxy, bukan sesi dev.
4. Simpan bukti aman. Akhiri lewat `{"stop":true}` pada control file. Checkpoint memeriksa satu review HTTP 201, lalu cleanup terarah. Jangan menganggap checkpoint HTTP saja sebagai pemeriksaan seluruh browser; tanpa langkah tersebut task tetap Ditinjau. Jika browser tak tersedia, tetap tutup; UI checkpoint FAILED dengan cleanup PASS adalah hasil yang benar.

Penerimaan Selesai memerlukan bukti browser pemilik/foreign owner/empty/error/pagination/submit valid-gagal dan responsif. Desain individual riwayat/checkout belum terverifikasi penuh pada audit FE-00; tema dan primitive yang ada dipakai, tanpa aset atau fitur baru. FE-08 dapat mulai dari auth/fondasi/backend dashboard yang ada, sambil mempertahankan gap FE-05/06/07. Penerimaan produk/Figma/deployment tetap terpisah.
