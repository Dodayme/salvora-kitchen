# Serah terima frontend — BE-14

PRD 1.9; kontrak [API-CONTRACT.md](API-CONTRACT.md) v0.13. **BE-00–BE-14 Selesai untuk backend.** PostgreSQL/gateway mock dan HTTP Next.js nyata hingga ulasan/admin, DB kosong/seed/restore serta satu BNI VA Sandbox Rp14.000 settlement/webhook/application terbukti. Batas retensi historis dan penerimaan produk terpisah dijelaskan di [BE14-RECONCILIATION.md](BE14-RECONCILIATION.md). Halaman masih sementara; bukan klaim frontend/Figma/deployment siap.

## Aturan integrasi

**Pembaruan FE-12, 25 Oktober 2026 — Ditinjau:** [FE-VERIFICATION.md](FE-VERIFICATION.md) adalah laporan penerimaan terbaru. Refresh fokus pada tab visible menjadi background agar draft akun yang sama bertahan; hidden/pageshow/identity/expiry tetap invalidasi. 438 unit/regresi serta lint/typecheck/build/boundary lulus. Checkout browser response-loss/reload/recovery PASS dan cleanup 15 tabel; hasil checkout smoke pada 360/768/1440. Fulfillment/cancel/receipt/note browser admin diamati parsial, tetapi runner timeout sehingga checkpoint tetap FAIL; cleanup 18 tabel PASS. Seluruh fixture server berakhir. FE-05–FE-12 belum diterima menyeluruh: browser lintas halaman/state, provider UI baru dan aset visual final masih gap. Tidak mengubah backend/dev/task atau membuat transaksi provider. Status/angka paragraf di bawah merupakan bukti tahap sebelumnya, bukan pengganti hasil terbaru.

**Pembaruan FE-11, 25 Oktober 2026 — Ditinjau:** voucher tetap readonly tersedia di `/admin/voucher`; profil nama sendiri di `/admin/akun` memakai GET/PATCH me dan revalidasi sesi. Email/peran informasi saja. [Laporan FE-11](FE11-ACCOUNT-VOUCHER-VERIFICATION.md): 437 unit/regresi dan tujuh kelompok HTTP/test DB lulus, cleanup 18 tabel cocok. Body ID/email/role ditolak, admin lain utuh, nama Unicode sah tetap terbaca pada sesi; voucher tidak berubah oleh GET. Tidak mengubah backend/task/config/dev atau memanggil provider. Browser belum diuji; izin Chrome yang baru timeout pada FE-10 tidak diulang. Seluruh menu P0 aktif sesuai implementasi; FE-12 menutup gap penerimaan FE-05–FE-11 dan visual, bukan menganggap seluruh frontend telah Selesai.

**Pembaruan FE-10, 25 Oktober 2026 — Ditinjau:** `/admin/pesanan`, detail dan `/admin/pembayaran` kini tersedia. Filter createdAt/WIB, nomor/status/kanal, snapshot multi-item, seluruh attempt, history/note privat dan transisi dengan expectedStatus memakai API asli. Selesai wajib konfirmasi manual yang awalnya kosong dan note. [Laporan FE-10](FE10-ORDERS-VERIFICATION.md): 415 unit/regresi, lint/typecheck/build/boundary dan tujuh kelompok HTTP/test DB lulus; cleanup 18 tabel cocok. Pembayaran sintetis, provider call nol. Browser belum berjalan karena izin kontrol aplikasi timeout; mode UI dihentikan dengan checkpoint FAIL/cleanup PASS. Service/config/task/dev tetap. FE-11 berikutnya; FE-05–FE-09 tetap Ditinjau.

**Pembaruan FE-09, 25 Oktober 2026 — Ditinjau:** `/admin/kategori` dan `/admin/produk` mengaktifkan dua menu admin. Kategori tersimpan berhalaman, metadata produk terpisah dari stok, unggahan FormData/preview/pemasangan photoId, PUT stok expectedUpdatedAt dan konflik wajib GET ulang tersedia. [Laporan FE-09](FE09-CATALOG-VERIFICATION.md): 387 unit/regresi dan tujuh kelompok controller/HTTP/PostgreSQL test lulus; cleanup 16 tabel dan seluruh arsip foto test cocok. Riwayat preflight/cleanup voucher dan recovery terbatas dicatat. Browser CRUD/upload/stok/cancel/akses/keyboard/responsif belum diuji; tetap Ditinjau. Tidak mengubah API/service/config/task/dev atau menghubungi provider. FE-10 berikutnya, gap FE-05–FE-08 tetap terbuka.

**Pembaruan FE-08, 25 Oktober 2026 — Ditinjau:** `/admin` kini dashboard operasional dalam layout admin dengan sidebar/drawer; profil sesi readonly yang sudah ada dipindahkan ke `/admin/akun`. Produk/Kategori/Pesanan/Pembayaran/Voucher masih berlabel Belum tersedia sampai modulnya dibuat. Periode tanggal WIB diubah ke from UTC inklusif/to eksklusif, metrik createdAt terpisah dari inventaris global saat ini. [Laporan FE-08](FE08-ADMIN-DASHBOARD-VERIFICATION.md): 359 unit/regresi dan empat kelompok controller/HTTP/PostgreSQL test lulus; 15 fingerprint cleanup cocok. Browser/drawer/logout/keyboard/responsif belum teruji; `--dashboard-ui` baru disiapkan. Tidak mengubah API/service/task/config atau menambah metrik di luar PRD. FE-09 siap implementasi; FE-05–FE-07 tetap Ditinjau.

**Pembaruan FE-07, 25 Oktober 2026 — Ditinjau:** `/pesanan` dan `/pesanan/[orderId]` memakai daftar/detail pemilik dengan snapshot dan history publik; akun serta pembayaran menautkan riwayat/detail. Form per item memerlukan COMPLETED/canReview/reviewId=null; POST hanya rating/comment. [Laporan FE-07](FE07-ORDERS-VERIFICATION.md): 335 unit/regresi dan empat kelompok controller/HTTP/PostgreSQL test lulus, 15 fingerprint cleanup cocok. Unicode counter cocok dengan backend terpasang, tanpa perubahan service/policy. Browser belum diuji; `--orders-ui` baru disiapkan. Fixture Selesai sintetis bukan bukti pembayaran/admin fulfillment. FE-05/06 tetap Ditinjau; frontend admin FE-08 berikutnya dan penerimaan produk/deployment tetap terpisah.

**Pembaruan FE-06, 25 Oktober 2026 — Ditinjau:** hasil order checkout menautkan `/pembayaran/[orderId]`. SDK Sandbox dimuat lewat tombol persiapan; permintaan instruksi/reconcile hanya dari tindakan pengguna. Callback/finish membaca status lokal dan tidak melunaskan order. [Laporan FE-06](FE06-PAYMENT-VERIFICATION.md): 302 unit/regresi, lint/typecheck/build/boundary dan empat kelompok controller/HTTP/PostgreSQL test lulus, cleanup 15 fingerprint cocok. Uji 201/200/202/SDK/reconcile masih mock; API nyata diuji fail-closed dengan key kosong tanpa Payment/provider. Browser dan VA Sandbox baru belum diuji; webhook HTTPS belum valid. [Rencana penerimaan](FE06-SANDBOX-PLAN.md) belum dijalankan; izin transaksi lama tidak digunakan ulang. FE-05 tetap Ditinjau, API/service/task/config tidak diubah.

**Pembaruan FE-05, 25 Oktober 2026 — Ditinjau:** `/checkout` sudah memuat pilihan alamat, quote server, persetujuan, konfirmasi dengan key/input tetap dan recovery per tab/akun. [Laporan FE-05](FE05-CHECKOUT-VERIFICATION.md): 266 unit/regresi, lint/typecheck/build/boundary dan tiga kelompok controller + HTTP Next + PostgreSQL test lulus; cleanup 15 fingerprint cocok. Browser checkout belum terbukti karena akses DOM tidak tersedia/izin kontrol Chrome timeout. Tidak ditandai Selesai; langkah checkpoint browser dan batas proxy fixture tersedia pada laporan. Tidak ada panggilan provider atau perubahan backend/task/config. FE-06 dapat memakai hasil order untuk integrasi Snap, dengan gap penerimaan FE-05 tetap terbuka.

**Pembaruan FE-04, 25 Oktober 2026:** `/keranjang`, `/alamat`, navigasi/badge aktual dan informasi voucher sudah tersedia untuk BUYER. [Hasil FE-04](FE04-BUYER-VERIFICATION.md) memuat browser/API nyata, mock voucher, cleanup dan batas retest visual setelah restart. Sumber harga/stok/subtotal tetap server; perubahan absolut dan penghapusan tidak mereservasi stok. Respons mutasi belum pasti harus dipulihkan lewat GET sebelum keputusan baru. Pilihan alamat pengiriman, quote dan konfirmasi idempoten tetap **FE-05**; endpoint/service backend tidak diubah. Setup Next.js dan cluster existing dinyalakan atas permintaan pengguna; task Windows tetap konfigurasinya.

**Pembaruan FE-03 (historis):** beranda `/`, katalog `/menu` dan detail `/menu/[productId]` memakai API publik; add-cart hanya BUYER dengan pemulihan GET saat hasil belum pasti. [Hasil FE-03](FE03-CATALOG-VERIFICATION.md) memisahkan real DB/mock/responsif dan gap visual. Cakupan keranjang/alamat/voucher dilanjutkan pada FE-04 di atas.

**Status frontend 24 Oktober 2026:** FE-00/01 serta fungsi FE-02 selesai. `/login`, `/register`, `/akun` dan pintu masuk `/admin` memakai API auth yang sudah ada; [bukti FE-02](FE02-AUTH-VERIFICATION.md) memisahkan PostgreSQL nyata/mock dan gap aset visual. Untuk fitur privat selanjutnya, pakai SessionProvider/RequireRole/useAccountRequest agar 401, perubahan role dan pergantian akun membersihkan tampilan/cache. Dashboard operasional tetap FE-08, katalog FE-03; penerimaan produk/Figma/deployment belum selesai.

Gunakan fetch same-origin dengan cookie sesi, JSON dan Content-Type application/json untuk mutasi. Browser mengirim Origin; panggilan lintas origin tidak menjadi alur P0. Jangan simpan token sesi atau key server di frontend. Ambil GET /api/auth/session untuk peran/nama akun; pengecekan tampilan tidak menggantikan otorisasi API. Admin bukan pembeli untuk checkout/review. Jangan mengirim userId, role, harga atau status pembayaran yang ditentukan browser.

Envelope success/data/meta dan error/code/message/fields mengikuti kontrak. Simpan requestId untuk laporan tanpa PII; tangani respons framework 404/405 yang bisa non-JSON. Pagination berada di meta.pagination; halaman di luar hasil tetap kosong. Jangan render komentar/catatan/nama pengguna sebagai HTML mentah. Nominal Rupiah integer; tampilan dapat memakai Intl.NumberFormat id-ID, waktu server UTC ditampilkan Asia/Jakarta. Field null tampil sebagai belum tersedia, bukan angka/status contoh.

## Peta halaman ke API dan perilaku

| Bagian UI | Sumber API | Perilaku yang diperlukan |
|---|---|---|
| Login/registrasi/logout | /api/auth/* | confirmPassword saat register; role BUYER dari server; logout POST body {} |
| Profil admin sendiri | /api/admin/me | PATCH hanya name; email/peran informasi saja |
| Menu/detail | /api/categories, /api/products, /api/products/{id} | Publik; aktif berbeda dari ketersediaan; isDemo wajib ditandai |
| Foto/katalog admin | /api/admin/categories, /api/admin/products, /api/admin/product-photos | Upload JPEG/PNG/WebP maks 2.000.000 byte; stok endpoint khusus expectedUpdatedAt |
| Alamat/keranjang | /api/addresses, /api/cart, /api/cart/items | Login BUYER; cart bukan reservasi, gunakan harga/stok terbaru dari server |
| Voucher | /api/me/voucher | 20% maksimum Rp100.000, sekali akun; AVAILABLE bukan jaminan checkout |
| Checkout | /api/checkout/quote, /api/orders POST | Quote dahulu, konfirmasi dengan Idempotency-Key stabil untuk satu tindakan |
| Pembayaran | /api/orders/{id}/payments POST {} | Instruksi khusus pemilik; 200 reuse, 201 baru, 202 belum pasti; jangan membuat attempt baru otomatis |
| Status transaksi | /api/orders/{id}, /api/orders/{id}/payments/reconcile POST {} | GET tidak memanggil gateway; reconcile mengikuti canReconcile/limiter dan tindakan eksplisit |
| Riwayat pembeli | /api/orders GET, /api/orders/{id} | Snapshot item/alamat/nominal, status order dan pembayaran terpisah |
| Pesanan/pembayaran admin | /api/admin/orders, /api/admin/orders/{id}, /api/admin/payments | Filter UTC, status/kanal per attempt; status ringkas bukan seluruh riwayat |
| Pemenuhan/catatan | /api/admin/orders/{id}/status PATCH, /notes POST | PROCESSING → SHIPPED → COMPLETED; expectedStatus dan konfirmasi manual penerimaan |
| Ulasan | /api/order-items/{itemId}/review POST, /api/products/{id}/reviews GET | Hanya item milik BUYER yang COMPLETED dan belum diulas; rating 1–5, komentar trim 10–1.000 |
| Dashboard/voucher admin | /api/admin/dashboard, /api/admin/vouchers, /api/admin/voucher-policy | Periode UTC wajib untuk dashboard; inventaris global saat ini berbeda dari periode pesanan |

Tabel ringkas tidak menggantikan input lengkap, validasi dan otorisasi dalam kontrak/domain docs. Profil toko, kontak, aset/menu final dan desain tetap memerlukan data resmi; fixture harus diberi label demo.

## Contoh payload tanpa kredensial

ID berikut hanya placeholder, bukan referensi transaksi nyata. URL relatif memakai origin aplikasi.

```http
POST /api/checkout/quote
Content-Type: application/json

{"addressId":"address-from-api"}
```

```http
POST /api/orders
Content-Type: application/json
Idempotency-Key: checkout-attempt-example-0001

{"quoteId":"quote-from-api"}
```

Gunakan key yang sama untuk retry jaringan dari konfirmasi yang sama; simpan sebelum fetch. Jangan menyalin contoh key ini sebagai key global. Quote TTL 5 menit tidak mereservasi stok; server menghitung ulang saat order dibuat. CHECKOUT_CHANGED/QUOTE_EXPIRED memerlukan quote baru dan peninjauan ulang. Jika respons konfirmasi hilang, retry key lama dahulu; jangan membuat order lain hanya karena timeout.

```json
{"status":"SHIPPED","expectedStatus":"PROCESSING","note":"Diserahkan untuk delivery manual."}
```

```json
{"status":"COMPLETED","expectedStatus":"SHIPPED","receiptConfirmed":true,"note":"Penerimaan dikonfirmasi melalui komunikasi manual."}
```

```json
{"rating":5,"comment":"Makanan diterima dengan baik."}
```

Konfirmasi Selesai tidak otomatis dan tidak boleh dicentang tanpa konfirmasi operasional admin. Untuk notes kirim `{note}`; tidak ada override sukses pembayaran. Detail pembeli menyembunyikan catatan bebas serta identitas admin; jangan mencoba membangun ulang informasi internal di client.

## Keadaan pembayaran dan error penting

- Hitung mundur memakai paymentDeadline order, 60 menit sejak dibuat; token/attempt baru tidak memperpanjangnya. Nol pada UI tidak berarti stok sudah dilepas. Delivery manual awal seluruh Kota Tanjungpinang, Kepulauan Riau, Rp10.000 per pesanan. Tidak ada COD, transfer manual, pickup, gratis ongkir bersyarat atau promo umum.
- Snap callback, redirect /payment/finish dan popup ditutup tidak membuktikan sukses/gagal. Baca status server; hindari loop reconcile otomatis tiap render. Instruksi token/redirect hanya untuk pemilik, jangan log atau simpan dalam analytics/URL aplikasi.
- PENDING/UNCONFIRMED/CREATED atau status belum pasti bukan alasan membuat attempt baru. Retry hanya setelah backend mengizinkannya. NEEDS_ATTENTION, refund/reversal dan dua pembayaran sukses harus tampak jelas; tidak ada janji refund otomatis atau stok/voucher dikembalikan.
- 401 arahkan login; 403 tolak; 404 resource tidak tersedia. 422 koreksi field; 429/503 patuhi Retry-After jika ada. 500 tampilkan pesan generik dan requestId, tanpa mengarang status transaksi.
- 409 CHECKOUT_CHANGED/INSUFFICIENT_STOCK: tinjau ulang quote. IDEMPOTENCY_CONFLICT: jangan mengganti isi untuk key yang sama. PAYMENT_RECONCILIATION_REQUIRED: periksa status sebelumnya. ORDER_STATUS_CONFLICT: muat ulang status sebelum admin mencoba lagi. ORDER_NOT_COMPLETED/REVIEW_EXISTS: muat ulang detail item, jangan retry insert tanpa batas.
- Dashboard ordersByStatus sudah lengkap termasuk nol. StockSummary memakai stok tersedia fisik−reservasi, low 1–5/habis 0, mencakup produk nonaktif berlabel. listLimit=10 adalah cuplikan; hitungan penuh dapat lebih besar. Gunakan katalog admin berhalaman untuk daftar stok lainnya.
- GET reviews mengirim meta.ratingSummary dari seluruh produk, bukan rata-rata halaman. Nama tampilan dan komentar adalah teks pengguna; moderasi P1 belum tersedia.

## Kesiapan lingkungan

Cluster khusus 55433 telah terverifikasi merespons; lima hitungan antrean dev nol dan dua tick kosong berhasil. Integrasi frontend dapat memakai API lokal sesuai kontrak, dengan izin/sesi dan data demo yang jelas; jangan memicu transaksi provider baru atau menjalankan ulang bootstrap. Jangan memakai 5432 sebagai pengganti. Development server tidak memasang/menonaktifkan task otomatis. Jangan memaketkan .env.local, .local, node_modules, log, backup, token atau kredensial demo ke artefak frontend.

Konfigurasi yang harus disiapkan sendiri tanpa nilainya di dokumentasi: DATABASE_URL, TEST_DATABASE_URL, SHADOW_DATABASE_URL, AUTH_SECRET, NEXT_PUBLIC_APP_URL, MIDTRANS_SERVER_KEY, NEXT_PUBLIC_MIDTRANS_CLIENT_KEY, MIDTRANS_IS_PRODUCTION=false, MIDTRANS_WEBHOOK_URL dan PAYMENT_EXPIRY_MINUTES=60. Deployment foto memerlukan PRODUCT_PHOTO_STORAGE_DIR serta PRODUCT_PHOTO_STORAGE_PERSISTENT; hosting HTTPS/volume/job server belum diputuskan. Hanya client key Sandbox yang memang bersifat publik boleh dipakai integrasi Snap; server key selalu server-only.

UAT responsif, React/Tailwind/shadcn, CSS/Figma/aset dan integrasi Snap pada UI produk belum lulus. Alur backend hingga ulasan terbukti dengan PostgreSQL/HTTP dan gateway mock; **provider nyata terpisah** terbukti BNI VA Sandbox Rp14.000 sampai PROCESSING, bukan klaim barang nyata dikirim/diulas. Endpoint/tunnel sementara telah ditutup; produksi/demo hosting memerlukan HTTPS/webhook, volume foto dan job server yang ditetapkan sendiri. Penerimaan deployment/produk terpisah dari penyelesaian backend BE-00–BE-14.
