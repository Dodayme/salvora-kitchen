# Snap Sandbox — BE-08

**Pembaruan frontend 25 Oktober 2026:** [FE-06](FE06-PAYMENT-VERIFICATION.md) menyediakan UI Snap Sandbox/status/reconcile/finish dengan 302 unit/regresi dan HTTP test kosong-key. Status **Ditinjau**, bukan penerimaan UI/provider nyata. Webhook HTTPS untuk proof baru belum valid dan transaksi FE-06 baru belum dibuat. Rincian BE-08 di bawah tetap histori backend; pembuktian BNI BE-14 juga tidak menggantikan uji UI FE-06.

**Bukti akhir BE-14 (24 Oktober 2026):** satu BNI VA Sandbox nyata Rp14.000 settlement terverifikasi melalui webhook, GET status dan SQL; application/stok/voucher tepat sekali. O-06 ditutup. Token-only proof BE-08 di bawah adalah histori, bukan lagi batas bukti terkini. Server/tunnel HTTPS uji telah ditutup, fixture/proof baru dipertahankan privat, key/.env/task tidak diubah. Rincian [BE14-RECONCILIATION.md](BE14-RECONCILIATION.md); bukan kesiapan pembayaran produksi/UI/deployment.

Catatan ini merekam hasil BE-08. Webhook/penerapan tersedia pada BE-09, dan rekonsiliasi/retry/release serta penjadwal lokal tersedia pada BE-10. Perilaku terbaru dan bukti aktual: [WEBHOOKS.md](WEBHOOKS.md) dan [RECONCILIATION.md](RECONCILIATION.md).

Status: **Selesai untuk pembuatan/melanjutkan Snap**, PRD 1.7 FR-07/14.1. Endpoint POST `/api/orders/{orderId}/payments` menerima JSON `{}` milik BUYER dari sesi, dengan Origin tepat sama. Anonymous 401, admin 403, order asing/hilang sama-sama 404. Field nominal/status/referensi/token dari browser ditolak 422. Respons no-store/Vary Cookie dan hanya berisi PaymentInstruction whitelist.

| Hasil | HTTP | Perilaku frontend |
|---|---|---|
| Token baru siap, status internal PENDING | 201 | Gunakan snapToken/redirectUrl yang dikembalikan |
| Token PENDING yang masih berlaku digunakan ulang | 200 | Buka token yang sama; jangan membuat referensi sendiri |
| CREATED sedang berjalan atau UNCONFIRMED | 202 | Token/URL null; tampilkan bahwa instruksi belum siap dan jangan membuat charge baru |
| Penolakan request definitif | 502 MIDTRANS_REJECTED | Periksa konfigurasi; retry aman hanya jika bukti penolakan tercatat |
| Percobaan lama perlu pemeriksaan provider | 409 PAYMENT_RECONCILIATION_REQUIRED | Tunggu rekonsiliasi BE-09/BE-10 |

PENDING di sini berarti token Snap berhasil dibuat, **bukan pembayaran terverifikasi**. Tidak ada perubahan Order.status, physicalStock, reservasi stok/voucher, usedAt atau isFirstPurchase akibat pembuatan token. PaymentApplication tidak dibuat. Halaman `/payment/finish` hanya informasi dan mengabaikan query status/referensi; redirect, menutup popup dan callback browser tidak dapat melunaskan order.

## Payload dan batas tenggat

Pola Basic Auth, timeout request dan format expiry diadaptasi setelah membaca ulang `LanggananKu/src/lib/midtrans/index.ts`. Implementasi baru memakai native fetch, URL Sandbox tetap dan payload snapshot order. Tidak menyalin konfigurasi, akun, sesi, Plan/Subscription atau aktivasi premium.

providerOrderId baru `SV-UUID` per percobaan, berbeda dari order.id/number. Payload berisi snapshot item/name/harga/quantity, baris diskon negatif, ongkir, serta gross_amount yang diverifikasi sama dengan jumlah item. ID baris unik dan nama dibatasi 50 karakter; pipe/control character dibersihkan pada salinan payload, tanpa mengubah snapshot order. Data pelanggan yang dikirim hanya nama penerima/telepon fixture atau snapshot, tanpa email; email token/reminder dinonaktifkan. Request membatasi kanal awal ke alias `bank_transfer`; kanal merchant tertentu tetap harus dibuktikan lewat uji pembayaran VA.

Expiry mengirim start_time **order.createdAt** dalam +0700 dan duration 60 menit, bukan waktu pembuatan percobaan atau pemilihan kanal. Format detik dapat berakhir <1 detik lebih awal, tidak memperpanjang deadline. Payment.expiresAt tetap persis Order.paymentDeadline. Tidak membuat percobaan baru jika sisa waktu kurang 60 detik (buffer teknis untuk minimum expiry provider dan request timeout), tetapi token aktif dapat dipakai ulang sampai tenggat. Guard tambahan sebelum HTTP menahan request jika waktu tinggal <20 detik. Order lewat deadline 409 ORDER_PAYMENT_EXPIRED; tidak otomatis melepaskan reservasi.

Payload mengikuti [objek JSON resmi Midtrans](https://docs.midtrans.com/reference/json-objects): jumlah item harus cocok dengan gross_amount, diskon boleh berupa baris negatif, dan expiry memiliki start_time. `enabled_payments` alias bank_transfer merujuk pilihan VA/transfer pada [dokumentasi Snap](https://docs.midtrans.com/docs/snap-advanced-feature). Keberhasilan membuat token tidak membuktikan seluruh kanal tersebut aktif di merchant.

Page expiry Snap tidak disamakan dengan bukti transaksi terminal. Implementasi memakai expiry metode pembayaran absolut, tanpa mengandalkan halaman tertutup/expired untuk release. Perbedaan page expiry dan payment expiry dijelaskan pada [Expire a Snap Session](https://docs.midtrans.com/reference/expire-a-snap-session). Parameter/provider state tetap diverifikasi pada BE-09/BE-10 sebelum stok/voucher dilepas.

## Durabilitas dan kegagalan

Transaksi awal mengunci User lalu Order, memeriksa pemilik/status/deadline dan reservasi item/voucher. Sebelum request jaringan, simpan Payment CREATED dan event SNAP_PREPARED lalu commit. Partial unique index BE-02 membatasi satu CREATED/PENDING/UNCONFIRMED per order. Request jaringan dilakukan di luar transaksi DB, **satu kali tanpa retry otomatis**, timeout 15 detik, body respons maksimal 65.536 byte dan HTTP redirect ditolak.

Klik bersamaan melihat record CREATED yang sudah persisten dan mendapat 202 untuk referensi sama; hanya pemilik request pertama menghubungi provider. Jika proses mati sebelum/kala/setelah provider menerima request atau penyimpanan token gagal, CREATED tetap memblokir percobaan baru. Tidak memakai expiry lokal untuk menganggap attempt hilang. GET Status/recovery belum diimplementasikan di BE-08.

Respons sukses hanya HTTP 201 dengan token UUID dan URL HTTPS origin app.sandbox.midtrans.com, path Snap yang cocok dengan token, tanpa credentials/query/hash. Hasil disimpan PENDING dengan token/URL dan event SNAP_TOKEN_CREATED, tanpa menyebut pembayaran VERIFIED. Finalisasi mengunci User → Order → Payment; respons terlambat tidak menurunkan SUCCESS/status terverifikasi task berikutnya.

Timeout/network, 5xx, 429, respons rusak/terlalu besar, URL tidak aman dan duplicate order_id menjadi UNCONFIRMED. Sebagian HTTP 400 dapat berarti referensi telah dipakai, sehingga tidak semua 4xx dianggap aman untuk retry. Hanya HTTP 401 berbentuk error provider dan HTTP 400 dengan pesan mismatch nominal yang persis dikenal ditandai FAILED dengan event REJECTED terkontrol. Referensi baru hanya diizinkan setelah bukti penolakan request tersebut; FAILED/CANCELLED/EXPIRED lain tetap membutuhkan rekonsiliasi. Klasifikasi konservatif mengacu pada [respons resmi Snap](https://docs.midtrans.com/reference/sample-response). Raw provider error/body/header tidak disimpan pada event atau dikirim ke browser.

## Konfigurasi lokal dan webhook

`snapConfig` / `npm.cmd run check:env -- --snap` memvalidasi key Sandbox Salvora, URL aplikasi, mode false dan PAYMENT_EXPIRY_MINUTES=60. URL lokal http://localhost/127.0.0.1 diperbolehkan untuk finish pada development; URL aplikasi production tetap HTTPS. Server key hanya di server; client key NEXT_PUBLIC_MIDTRANS_CLIENT_KEY adalah konfigurasi publik untuk integrasi Snap browser berikutnya, bukan autentikasi server. Tidak ada paket/konfigurasi fallback ke proyek lama.

`paymentConfig` / `--payment` memeriksa kesiapan webhook tambahan: URL aplikasi HTTPS dan MIDTRANS_WEBHOOK_URL sama dengan `${NEXT_PUBLIC_APP_URL}/api/webhooks/midtrans`. Ini masih menunggu endpoint publik BE-09; tidak menghalangi pembuatan token lokal. URL webhook berasal dari alamat HTTPS aplikasi yang benar-benar dapat dijangkau Midtrans, lalu dipasang pada Dashboard Sandbox. Pengguna belum perlu mengisi URL rekaan agar pemeriksaan lolos.

## Bukti aktual dan serah terima

**46 tes unit/fondasi + 77 tes PostgreSQL**, lint/typecheck/build dan HTTP pembeli/checkout/pembayaran/finish lulus. Tes adapter memakai fetch double, tes database memakai gateway double: membuktikan payload, timeout/error/URL, satu POST bersamaan, reuse, unknown, penolakan definitif, terminal tanpa bukti, expired lokal, kegagalan DB setelah respons, late success, deadline, owner/Origin/payload, 201/200/202 dan constraint aktif. Tes HTTP biasa sengaja mengosongkan key merchant pada child process sehingga tidak membuat transaksi Sandbox tanpa sengaja. Smoke fondasi tetap terpisah.

**Provider nyata:** pada 23 Oktober 2026 pukul 03:01:32 WIB (2026-10-22T20:01:32Z), `scripts/verify-midtrans-sandbox.mjs` berhasil memperoleh HTTP 201/token Snap Sandbox menggunakan key yang diisi pengguna. Order fixture khusus salvora_kitchen_test bernominal **Rp14.000** (barang Rp5.000 - voucher Rp1.000 + ongkir Rp10.000). Token/URL tersimpan pada Payment PENDING; tidak dicetak. Tidak membuka Snap, memilih/membayar VA, memanggil simulator, menerima webhook atau menerapkan pembayaran sukses.

Skrip nyata adalah opt-in `npm.cmd run test:midtrans:sandbox`, tidak menjadi bagian test default. Bukti aman tanpa key/token ada di `.local/midtrans-sandbox-proof.json` (ignored); berisi referensi fixture/attempt/status/waktu/nominal. Fixture yang berpotensi masih dapat dibayar sengaja **dipertahankan** untuk rekonsiliasi, bukan dihapus seolah transaksi tidak pernah ada. Rerun menggunakan order sama; terminal attempt memerlukan review eksplisit. Fixture ini tidak memakai akun pribadi/database dev/LanggananKu. Fixture double pada suite lainnya dibersihkan spesifik.

BE-09 masih perlu URL HTTPS publik, signature/referensi/nominal dan Get Status terbaru, serta penerapan sukses atomik/idempoten. BE-10 memerlukan job independen browser untuk unknown/retry/expiry/release aman. O-06 tetap terbuka untuk pembuktian minimal satu transfer bank/VA dibayar; token nyata saja belum menutup uji pembayaran atau UAT produk menyeluruh. Frontend Snap lengkap, hosting, scheduler dan release otomatis belum tersedia. Replay order kini memberi canPay sesuai kelayakan awal/token aktif, sementara CREATED/UNCONFIRMED serta percobaan historis tertutup memberi hint konservatif false; canReconcile tetap false sampai tindakannya tersedia.
