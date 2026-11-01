# Kontrak API — fondasi BE-01

| Metadata | Nilai |
|---|---|
| Acuan | PRD aktif 1.9 bagian 14–16, 25; FR-01–FR-11, FR-13/FR-14; [DECISIONS.md](DECISIONS.md) |
| Versi kontrak | 0.13, 23 Oktober 2026 |
| Implementasi saat ini | BE-00–BE-14 Selesai untuk backend; PostgreSQL/mock gateway/HTTP, DB kosong/migration/seed/restore dan satu BNI VA Sandbox nyata Rp14.000 settlement/webhook/application terbukti. Task tiap menit dan tick kosong terverifikasi; endpoint HTTPS uji sudah ditutup. Catatan retensi historis tetap dicatat; frontend/deployment belum diterima |
| Cakupan | Satu origin Next.js, JSON, Rupiah, delivery manual, Midtrans Snap Sandbox |

Kontrak dapat dipakai frontend; fixture wajib diberi tanda demo. Pembayaran BNI VA Sandbox nyata Rp14.000 dan webhook/application terverifikasi 24 Oktober 2026, selain regresi gateway mock/HTTP. Ini bukan kesiapan pembayaran produksi atau deployment webhook permanen. Rincian [AUTH.md](AUTH.md), [CATALOG.md](CATALOG.md), [BUYER.md](BUYER.md), [CHECKOUT.md](CHECKOUT.md), [PAYMENTS.md](PAYMENTS.md) dan [WEBHOOKS.md](WEBHOOKS.md).

BE-14: [FRONTEND-HANDOFF.md](FRONTEND-HANDOFF.md) menyerahkan alur UI dan payload; [BE14-RECONCILIATION.md](BE14-RECONCILIATION.md) menjadi status terbaru, sedangkan [BACKEND-VERIFICATION.md](BACKEND-VERIFICATION.md) mempertahankan baseline historis. Kontrak bukan bukti settlement provider atau kesiapan deployment.

## 1. Aturan bersama

- Base path `/api`, same-origin. JSON request memakai `Content-Type: application/json`; field yang tidak didaftarkan ditolak dengan 422, kecuali webhook yang membuang field tambahan provider. Tidak menerima `userId`, `role`, harga, atau nominal dari browser untuk menentukan kepemilikan/perhitungan transaksi.
- ID adalah string opaque, tidak ditebak dari urutan angka dan tidak disamakan dengan nomor pesanan. `orderId` adalah ID internal toko, `number` nomor tampil; `paymentId` ID percobaan, `providerOrderId` referensi unik percobaan ke Midtrans. Jangan memakai salah satunya sebagai pengganti yang lain.
- Nama field camelCase; enum UPPER_SNAKE_CASE. Nominal `number` integer Rupiah >=0, maksimum **2.147.483.647** sesuai penyimpanan INTEGER BE-02, mata uang `IDR`. Kuantitas integer >0; perkalian dan total harus tetap dalam batas tersebut. Timestamp ISO-8601 UTC (`...Z`), field belum ada memakai `null`, array kosong `[]`. Frontend menampilkan waktu Asia/Jakarta.
- Tidak ada credential/token sesi pada JSON. Session cookie `salvora_session` bersifat HttpOnly, SameSite=Lax, Secure untuk URL aplikasi HTTPS, host-only, path `/`. Masa sesi 7 hari tanpa fitur Ingatkan Saya; rotasi saat login dan revoke saat logout sudah tersedia pada BE-03.
- Semua mutation dari browser, termasuk login/register/logout dan reconcile, wajib Origin tepat sama dengan konfigurasi aplikasi (scheme/host/port), serta sesi/peran jika diperlukan. Tidak membuka CORS wildcard dengan credentials. Webhook dikecualikan dari sesi/Origin browser dan memakai verifikasi Midtrans.
- `Principal` harus diselesaikan server dari sesi melalui `requireSessionUser(request, role?)` BE-03. Role dibaca dari DB, bukan input/browser atau salinan role pada cookie. Helper akses memeriksa role/kepemilikan; menyembunyikan tombol UI tidak menggantikan pemeriksaan server.
- Semua respons handler memakai `Cache-Control: no-store`. Data publik yang kelak di-cache membutuhkan kebijakan eksplisit. `GET` tidak membuat charge, merekonsiliasi provider atau mengubah status transaksi.
- JSON default dibatasi **65.536 byte aktual** lewat helper `jsonBody`, termasuk jika Content-Length hilang/palsu. Multipart foto dibatasi file 2.000.000 byte dan body keseluruhan 2.065.536 byte termasuk overhead; tepat satu field file. Baca foto mengembalikan binary image/webp, error tetap JSON.
- Sukses normal 200, pembuatan resource 201. Delete/logout rencana mengembalikan 200 dengan `data: null`, sehingga frontend tetap menerima envelope; tidak memakai body pada 204.

### Envelope

```json
{
  "success": true,
  "data": { "id": "opaque-id" },
  "meta": { "requestId": "server-generated-uuid" }
}
```

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Input tidak valid.",
    "fields": [{ "path": "quantity", "code": "invalid_type" }]
  },
  "meta": { "requestId": "server-generated-uuid" }
}
```

`fields` opsional; hanya path dan kode validasi, tanpa input mentah atau pesan library yang dapat memuat nilai rahasia. `X-Request-Id` sama dengan `meta.requestId`, dibuat server, bukan dipercaya dari client. Error tak dikenal selalu menjadi 500 `INTERNAL_ERROR` dengan pesan generik; stack, SQL, URL koneksi dan detail provider tidak dikirim. `userView()` adalah whitelist user; resource lain wajib menambah whitelist sendiri saat diimplementasikan, bukan mengirim record ORM utuh lewat `success()`.

Envelope berlaku pada handler yang sudah diimplementasikan. Respons 404 untuk path API yang belum dibuat dan 405 dari dispatch metode Next.js dapat berupa respons bawaan framework; frontend tidak boleh menganggap endpoint rencana tersedia. UI harus menangani respons non-JSON dengan pesan generik.

### Pagination, filter, dan error

Daftar berpaginasi memakai `?page=1&pageSize=20`, default 1/20, page maksimum 100.000 dan pageSize maksimum 100. Angka harus desimal integer positif tanpa eksponen/pecahan; parameter pagination berulang ditolak. Urutan default `createdAt DESC, id DESC` untuk daftar transaksi/review/admin, nama lalu ID untuk kategori/katalog. Implementasi harus menetapkan tie-breaker. Halaman di luar hasil mengembalikan array kosong, tidak diam-diam berpindah halaman.

```json
{
  "success": true,
  "data": [],
  "meta": {
    "requestId": "server-generated-uuid",
    "pagination": { "page": 1, "pageSize": 20, "total": 0, "totalPages": 0 }
  }
}
```

Filter per endpoint dicatat pada tabel; field filter/status di luar daftar ditolak ketika endpoint dibuat. `total` adalah jumlah setelah filter dan **setelah pembatasan akses**, bukan seluruh data akun lain. Pencarian katalog/pengurutan lanjutan pelanggan tetap P1; pencarian admin P0.

| HTTP | Kode bersama/rencana | Perilaku UI |
|---|---|---|
| 400 | `INVALID_JSON`, `INVALID_QUERY` | Perbaiki format permintaan |
| 401 | `UNAUTHENTICATED`, `INVALID_CREDENTIALS` | Login ulang/pesan login generik; jangan mengungkap keberadaan email saat login |
| 403 | `FORBIDDEN`, `INVALID_ORIGIN`, `INVALID_SIGNATURE` | Tolak tindakan; jangan menampilkan data rahasia |
| 404 | `NOT_FOUND`, `PAYMENT_NOT_FOUND` | Resource tidak tersedia |
| 409 | `EMAIL_EXISTS`, `RESOURCE_EXISTS`, `RESOURCE_IN_USE`, `RESOURCE_VERSION_CONFLICT`, `STOCK_RESERVED`, `PRICE_CHANGED`, `STOCK_CHANGED`, `VOUCHER_RESERVED`, `IDEMPOTENCY_CONFLICT`, `PAYMENT_ACTIVE`, `PAYMENT_UNCONFIRMED`, `ORDER_NOT_PAYABLE`, `INVALID_TRANSITION`, `REVIEW_EXISTS`, `REVIEW_NOT_ALLOWED`, `AMOUNT_MISMATCH`, `TRANSACTION_MISMATCH` | Tampilkan keadaan terbaru; tinjau ulang atau reconcile sesuai kode, bukan otomatis membuat charge baru |
| 413/415/422 | `BODY_TOO_LARGE`, `PHOTO_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`, `VALIDATION_ERROR`, `INVALID_PHOTO` | Koreksi body/field; MIME/isi foto wajib cocok |
| 429 | `RATE_LIMITED` | Tunggu sesuai `Retry-After`; limiter auth dan reconcile tersedia |
| 500 | `INTERNAL_ERROR` | Pesan generik, sertakan requestId jika melapor |
| 502/503 | `MIDTRANS_UNAVAILABLE`, `ENV_NOT_CONFIGURED`, `PHOTO_STORAGE_NOT_CONFIGURED`, `STATUS_UNAVAILABLE`, `CHECKOUT_BUSY`, `ORDER_BUSY`, `REVIEW_BUSY` | Konfigurasi/layanan belum tersedia; ketidakpastian pembayaran tidak dianggap gagal/sukses; patuhi Retry-After jika ada |

Kode auth/katalog/foto pada handler tersedia; kode pembayaran/transaksi mengikuti endpoint tersedia; endpoint rencana tetap ditandai. Auth memakai fixed bucket 15 menit: login 10/email dan 200 global, registrasi 5/email dan 50 global. Key counter HMAC dan increment PostgreSQL atomik. Sukses/gagal tetap dihitung. Header proxy arbitrary tidak dipakai sebagai IP tepercaya; pembatasan tambahan per jaringan mengikuti hosting nanti. Reconcile tersedia dengan batas akun/order pada bagian pembayaran.

Kode spesifik BE-11/BE-12 yang juga harus ditangani: 409 ORDER_STATUS_CONFLICT, ORDER_TRANSITION_INVALID, ORDER_PAYMENT_NOT_FULFILLABLE, ORDER_NOT_COMPLETED dan REVIEW_EXISTS; 422 RECEIPT_CONFIRMATION_REQUIRED/RECEIPT_CONFIRMATION_INVALID. Rincian payload dan tindakan ada pada bagian pesanan/ulasan dan domain docs; tabel bersama bukan daftar eksklusif.

## 2. Hak akses

| Singkatan | Akses |
|---|---|
| Publik | Tanpa sesi; katalog/detail produk ditetapkan publik oleh pengguna pada PRD 1.5 |
| Pembeli | Sesi role `BUYER`, hanya resource miliknya; admin tidak otomatis boleh menjalankan checkout/ulasan sebagai pembeli |
| Pemilik/admin | Pemilik pesanan atau role `ADMIN` untuk membaca pesanan/pembayaran dan reconcile; akses PII hanya sesuai kebutuhan operasional |
| Admin | Sesi role `ADMIN`; profil dasar hanya akun admin sendiri |
| Provider | Midtrans, payload/signature/referensi/nominal/status server terverifikasi; tanpa sesi pengguna |

Query data privat harus dibatasi pemilik di server. `GET` resource milik akun lain ditolak (403 atau 404 dengan konsistensi pada implementasi); tidak menyisipkan resource itu dalam respons error. Admin tidak memperoleh CRUD akun admin lain, perubahan peran, override pembayaran sukses, atau reset voucher.

## 3. Bentuk data minimum (rencana)

`?` berarti opsional pada input; `| null` berarti field selalu ada pada output tetapi dapat belum terisi. Data berikut adalah DTO API, bukan keputusan nama kolom database.

| Tipe | Field yang dikembalikan |
|---|---|
| `User` | `id, name, email, role: BUYER\|ADMIN`; tidak ada hash/token/sesi |
| `Category` | `id, name, isActive, productCount` (hitungan sesuai scope aktif/admin), `isDemo` untuk penanda data contoh |
| `Product` | `id, category: {id,name}, name, description, price, imageUrl: string\|null, isActive, isDemo, availableStock, availability: AVAILABLE\|LOW\|OUT_OF_STOCK, averageRating: number\|null, reviewCount`; admin juga `physicalStock, reservedStock, photoId: string\|null, createdAt, updatedAt`. LOW=1–5 tersedia, OUT_OF_STOCK=0, AVAILABLE>=6 |
| `Address` | `id, recipientName, phone, addressLine, city, province, postalCode: string\|null, notes: string\|null`; tanpa menerima ownerId dari client |
| `Cart` | `id: string\|null, items: CartItem[], subtotal`; id null sebelum penambahan pertama berhasil, GET tidak membuat cart |
| `CartItem` | `id, productId, name, imageUrl: string\|null, unitPrice, quantity, lineSubtotal, availableStock, isAvailable`; subtotal keranjang indikatif, bukan harga terkunci |
| `Voucher` | `id, type: NEW_BUYER, percentage: 20, maxDiscount: 100000, status: AVAILABLE\|RESERVED\|USED, reservedOrderId: string\|null, usedAt: timestamp\|null` |
| `CheckoutQuote` | `quoteId, expiresAt, address: AddressSnapshot, items: OrderItemSnapshot[], subtotal, discount, shippingFee, total, currency: IDR, voucher: {id,discount}\|null, shipping: {mode: MANUAL_DELIVERY,label}, warnings: {code,message}[]` |
| `OrderSummary` | `id, number, createdAt, status: OrderStatus, paymentStatus: PaymentStatus\|null, paymentStatuses: PaymentStatus[], channel: string\|null, channels: string[], total, currency: IDR, paymentDeadline, itemCount, itemSummary: {name,quantity}[]` |
| `OrderDetail` | Field OrderSummary + `items: OrderItemSnapshot[], address: AddressSnapshot, subtotal, discount, shippingFee, voucher: {id,discount}\|null, shipping: {mode:MANUAL_DELIVERY,label}, payments: PaymentSummary[], history: StatusHistory[], canPay, canReconcile, attentionReason: string\|null`; canPay berdasarkan tenggat/token/bukti terminal; canReconcile bila ada attempt atau order menunggu sudah lewat tenggat |
| `OrderItemSnapshot` | `id` (pada order; quote memakai `cartItemId`), `productId, name, unitPrice, quantity, lineSubtotal`; order juga `canReview, reviewId: string\|null` |
| `AddressSnapshot` | `recipientName, phone, addressLine, city, province, postalCode: string\|null, notes: string\|null`; tidak berubah saat alamat akun diedit |
| `PaymentSummary` | `id, providerOrderId, provider: MIDTRANS, status: PaymentStatus, amount, currency: IDR, channel: string\|null, createdAt, expiresAt, paidAt: timestamp\|null`; tanpa token di daftar umum |
| `PaymentInstruction` | `orderId, paymentId, providerOrderId, status, snapToken: string\|null, redirectUrl: string\|null, expiresAt, reused: boolean`; hanya respons tindakan pembayaran milik pemilik, bukan katalog/dashboard |
| `StatusHistory` | `fromStatus: OrderStatus\|null, toStatus, changedAt, actor: SYSTEM\|ADMIN, note: string\|null`; admin juga menerima `actorUser:{id,name}\|null`. Catatan bebas admin disembunyikan dari pembeli; tanpa secret/payload mentah |
| `Review` | `id, productId, rating, comment, author: {displayName}, createdAt`; email, alamat dan ID sesi tidak dipublikasikan |

Quote tidak melakukan reservasi. `quoteId` adalah referensi server terikat pembeli dengan TTL 5 menit, disimpan sebagai snapshot canonical hash di BE-07. Konfirmasi selalu memvalidasi ulang di bawah lock. Jika harga/alamat/cart/voucher/kebijakan berubah, 409 CHECKOUT_CHANGED dan frontend mengambil quote baru untuk persetujuan; jika stok tidak mencukupi/nonaktif, 409 INSUFFICIENT_STOCK/PRODUCT_UNAVAILABLE. Quote habis TTL 409 QUOTE_EXPIRED, cart kosong 409 CART_EMPTY. Jangan menerima total yang diganti client.

## 4. Operasi dan payload

### Fondasi tersedia

| Metode/path | Akses | Respons aktual |
|---|---|---|
| `GET /api/health` | Publik, read-only | 200 `{application:"salvora-kitchen",configuration:"valid",database:"not_checked",payment:"not_checked"}` jika konfigurasi fondasi valid; 503 envelope `ENV_NOT_CONFIGURED` jika tidak. Tidak membocorkan konfigurasi atau mencoba DB/Midtrans |

### Auth dan profil — TERSEDIA BE-03; penerbitan voucher BE-06 tersedia

| Metode/path | Akses | Input JSON | `data` berhasil |
|---|---|---|---|
| `POST /api/auth/register` | Publik + Origin | `{name,email,password,confirmPassword}` | 201 `{user: User}` + cookie sesi baru; selalu BUYER, menerbitkan satu voucher jika memenuhi syarat dalam transaksi yang sama |
| `POST /api/auth/login` | Publik + Origin | `{email,password}` | `{user: User}` + cookie sesi yang dirotasi; penerbitan voucher idempoten untuk pembeli yang memenuhi syarat |
| `POST /api/auth/logout` | Origin; idempoten jika sudah logout | `{}` | `null`; revoke sesi server dan hapus cookie |
| `GET /api/auth/session` | Publik | — | `{user: User\|null}`; sesi hilang/expired menghasilkan null, tidak membocorkan token |
| `GET /api/admin/me` | Admin | — | `User` miliknya |
| `PATCH /api/admin/me` | Admin + Origin | `{name}` | `User` miliknya; email read-only dan role ditolak |

Validasi aktual: nama trim 2–100 karakter; email trim/lowercase, format valid/unik dan maksimum 254 karakter; password minimal 8 karakter Unicode dan maksimum **72 byte UTF-8**, konfirmasi sama. Field tambahan (termasuk role/id/gender/avatar/alamat) ditolak dengan 422. Password tidak ditrim atau dilog. Logout membutuhkan JSON `{}` dan Origin valid; setelah respons 200, replay token lama tidak memulihkan sesi. Cookie duplicate/malformed tidak diterima. GET user tanpa sesi menghasilkan null; GET/PATCH admin tanpa sesi 401 dan pembeli 403. PATCH admin tidak menerima target akun dan hanya mengubah nama dari ID sesi.

### Kategori, produk, stok, foto — TERSEDIA BE-04

| Metode/path | Akses | Input/query | `data` berhasil |
|---|---|---|---|
| `GET /api/categories` | Publik | pagination | `Category[]` kategori aktif; productCount hanya produk aktif |
| `GET /api/products` | Publik | pagination, `categoryId?` | `Product[]` produk dan kategori aktif; stok 0 tampil OUT_OF_STOCK |
| `GET /api/products/{productId}` | Publik | — | `Product`; nonaktif/parent kategori nonaktif menghasilkan 404 |
| `GET /api/admin/categories` | Admin | pagination, `q?, isActive?` | `Category[]` |
| `POST /api/admin/categories` | Admin + Origin | `{name,isActive}` | 201 `Category` |
| `PATCH /api/admin/categories/{categoryId}` | Admin + Origin | subset nonkosong `{name?,isActive?}` | `Category` |
| `DELETE /api/admin/categories/{categoryId}` | Admin + Origin | `{}` | `null`; 409 jika kategori masih dipakai |
| `GET /api/admin/products` | Admin | pagination, `q?, categoryId?, isActive?, availability?` | `Product[]` dengan field stok admin |
| `GET /api/admin/products/{productId}` | Admin | — | `Product` termasuk nonaktif dan field stok/foto admin |
| `POST /api/admin/products` | Admin + Origin | `{categoryId,name,description,price,physicalStock,isActive,photoId?}` | 201 `Product` |
| `PATCH /api/admin/products/{productId}` | Admin + Origin | subset nonkosong field di atas, **tanpa physicalStock** | `Product`; nonaktifkan dengan `isActive:false`, tanpa DELETE produk rutin |
| `PUT /api/admin/products/{productId}/stock` | Admin + Origin | `{physicalStock,expectedUpdatedAt}` | `Product`; stok fisik tidak boleh kurang dari reservasi, 409 jika versi berubah |
| `POST /api/admin/product-photos` | Admin + Origin | tepat satu multipart `file`: JPEG/PNG/WebP <=2.000.000 byte | 201 `{photoId,url}`; isi/MIME diperiksa, decode/re-encode WebP, key server |
| `GET /api/product-photos/{photoId}` | Publik jika dipakai produk/kategori aktif; admin dapat preview pending/nonaktif | — | binary image/webp, nosniff/no-store/Vary Cookie; 404 untuk asset yang tidak terlihat |

`price` Rupiah integer positif, stok integer >=0, keduanya <=2.147.483.647. `reservedStock`, `isDemo`, `photoKey` dan `imageUrl` tidak diterima dari browser. Nama kategori 1–100, nama produk 1–150, deskripsi 1–5.000 karakter setelah trim. photoId opsional/null dan harus merujuk metadata tersimpan; null melepas foto. Foto belum tersedia menghasilkan imageUrl null. Produk historis tetap dinonaktifkan, kategori terpakai 409 RESOURCE_IN_USE. Stok baru <reservasi ditolak 409 STOCK_RESERVED; versi stale 409 RESOURCE_VERSION_CONFLICT. Uji ulang dengan alur BE-07 tetap diperlukan. Search q hanya admin pada P0. Storage lokal privat tersedia; deployment foto wajib path absolute volume persisten dan flag konfigurasi eksplisit, tanpa fallback ephemeral. Rincian [CATALOG.md](CATALOG.md).

### Alamat dan keranjang — TERSEDIA BE-05; pembacaan voucher BE-06 tersedia

| Metode/path | Akses | Input | `data` berhasil |
|---|---|---|---|
| `GET /api/addresses` | Pembeli | pagination | `Address[]` milik sendiri |
| `POST /api/addresses` | Pembeli + Origin | field Address tanpa id; postalCode/notes opsional | 201 `Address` |
| `PATCH /api/addresses/{addressId}` | Pembeli pemilik + Origin | subset nonkosong field alamat | `Address` |
| `DELETE /api/addresses/{addressId}` | Pembeli pemilik + Origin | `{}` | `null`, snapshot pesanan tidak berubah |
| `GET /api/cart` | Pembeli | — | `Cart`; kosong `items:[]`, subtotal 0 |
| `POST /api/cart/items` | Pembeli + Origin | `{productId,quantity}` | 201 `Cart`; tambah quantity ke baris produk yang sudah ada |
| `PATCH /api/cart/items/{cartItemId}` | Pembeli pemilik + Origin | `{quantity}` | `Cart`; mengganti jumlah absolut, >0 |
| `DELETE /api/cart/items/{cartItemId}` | Pembeli pemilik + Origin | `{}` | `null`; kemudian GET cart, penghapusan tetap bisa dilakukan saat subtotal melampaui batas |
| `GET /api/me/voucher` | Pembeli | — | `{voucher: Voucher\|null}` milik akun sesi; tidak menerbitkan atau menghabiskan voucher lewat GET |

Alamat membutuhkan penerima, telepon string (menjaga tanda +/nol depan), alamat lengkap, kota/kabupaten dan provinsi. BE-07 membatasi checkout ke Kota Tanjungpinang, Kepulauan Riau; tidak mewajibkan kode pos untuk cakupan awal seluruh kota. Keranjang memeriksa aktif/stok tetapi **tidak mereservasi**; reservasi baru saat order commit. Aturan voucher otomatis: 20% maksimal Rp100.000 tanpa minimum tambahan dan tanpa penumpukan; status USED hanya sesudah sukses terverifikasi pada BE-09. O-10 ditutup: diskon dibulatkan ke bawah sekali pada subtotal seluruh barang, tidak termasuk ongkir.

Alamat dan item asing/tidak ditemukan sama-sama 404; admin 403. Semua respons privat Vary Cookie. POST/PATCH cart memeriksa jumlah akhir dan stok tersedia; 409 PRODUCT_UNAVAILABLE atau INSUFFICIENT_STOCK jika berubah. GET menampilkan harga terkini dan mempertahankan item tidak tersedia dengan isAvailable=false. Nominal di luar batas menghasilkan 409 CART_TOTAL_LIMIT, mutasi di-rollback; DELETE tidak menghitung ulang subtotal. Batas field alamat, kondisi keranjang kosong dan pemilihan alamat dijelaskan di [BUYER.md](BUYER.md). Checkout keranjang kosong dan snapshot saat membuat order adalah BE-07.

Penerbitan/pembacaan voucher dan layanan harga diuji pada BE-06. priceBuyerCart mengambil harga/kelayakan dari database, menghitung min(floor(subtotal × 20 / 100), 100000) jika layak, lalu menambahkan ongkir eksplisit dari kebijakan server. Tanpa voucher layak diskon nol; subtotal kecil tidak ditolak karena diskon hasil pembulatannya nol. Perhitungan tidak mengubah stok/voucher. BE-07 memakai hasil ini untuk quote/order dan mengubah voucher menjadi RESERVED secara atomik dengan stok. Penggunaan/pelepasan tetap BE-09/BE-10. Rincian [VOUCHERS.md](VOUCHERS.md) dan [CHECKOUT.md](CHECKOUT.md).

### Checkout/order/Snap/webhook/rekonsiliasi — TERSEDIA BE-07 sampai BE-10

| Metode/path | Akses | Input | `data` berhasil |
|---|---|---|---|
| `POST /api/checkout/quote` | Pembeli + Origin | `{addressId}`; memakai seluruh item keranjang saat ini | 201 `CheckoutQuote`; TTL 5 menit, tidak membuat pesanan/reservasi |
| `POST /api/orders` | Pembeli + Origin | `{quoteId}`, wajib header `Idempotency-Key` | 201 `OrderDetail` baru; replay input sama dapat 200 dengan order sama |
| `POST /api/orders/{orderId}/payments` | Pembeli pemilik + Origin | `{}` | 201 `PaymentInstruction` token baru, 200 reuse token aktif, 202 CREATED/UNCONFIRMED tanpa token; tidak ada request provider baru saat attempt lama belum pasti |
| `POST /api/orders/{orderId}/payments/reconcile` | Pemilik/admin + Origin + limiter | `{}` | `{order: OrderDetail, reconciledAt: timestamp}`; 503 jika sebagian status belum pasti, 429 jika dibatasi |
| `POST /api/webhooks/midtrans` | Provider | Payload Midtrans | `{accepted:true}` hanya setelah verifikasi dan perubahan tersimpan; duplicate aman 200 |

`Idempotency-Key` adalah string acak 16–128 karakter `[A-Za-z0-9_-]`, unik per akun di database dan terkait hash `{quoteId}`. Input sama/key sama menghasilkan order tersimpan meskipun quote expired/cart kosong; key sama/input berbeda 409 IDEMPOTENCY_CONFLICT. Quote yang sudah dipakai dengan key lain 409 QUOTE_ALREADY_USED. Key/hash disimpan sepanjang order disimpan tanpa cleanup otomatis. Order menyimpan snapshot item/alamat/total immutable, deadline 60 menit, reservasi stok/voucher dan mengeluarkan hanya item cart yang benar-benar dikonfirmasi. Hash/key/ownerId tidak masuk DTO. Deadlock/serialization di-retry maksimum dua kali, lalu 503 CHECKOUT_BUSY dengan Retry-After 1.

Delivery manual awal hanya Kota Tanjungpinang, Kepulauan Riau, ongkir tetap Rp10.000 per pesanan; luar cakupan 422 DELIVERY_UNAVAILABLE. city menerima Tanjungpinang/Tanjung Pinang dengan awalan Kota opsional, province Kepulauan Riau, case/trim/spasi dinormalisasi. Tidak ada ongkir Rp0 atau minimum tambahan. Quote warnings meminta tinjau harga/alamat/ongkir/voucher terkini. POST /api/orders mengembalikan order AWAITING_PAYMENT; payments awal kosong. canPay mengikuti tenggat, token aktif atau seluruh attempt terminal dengan bukti; CREATED/UNCONFIRMED memblokir charge baru. canReconcile aktif bila ada attempt atau order menunggu sudah lewat tenggat. Replay order tidak membuat charge/reservasi baru atau memperpanjang deadline. Worker BE-10 memeriksa seluruh attempt sebelum release setelah deadline.

Snap BE-08 hanya Sandbox dengan item/discount/shipping dari snapshot order. Ref SV-UUID unik per attempt, expiresAt sama dengan paymentDeadline. CREATED disimpan sebelum satu POST jaringan, lalu PENDING jika token valid, UNCONFIRMED jika timeout/5xx/duplicate/response invalid. Penolakan request yang definitif dicatat FAILED/REJECTED dan memberi 502 MIDTRANS_REJECTED. Percobaan terminal tanpa bukti memberi 409 PAYMENT_RECONCILIATION_REQUIRED; seluruh attempt terminal dengan bukti dapat di-retry selama tenggat cukup. State lokal lewat expiry tidak membuka attempt baru. Sisa waktu <60 detik menolak pembuatan baru 409 PAYMENT_WINDOW_TOO_SHORT, order lewat tenggat 409 ORDER_PAYMENT_EXPIRED. Token existing tetap dapat dipakai ulang selama aktif/sebelum tenggat. Detail klasifikasi dan recovery [PAYMENTS.md](PAYMENTS.md).

Status internal PENDING berarti token siap, bukan sukses pembayaran. /payment/finish hanya halaman informasi; query order_id/transaction_status tidak diterapkan ke database. snapConfig memvalidasi dua key Sandbox dan URL lokal/HTTPS untuk pembuatan token, tanpa kewajiban webhook HTTPS. paymentConfig menambah validasi URL webhook untuk BE-09. Client key boleh dipakai frontend Snap nantinya; server key tidak pernah masuk DTO/browser/log.

Tidak menerima nominal, diskon, `isPaid`, status sukses, provider reference, atau voucher milik orang lain dalam input checkout/payment. Jika server/provider timeout setelah request Snap mungkin diterima, status UNCONFIRMED dan percobaan baru tetap diblokir sampai rekonsiliasi memastikan keadaan sebelumnya. Menutup popup atau redirect finish tidak mengubah status. Status checkout/pembayaran bukan label aktif/nonaktif produk.

Webhook input minimum: `order_id, transaction_id, status_code, gross_amount, transaction_status, signature_key`, opsional `fraud_status, payment_type, transaction_time, settlement_time`; provider dapat memiliki field tambahan sehingga schema webhook harus mengizinkannya sesuai dokumentasi provider tanpa mempublikasikan payload. Signature SHA512 diverifikasi server; referensi, ID transaksi, nominal/currency, dan Get Status terbaru dicocokkan. Token/URL Snap hanya untuk pemilik pembayaran, tidak masuk log atau respons daftar admin umum.

Gangguan provider/DB tidak mengakui sukses sebelum tersimpan. Rekonsiliasi BE-10 memakai service penerapan BE-09; sesi pemilik/admin dan Origin wajib, maksimal 20 pemeriksaan/akun/15 menit serta 1/order/30 detik pada jendela tetap. 429 menyertakan Retry-After; status belum pasti memberi 503 PAYMENT_RECONCILIATION_UNCONFIRMED, Retry-After 30, dan menahan reservasi. Seluruh attempt diperiksa; sukses attempt lain tetap dicatat walau satu lookup gagal. Worker CLI Windows Task Scheduler berjalan tiap menit tanpa endpoint cron publik. Rincian [RECONCILIATION.md](RECONCILIATION.md).

Retry BE-10 tersedia hanya jika semua attempt sebelumnya terminal dengan bukti atau penolakan Snap definitif; token pending aktif tetap dipakai ulang. canPay mengikuti bukti ini, canReconcile true bila ada attempt atau order menunggu sudah lewat tenggat. Deadline tidak melepas stok sendiri: release atomik memerlukan seluruh attempt dipastikan tidak aktif. Order tanpa attempt dapat dilepas setelah tenggat. O-01/O-02 tetap 60 menit dari order dibuat dan ongkir Rp10.000; retry tidak memperpanjang expiry. Core API legacy tanpa currency mengikuti kontrak IDR; currency eksplisit salah ditolak.

### Pesanan — BE-11 Selesai backend, PostgreSQL/HTTP terisolasi lulus

| Metode/path | Akses | Input/query | `data` berhasil |
|---|---|---|---|
| `GET /api/orders` | Pembeli | pagination, `status?` | `OrderSummary[]` miliknya |
| `GET /api/orders/{orderId}` | Pemilik/admin | — | `OrderDetail` dengan data sesuai izin; tidak memanggil Midtrans |
| `GET /api/admin/orders` | Admin | pagination, `q?, status?, paymentStatus?, channel?, from?, to?` | `(OrderSummary & {buyer:{id,name}})[]` |
| `GET /api/admin/orders/{orderId}` | Admin | — | `OrderDetail` termasuk catatan internal dan pelaku admin |
| `PATCH /api/admin/orders/{orderId}/status` | Admin + Origin | `{status,expectedStatus,note?,receiptConfirmed?}` | `OrderDetail`; PROCESSING → SHIPPED → COMPLETED. COMPLETED wajib receiptConfirmed=true dan note konfirmasi manual |
| `POST /api/admin/orders/{orderId}/notes` | Admin + Origin | `{note}` | 201 `OrderDetail`; catatan penanganan tidak mengubah total/status pembayaran |
| `GET /api/admin/payments` | Admin | pagination, `status?, orderId?, channel?, from?, to?` | `(PaymentSummary & {orderId,orderNumber})[]`; bukan tombol sukses manual |

GET tidak memanggil provider. Catatan admin hanya untuk admin; pembeli melihat transisi status tanpa catatan bebas/pelaku admin. Status pembayaran ringkas memprioritaskan REVERSED, REFUNDED, PARTIALLY_REFUNDED, SUCCESS, lalu attempt terbaru; `paymentStatuses` dan `channels` mempertahankan semua nilai berbeda. Filter status pembayaran dan kanal harus cocok pada attempt yang sama; filter dapat cocok attempt historis yang berbeda dari status ringkas. Mutasi status membutuhkan pembayaran sukses yang telah diterapkan dan reservasi CONSUMED, menolak attempt lain yang aktif/sukses/refund/reversal. Catatan trim 1–1.000 karakter, field tambahan dan query duplikat ditolak. Lihat [ORDERS.md](ORDERS.md) untuk guard dan verifikasi tertunda.

### Ulasan — BE-12 Selesai backend, PostgreSQL/HTTP terisolasi lulus

| Metode/path | Akses | Input/query | `data` berhasil |
|---|---|---|---|
| `GET /api/products/{productId}/reviews` | Publik | pagination | `Review[]` identitas aman; meta.pagination dan meta.ratingSummary:{averageRating,reviewCount} dari seluruh ulasan produk |
| `POST /api/order-items/{orderItemId}/review` | Pembeli pemilik + Origin | `{rating,comment}` | 201 `Review`; server menurunkan produk/pembeli dari item |

Filter tanggal admin memakai timestamp UTC `from` inklusif dan `to` eksklusif, `from < to`. Status admin hanya transisi pemenuhan; tidak boleh memaksa pembayaran sukses, mengubah snapshot total atau menghapus order. NEEDS_ATTENTION memerlukan penanganan dan catatan; belum ada alur refund otomatis.

O-05 disetujui pengguna: rating integer 1–5, komentar trim 10–1.000 karakter (panjang UTF-16) dan satu ulasan per item. Submit memeriksa ulang pemilik/status COMPLETED setelah lock User → Order; produk/pembeli berasal dari relasi item, field tambahan ditolak. Ulasan ganda 409 REVIEW_EXISTS, belum Selesai 409 ORDER_NOT_COMPLETED, item asing 404. Unique constraint sebagai pengaman konkurensi belum diuji runtime dalam BE-12. Pembelian berbeda boleh mengulas produk yang sama. Produk/kategori nonaktif tidak tersedia pada daftar publik; produk tanpa ulasan menghasilkan averageRating=null/count=0. Nama tampilan publik, tanpa identitas akun/pesanan; render komentar sebagai teks. Rata-rata katalog tetap memakai agregasi Rating yang sama. Ulasan tersimpan tidak otomatis dihapus ketika refund terjadi kemudian; tidak ada edit/hapus/moderasi P1. Detail dan bukti tertunda: [REVIEWS.md](REVIEWS.md).

### Dashboard dan voucher admin — BE-13 Selesai backend, PostgreSQL/HTTP terisolasi lulus

| Metode/path | Akses | Input/query | `data` berhasil |
|---|---|---|---|
| `GET /api/admin/dashboard` | Admin | `from, to` wajib UTC; from inklusif, to eksklusif | `{period:{from,to}, activeProductCount, orderCount, ordersByStatus:{status,count}[], latestOrders:OrderSummary[], inventoryScope:CURRENT_ALL_PRODUCTS, lowStockThreshold:5, listLimit:10, lowStockCount, outOfStockCount, lowStockProducts:StockSummary[], outOfStockProducts:StockSummary[]}` |
| `GET /api/admin/vouchers` | Admin | pagination, `status?` AVAILABLE/RESERVED/USED | `(Voucher & {createdAt,usedOrderId:string\|null,owner:{id,name},reservedOrder:{id,number}\|null,usedOrder:{id,number}\|null,orderNumber:string\|null})[]` |
| `GET /api/admin/voucher-policy` | Admin | — | `{type:NEW_BUYER,percentage:20,maxDiscount:100000,oncePerAccount:true}` |

Dashboard membaca data tersimpan dalam satu transaksi RepeatableRead. Total/status/pesanan terbaru memakai order.createdAt pada rentang yang sama; kelompok status lengkap termasuk nol. Produk aktif dihitung dari isActive, termasuk stok nol dan kategori nonaktif. Inventaris saat ini mencakup seluruh produk termasuk nonaktif; tersedia = fisik − reservasi, menipis 1–5, habis 0. StockSummary memuat `id,name,isActive,isDemo,physicalStock,reservedStock,availableStock`. Daftar stok dan pesanan terbaru maksimal 10, jumlah stok tetap penuh; gunakan katalog admin berhalaman untuk sisanya. Voucher hanya membaca status/relasi database dan tidak mengubah kelayakan atau melepas reservasi. Tidak ada grafik dummy, metrik pelanggan/nilai pembayaran tambahan, laporan laba, CRUD promo, minimum belanja baru atau reset voucher. Detail dan bukti tertunda: [DASHBOARD.md](DASHBOARD.md).

## 5. Status aplikasi

Enum dan label tersedia di `src/lib/contracts/status.ts`. Pemetaan provider/penerapan pembayaran BE-09 tersedia; transisi pemenuhan admin BE-11 tersedia pada kode/mock dengan penerimaan PostgreSQL tertunda. Detail guard: [WEBHOOKS.md](WEBHOOKS.md), [ORDERS.md](ORDERS.md).

| OrderStatus | Label |
|---|---|
| `AWAITING_PAYMENT` | Menunggu Pembayaran |
| `PROCESSING` | Diproses |
| `SHIPPED` | Dikirim |
| `COMPLETED` | Selesai |
| `EXPIRED` | Kedaluwarsa |
| `NEEDS_ATTENTION` | Perlu Penanganan |

| PaymentStatus | Makna |
|---|---|
| `CREATED` | Percobaan lokal, instruksi belum dipastikan |
| `PENDING` | Instruksi provider tersedia, masih menunggu |
| `UNCONFIRMED` | Hasil belum pasti/unknown/timeout; bukan gagal |
| `SUCCESS` | Sukses terverifikasi server |
| `FAILED` | Penolakan/kegagalan terverifikasi |
| `CANCELLED` | Pembatalan terverifikasi provider |
| `EXPIRED` | Provider memastikan tidak lagi bisa dibayar |
| `REFUNDED`, `PARTIALLY_REFUNDED`, `REVERSED` | Keadaan sebenarnya setelah sukses; pesanan Perlu Penanganan, stok/voucher tidak dibalik otomatis |

Status asing provider tidak dipaksa menjadi SUCCESS/FAILED; status mentah disimpan internal dan dijadwalkan rekonsiliasi. Callback lama tidak menurunkan sukses; reversal terbaru yang terverifikasi dicatat. Order EXPIRED hanya setelah seluruh percobaan dipastikan tidak bisa dibayar. Pembayaran terlambat setelah reservasi lepas dan pembayaran sukses ganda ditandai NEEDS_ATTENTION; efek stok/voucher/order hanya sekali lintas percobaan.

## 6. Bukti verifikasi dan fitur yang ditunda

BE-10 selesai: **50 tes unit/fondasi + 108 tes PostgreSQL**, lint/typecheck/build, HTTP rekonsiliasi dan regresi webhook lulus. CLI worker berhasil pada dev kosong; Task Scheduler lokal aktif tiap menit dan tick otomatis 23 Oktober 2026 05:02:38 WIB selesai/LastTaskResult 0. Tidak ada pembayaran provider yang dilakukan oleh uji ini. Hosting demo dan bukti VA lunas tetap terbuka. Detail bukti/batas operasi [RECONCILIATION.md](RECONCILIATION.md).

BE-09 backend selesai: **50 tes unit/fondasi + 93 tes PostgreSQL**, lint/typecheck/build dan HTTP webhook guards lulus. Probe HTTPS sementara menolak signature palsu (403) dan path lain (404), serta token Sandbox nyata dengan override notifikasi berhasil dibuat. Pengguna menunda simulasi VA; pembayaran lunas dan webhook sukses provider belum dibuktikan pada Salvora. Tunnel sudah dihentikan; O-06 tetap terbuka. Bukti, retensi fixture dan batas kompatibilitas currency [WEBHOOKS.md](WEBHOOKS.md).

BE-08 selesai: **46 tes unit/fondasi + 77 tes PostgreSQL**, lint/typecheck/build, HTTP buyer/checkout/payment guards/finish dan smoke fondasi lulus. Provider double terpisah dari bukti nyata: HTTP 201/token Snap Sandbox berhasil pada 23 Oktober 2026 03:01:32 WIB, order test Rp14.000. Token disimpan privat, belum memilih/membayar VA atau menerima webhook. Detail dan retensi fixture [PAYMENTS.md](PAYMENTS.md).

BE-07 selesai: **40 tes unit/fondasi + 65 tes PostgreSQL**, lint/typecheck/build, HTTP pembeli/checkout dan smoke fondasi lulus. Kasus meliputi idempotensi/quote berubah atau expired, region/role/Origin/owner, last-unit dua pembeli, satu voucher satu order aktif, rollback setelah reservasi, cart berlomba dengan konfirmasi dan snapshot/deadline. Rincian [CHECKOUT.md](CHECKOUT.md). Tidak ada merchant/provider/cron yang dijalankan oleh tes ini.

BE-06 selesai: 38 tes unit/fondasi + 51 tes PostgreSQL, lint/typecheck/build lulus. HTTP auth/voucher, katalog/foto, alamat/keranjang serta smoke fondasi lulus selama BE-06; rumus final/cap/pembulatan dibuktikan tes unit dan PostgreSQL. Rincian [VOUCHERS.md](VOUCHERS.md).

Bukti BE-05 sebelumnya: 31 tes unit/fondasi + 41 tes PostgreSQL lulus. Pemeriksaan mencakup guard DB legacy/test, error/DTO aman, validasi body/pagination, auth/sesi/Origin/peran, integritas transaksi penyimpanan, katalog/count/rating, admin CRUD, versi/lantai reservasi stok, input foto, kontrol akses file, ownership alamat/keranjang, penambahan bersamaan, perubahan harga/stok, nominal/rollback dan snapshot alamat. Production build dan HTTP pembeli/fondasi lulus pada BE-05; HTTP auth/katalog/foto lulus pada BE-04. Hasil aktual ada pada [TASKS-BACKEND.md](TASKS-BACKEND.md).

Migrasi 002 hanya menambah metadata foto/referensi tanpa menghapus data. Katalog/detail publik serta admin kategori/produk/stok/foto telah tersedia sesuai PRD 1.5. Penyimpanan/upload lokal sudah diuji; pemilihan dan ketahanan volume hosting belum diverifikasi. Frontend Figma lengkap, UAT browser dan target performa tetap tahap tersendiri.

BE-11–BE-14 diterima backend melalui PostgreSQL/HTTP/regresi/mock serta satu BNI VA Sandbox nyata Rp14.000 settlement, verified webhook dan GET status cocok. PaymentApplication/transisi/stok/voucher tepat sekali; proof privat unik, fixture lama tetap. Tick antrean kosong dan fresh DB migration/seed/restore terbukti. Hosting/job server/volume foto/UI belum diterima; endpoint HTTPS sementara sudah ditutup dan .env tidak diubah. Mock/token/redirect saja bukan bukti provider. Catatan mismatch retensi regresi pertama tetap historis, tidak diklaim pulih. Tidak ada COD, transfer manual, langganan, promo umum, pickup atau gratis ongkir bersyarat.
