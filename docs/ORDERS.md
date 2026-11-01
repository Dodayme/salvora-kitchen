# BE-11 — Riwayat, detail dan pemenuhan pesanan

Frontend FE-10 (25 Oktober 2026) memakai kontrak di bawah tanpa mengubah service. Daftar/detail admin, attempt pembayaran, note privat dan konfirmasi fulfillment telah diimplementasikan; status Ditinjau karena browser belum terbukti. [FE10-ORDERS-VERIFICATION.md](FE10-ORDERS-VERIFICATION.md) mencatat 415 unit/regresi, tujuh kelompok HTTP/test DB, fixture sintetis, cleanup 18 tabel dan checkpoint browser yang belum lulus.

Status terbaru 23 Oktober 2026: **Selesai untuk backend**. Bukti 19-suite PostgreSQL dan 7 kelompok HTTP Next.js nyata mencakup owner/admin, snapshot, history, konfirmasi, rollback/konkurensi dan privasi; regresi pembayaran/integritas 108 lulus. Cluster 55433 dan dua tick antrean kosong sudah terverifikasi, tanpa perubahan task pada rekonsiliasi. Rincian dan keterbatasan BE-14: [BE14-RECONCILIATION.md](BE14-RECONCILIATION.md). Kontrak perilaku BE-11 di bawah tetap berlaku; statistik tes dan gap pada bagian verifikasi awal adalah histori sebelum pemulihan, bukan klaim pengujian masih belum dilakukan.

## Endpoint dan akses

| Endpoint | Akses dan perilaku |
|---|---|
| GET /api/orders | BUYER, hanya pesanan sendiri; status dan pagination |
| GET /api/orders/{orderId} | Pemilik atau ADMIN; asing/tidak ada 404 |
| GET /api/admin/orders | ADMIN; nomor pesanan q, status, paymentStatus, channel, from, to dan pagination |
| GET /api/admin/orders/{orderId} | ADMIN; detail termasuk catatan internal dan pelaku |
| GET /api/admin/payments | ADMIN; daftar attempt dengan status, orderId, channel, from, to dan pagination |
| PATCH /api/admin/orders/{orderId}/status | ADMIN + Origin; transisi pemenuhan saja |
| POST /api/admin/orders/{orderId}/notes | ADMIN + Origin; 201 detail setelah catatan tersimpan |

Pagination menggunakan page/pageSize (bawaan 1/20, maksimal 100 per halaman). Query duplikat, field asing dan enum/tanggal invalid ditolak. Rentang UTC from inklusif, to eksklusif; jika keduanya ada harus from < to. Tanggal daftar order berdasarkan order.createdAt; daftar pembayaran berdasarkan payment.createdAt. Kanal cocok persis; q mencari nomor pesanan tanpa membedakan huruf besar/kecil. Bila paymentStatus dan channel diberikan, keduanya harus cocok pada attempt yang sama. Daftar menggunakan transaksi RepeatableRead untuk pasangan count dan baris.

## Snapshot dan privasi

Ringkasan menampilkan nomor, tanggal, total, jumlah unit, nama/kuantitas item historis, status order dan pembayaran terpisah. paymentStatus ringkas memprioritaskan REVERSED → REFUNDED → PARTIALLY_REFUNDED → SUCCESS, lalu attempt terbaru; channel mengikuti attempt tersebut. paymentStatuses dan channels memuat semua nilai berbeda. Filter admin dapat cocok attempt historis berbeda dari status ringkas; frontend harus menampilkan label filter dan detail attempt agar tidak menganggap ringkasan sebagai satu-satunya attempt.

Detail memakai snapshot item, alamat, nominal, diskon dan ongkir order, tanpa menghitung ulang katalog atau alamat aktif. Token Snap, redirect URL, signature, raw event dan identitas transaksi provider tidak dikirim melalui DTO ini. PaymentSummary memakai whitelist field kontrak. Catatan bebas admin serta identitas pelaku admin hanya terlihat admin. Pembeli melihat transisi nyata admin dengan note=null; entri catatan internal (status tetap) disembunyikan. Riwayat sistem tetap terlihat. Respons no-store dan Vary: Cookie.

GET tidak memanggil Midtrans atau merekonsiliasi status. canPay/canReview adalah petunjuk untuk pembeli, bukan otorisasi mutasi; endpoint pembayaran/ulasan wajib memvalidasi ulang. canReview hanya saat COMPLETED dan item belum memiliki ulasan; endpoint ulasan tetap BE-12.

## Pemenuhan dan konfirmasi penerimaan

Permintaan kirim:

```json
{"status":"SHIPPED","expectedStatus":"PROCESSING","note":"Diserahkan ke petugas delivery manual."}
```

Permintaan selesai, setelah admin mendapat konfirmasi penerimaan melalui komunikasi manual:

```json
{"status":"COMPLETED","expectedStatus":"SHIPPED","receiptConfirmed":true,"note":"Penerimaan telah dikonfirmasi melalui komunikasi manual."}
```

Aturan konfirmasi manual disetujui pengguna pada BE-11. Tidak ada penyelesaian otomatis. Note trim 1–1.000 karakter wajib saat COMPLETED; karakter kontrol ditolak. receiptConfirmed hanya boleh dikirim untuk COMPLETED. Riwayat menyimpan pelaku admin, waktu database dan catatan dengan penanda konfirmasi penerimaan. Flag menyatakan tindakan admin; server tidak membuktikan percakapan di luar aplikasi.

Guard membutuhkan PaymentApplication yang cocok dengan pembayaran SUCCESS, identitas transaksi provider tersedia, nominal/currency cocok dan paidAt tidak melewati deadline. Seluruh item harus berreservasi CONSUMED. Attempt lain CREATED/PENDING/UNCONFIRMED/SUCCESS/REFUNDED/PARTIALLY_REFUNDED/REVERSED memblokir pemenuhan. NEEDS_ATTENTION, belum dibayar, transisi melompat/mundur serta expectedStatus usang ditolak; tidak ada tombol sukses pembayaran manual.

Service mengunci User → Order sesuai urutan service pembayaran, memeriksa kondisi di dalam transaksi, memperbarui status secara kondisional dan mencatat riwayat dalam transaksi yang sama. Deadlock/serialization mendapat retry terbatas lalu 503 ORDER_BUSY. Rancangan ini belum menjadi bukti konkurensi PostgreSQL. Status usang memberi 409 ORDER_STATUS_CONFLICT; transisi ilegal 409 ORDER_TRANSITION_INVALID; bukti pembayaran belum layak 409 ORDER_PAYMENT_NOT_FULFILLABLE; konfirmasi kurang 422 RECEIPT_CONFIRMATION_REQUIRED.

Catatan internal dapat ditambahkan pada NEEDS_ATTENTION dan status lain. Catatan memakai riwayat dengan fromStatus=toStatus, tanpa mengubah status, total, pembayaran, stok atau voucher. Tidak ada refund otomatis, penghapusan order, ekspor atau integrasi kurir baru. Tidak ada migrasi maupun dependensi baru.

## Verifikasi dan pekerjaan tertunda

Perintah yang telah lulus tanpa menjalankan worker atau memanggil gateway:

- npm.cmd test — 75 tes dalam 10 berkas; 20 tes BE-11.
- npm.cmd run typecheck — lulus.
- npm.cmd run lint — lulus.
- npm.cmd run build — lulus, termasuk route BE-11.

Tes BE-11 mencakup validasi, role/owner/Origin, pagination/filter, whitelist DTO, privasi catatan, snapshot, transisi/expectedStatus, bukti penerapan, reservasi, refund/attempt aktif, konfirmasi dan pencatatan pelaku. Prisma serta handler menggunakan mock. Callback mock transaksi tidak membuktikan atomicity, rollback atau lock database.

Sebelum BE-11 ditutup, jalankan pada database pengujian terisolasi setelah pemulihan disetujui secara terpisah: akses lintas akun melalui HTTP; snapshot setelah perubahan katalog/alamat; rollback bila pencatatan riwayat gagal; dua mutasi status bersamaan; race webhook/refund dengan admin; catatan bersamaan; serta regresi checkout/pembayaran. Gunakan gateway mock dan fixture khusus yang dibersihkan secara terarah, tanpa data/transaksi nyata. Pengujian itu belum dijalankan dalam pengerjaan BE-11 ini.

Tidak menyalakan cluster, mengubah task/interval, menjalankan worker manual, memanggil gateway atau memigrasi data. Port 5432 bukan pengganti. Panduan pemulihan dan batas bukti operasional tetap pada PAYMENT-WORKER-DIAGNOSTICS.md.
