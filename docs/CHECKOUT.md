# Checkout, pesanan dan reservasi — BE-07

Status: **Selesai untuk backend BE-07**, PRD 1.7 FR-06, bagian 9–11/13. Tidak ada perubahan kode/database LanggananKu, migrasi, dependensi baru atau fitur di luar PRD.

## Keputusan dan endpoint

Batas pembayaran **60 menit sejak order dibuat**, dipilih pengguna. StockReservation.expiresAt sama persis dengan Order.paymentDeadline; replay tidak memperpanjangnya. Midtrans BE-08 wajib memakai sisa tenggat order ini, bukan memulai 60 menit baru. PAYMENT_EXPIRY_MINUTES pada konfigurasi pembayaran harus 60; nilai berbeda ditolak. Checkout sendiri tidak membutuhkan key Midtrans.

Delivery awal: **Kota Tanjungpinang, Kepulauan Riau**, ongkir **Rp10.000 per pesanan**, delivery manual. Cakupan kota dinyatakan saat tindak lanjut jawaban pengguna tentang Tanjungpinang dan ongkir awal 10k. Kebijakan menguji city dan province, bukan menebak kecamatan dari addressLine. city menerima Tanjungpinang/Tanjung Pinang dengan awalan Kota opsional, province Kepulauan Riau; NFKC, trim, spasi berulang dan kapitalisasi dinormalisasi. Tidak menerima province Riau atau kota lain. Alamat luar cakupan tetap boleh disimpan tetapi quote/order ditolak 422 DELIVERY_UNAVAILABLE. Tidak ada pickup, tarif dinamis, subsidi/gratis ongkir atau klaim verifikasi alamat fisik/geocoding.

| Endpoint | Input | Berhasil |
|---|---|---|
| POST /api/checkout/quote | `{addressId}` milik akun sesi | 201 CheckoutQuote, harga terkini dan ongkir tertera |
| POST /api/orders | `{quoteId}` milik akun sesi; header Idempotency-Key 16–128 karakter A–Z/a–z/0–9/underscore/hyphen | 201 OrderDetail baru; replay 200 order sama |

Keduanya hanya BUYER dari sesi server, Origin tepat sama wajib, JSON strict maksimal 65.536 byte. Field harga/status/userId/voucherId dari browser ditolak 422. Respons sukses/error no-store/Vary Cookie. Anonymous 401, admin 403, referensi alamat/quote asing atau hilang sama-sama 404. Tidak ada GET order/riwayat BE-11 atau endpoint pembayaran BE-08/BE-09 pada task ini; GET /api/orders sekarang 405.

## Quote dan peninjauan ulang

Quote memakai seluruh cart saat ini. Snapshot transaksi RepeatableRead memuat alamat, item/name/harga/quantity/subtotal, voucher kandidat, diskon floor 20% maksimum Rp100.000, ongkir, total, versi kebijakan delivery dan durasi pembayaran. Quote disimpan server selama **5 menit** (pilihan teknis TTL peninjauan), bukan reservasi. createdAt/expiresAt dan tenggat order memakai jam database. Quote memberi warning untuk meninjau harga/alamat/voucher/ongkir terkini; cart tidak menyimpan harga historis sehingga tidak mengarang selisih harga sebelum quote.

Konfirmasi membangun ulang snapshot dari database di bawah lock. Hash SHA-256 memakai canonical JSON dengan key object terurut karena PostgreSQL JSONB mengubah urutan key; urutan array item ditentukan cartItemId. Hash juga mengikat addressId, cartItemId, voucher dan kebijakan, bukan hanya total. Perubahan alamat, nama/harga, isi/jumlah cart, kelayakan voucher atau kebijakan menghasilkan 409 CHECKOUT_CHANGED: frontend meminta quote baru dan menampilkan ulang sebelum konfirmasi. Stok tidak cukup/produk nonaktif ditolak 409 INSUFFICIENT_STOCK/PRODUCT_UNAVAILABLE. Stok boleh berubah jika jumlah masih mencukupi dan breakdown yang ditinjau tetap sama. Keranjang kosong 409 CART_EMPTY, quote lewat TTL 409 QUOTE_EXPIRED, tanpa membuat order.

## Transaksi konfirmasi dan idempotensi

Urutan lock: User pemilik terlebih dahulu (sama dengan auth/cart BE-05/BE-06), Address milik akun shared, Product sorted id exclusive, Category sorted id shared, lalu Discount milik akun exclusive. Product/category/discount tetap terkunci sampai commit. Service membaca quote sendiri, memeriksa TTL lagi setelah menunggu lock, dan menghitung ulang dengan READ COMMITTED agar transaksi yang menunggu stok melihat reservasi yang baru commit. Deadlock/serialization PostgreSQL di-retry maksimum dua kali dalam transaksi baru; jika tetap konflik, 503 CHECKOUT_BUSY/Retry-After 1. Tidak mengulang efek eksternal karena tidak ada panggilan provider di transaksi ini.

Dalam satu commit:

1. Buat order AWAITING_PAYMENT dengan nomor SK-tanggal-UUID, identitas pemilik/key/hash, snapshot alamat/item/harga/total immutable dan deadline 60 menit.
2. Buat StockReservation RESERVED per OrderItem dengan deadline sama. Naikkan reservedStock secara atomik dengan syarat stok tersedia mencukupi; physicalStock tetap. updatedAt produk meningkat sehingga edit stok admin berbasis versi juga mendeteksi perubahan reservasi.
3. Jika ada voucher kandidat, ubah AVAILABLE → RESERVED dan ikat reservedOrderId; tidak mengubah usedAt atau isFirstPurchase. Pesanan tanpa voucher tidak mengubah data voucher.
4. Catat history awal SYSTEM, hapus hanya cartItemId/quantity milik akun yang telah dikonfirmasi. Lock User mencegah mutasi cart terpotong bersamaan. Jika cart berubah sebelum lock, snapshot berbeda dan tidak ada item yang dibuang.

Kegagalan langkah apa pun me-rollback order/item/history, counter stok, reservasi, voucher serta penghapusan cart. Tidak ada pengurangan stok fisik atau status pembayaran sukses di sini.

Idempotency-Key unik per akun di database; inputHash order mengikat quoteId, terpisah dari hash ringkasan harga quote. Setelah commit, key sama/input sama mengembalikan order tersimpan meskipun cart kosong, quote expired atau alamat sudah dihapus. Key sama/input berbeda 409 IDEMPOTENCY_CONFLICT. Quote yang telah menghasilkan order tidak boleh dipakai dengan key baru (409 QUOTE_ALREADY_USED); periksa di bawah lock User. Key akun berbeda tidak membuka order akun lain. Request yang gagal sebelum commit tidak meninggalkan key parsial. Frontend menyimpan key yang sama untuk retry konfirmasi yang sama; konfirmasi quote baru memakai key baru.

Key/hash disimpan selama order disimpan, tanpa job penghapusan/TTL key pada BE-07. Quote expired belum dibersihkan otomatis; cleanup/retensi operasional dapat ditangani job terpisah tanpa menghilangkan key order. Replay membaca order/snapshot aktual, bukan menghitung harga katalog lagi atau mereservasi ulang. DTO tidak membocorkan inputHash/idempotencyKey, ownerId, token/digest atau snapshot JSON internal. Item/harga/alamat tetap sama setelah katalog/alamat berubah. Replay dapat menampilkan status/history order terbaru jika task berikutnya sudah mengubahnya.

## Verifikasi dan batas serah terima

**40 tes unit/fondasi + 65 tes PostgreSQL**, lint/typecheck dan production build lulus. Tambahan BE-07 menguji quote/TTL/tarif tanpa reservasi, deadline 60 menit, snapshot, role/owner/Origin, kosong/expired/luar wilayah, perubahan harga/alamat/cart/voucher, key scope/replay/mismatch, dua pembeli unit terakhir, satu voucher pada satu order aktif, order tanpa voucher, rollback setelah reservasi melalui kegagalan penghapusan cart, serta mutasi cart yang berlomba dengan konfirmasi.

HTTP hasil build dengan sesi login nyata lulus melalui `npm.cmd run test:http:buyer`: quote review/guard/owner, harga berubah → 409 → quote baru, order 201/replay 200, mismatch key, ongkir tetap, deadline persis, reservasi stok/voucher dan cart kosong. Fixture order/reservasi/history/akun dibersihkan spesifik di database test. `npm.cmd run test:http` memeriksa fondasi serta GET /api/orders 405. Tes tidak menggunakan database dev/LanggananKu, akun pribadi atau Midtrans.

BE-08 harus membuat/melanjutkan Snap dari snapshot order dan sisa deadline. Respons order sekarang payments kosong dan canPay/canReconcile false karena tindakannya belum tersedia. BE-09 menerapkan pembayaran sukses dan konsumsi reservasi atomik/idempoten; BE-10 melepas stok/voucher hanya setelah semua percobaan dipastikan tidak dapat dibayar. **Deadline tersimpan belum berarti reservasi dilepas otomatis**: scheduler/reconcile belum diimplementasikan, stok tetap dicadangkan hingga pelepasan yang aman tersedia. BE-11 menambahkan riwayat/detail baca dan pemenuhan; BE-12 ulasan. UI checkout/browser, merchant Sandbox, hosting/job dan UAT produk menyeluruh belum dibuktikan oleh BE-07.

Pembaruan BE-08: pembuatan/reuse Snap sudah tersedia dan token Sandbox nyata berhasil dibuat. Replay order kini menampilkan PaymentSummary tanpa token dan canPay konservatif untuk order awal/token aktif; canReconcile masih false. Detail [PAYMENTS.md](PAYMENTS.md). Pembayaran sukses/webhook/pelepasan otomatis tetap belum tersedia.
