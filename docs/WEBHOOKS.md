# BE-09 — Webhook dan penerapan pembayaran

**Penerimaan provider BE-14, 24 Oktober 2026:** BNI VA Sandbox Rp14.000 settlement + signature/status/referensi/nominal cocok, event WEBHOOK VERIFIED SUCCESS, satu PaymentApplication dan satu transisi PROCESSING, stok/reservasi/voucher selesai tepat sekali. SQL read-only dan GET Status nyata digunakan untuk verifikasi, bukan menganggap HTTP 200/token/redirect sebagai pembayaran. Dua HTTP 200 lifecycle bukan bukti dua settlement identik. Proof UUID baru dipertahankan, tunnel uji ditutup tanpa mengubah task/.env/dev. [BE14-RECONCILIATION.md](BE14-RECONCILIATION.md) memuat hasil akhir; VA belum teruji pada paragraf bertanggal BE-09 di bawah bersifat historis.

Pembaruan BE-10: rekonsiliasi/retry/release dan penjadwal lokal kini tersedia, termasuk kompatibilitas respons Core API tanpa field currency. Catatan BE-09 di bawah adalah hasil tahap tersebut; perilaku terbaru dan bukti operasi ada di [RECONCILIATION.md](RECONCILIATION.md).

Acuan PRD 1.7, FR-07. Implementasi backend tersedia pada 23 Oktober 2026. Bukti provider nyata dibedakan dari tes dengan gateway pengganti di bawah.

## Kontrak dan verifikasi

`POST /api/webhooks/midtrans` menerima JSON maksimal 65.536 byte, tanpa cookie sesi atau Origin browser. Field wajib: `order_id`, `transaction_id`, `status_code`, `gross_amount`, `transaction_status`, `signature_key`. Field provider tambahan dibuang oleh parser. Respons berhasil HTTP 200 berisi `data: {accepted:true}` sesudah penyimpanan selesai.

Signature SHA512 memakai teks nominal asli dan dibandingkan dengan timing-safe comparison sebelum pembacaan pembayaran. Referensi harus sudah tercatat dari Snap; nominal integer Rupiah, currency jika disertakan, dan identitas transaksi harus cocok. Setelah itu server mengambil Get Status dari endpoint Sandbox tetap, dengan timeout 15 detik, batas respons 64 KiB, tanpa redirect/cache. Signature respons diperiksa jika tersedia. Hasil terbaru harus cocok referensi/identitas/nominal dan menyatakan currency IDR. Currency hilang belum diterima oleh implementasi ini; kompatibilitas respons bank merchant masih memerlukan uji nyata.

Sukses memerlukan settlement berkode 200 tanpa fraud bermasalah, atau capture kartu berkode 200 dengan fraud accept. Waktu sukses memakai settlement_time (capture memakai transaction_time), zona GMT+7, dengan validasi kalender. Waktu kedatangan webhook tidak dijadikan waktu pembayaran. Status asing, respons tidak lengkap, 404 provider dan gangguan jaringan tidak membuktikan transaksi gagal atau aman untuk dicoba ulang.

Kesalahan: 415 tipe konten, 400 JSON rusak, 413 body terlalu besar, 422 bentuk/nominal invalid, 403 signature salah, 404 referensi lokal tidak ditemukan, 409 referensi/nominal/identitas tidak cocok. Status belum pasti memberi 503 dan Retry-After 3; kegagalan database tidak diberi acknowledgment sukses. Nilai rahasia dan raw payload provider tidak dicatat.

## Penerapan atomik

Service mengunci User → Order → Product berurutan → Discount → Payment, lalu mengulang pemeriksaan identitas di dalam transaksi. Panggilan provider dilakukan di luar transaksi database. Benturan serialisasi/deadlock dicoba ulang terbatas.

Untuk sukses pertama yang dibayar tepat waktu, order harus masih menunggu dan reservasi stok/voucher harus cocok serta utuh. Satu transaksi menyimpan Payment SUCCESS, paidAt, PaymentEvent, PaymentApplication unik per order, konsumsi reservasi, pengurangan stok fisik dan cadangan, voucher USED, flag pembelian pertama false, order PROCESSING dan riwayat SYSTEM. Order tanpa voucher juga valid. Kegagalan salah satu operasi membatalkan seluruh penerapan.

Notifikasi berulang tidak mengurangi stok/voucher lagi atau menambah riwayat sama. Status pending/gagal/expired lama tidak menurunkan pembayaran sukses. Refund/partial refund/reversal terverifikasi membuat order NEEDS_ATTENTION dan mempertahankan penanda penerapan; stok/voucher tidak dipulihkan otomatis. Dua pembayaran sukses dicatat keduanya, tetapi hanya satu boleh memenuhi order. Pembayaran setelah tenggat, sesudah reservasi lepas, atau saat ada ketidaksesuaian reservasi menjadi NEEDS_ATTENTION tanpa pemenuhan otomatis. Notifikasi terlambat dengan bukti pembayaran sebelum tenggat masih dapat diterapkan jika reservasi utuh.

Status terminal provider belum melepas reservasi di BE-09. Penjadwal, rekonsiliasi manual, retry dan release aman adalah BE-10. Halaman finish/parameter browser tetap tidak mengubah status. Tidak ada Plan, Subscription, aktivasi premium, refund otomatis atau tombol sukses manual.

## Konfigurasi

Menggunakan `MIDTRANS_SERVER_KEY`, `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`, `MIDTRANS_IS_PRODUCTION=false`, `NEXT_PUBLIC_APP_URL`, `PAYMENT_EXPIRY_MINUTES=60` dan koneksi database Salvora yang sudah ada. Jangan menyalin kredensial LanggananKu. Produksi/demo publik memerlukan URL aplikasi HTTPS dan `MIDTRANS_WEBHOOK_URL` dengan path tepat `/api/webhooks/midtrans`. `--payment` memeriksa kesiapan deployment tersebut; `--snap` tetap dapat dipakai lokal.

Gateway Snap mendukung notification URL HTTPS tepercaya dari konfigurasi melalui X-Override-Notification per transaksi. Ini bukan input browser dan tidak mengubah merchant Dashboard. Hosting stabil dan penjadwal O-08 belum dipilih.

## Bukti aktual dan batasnya

- 50 tes unit/fondasi dan 93 tes PostgreSQL lulus, termasuk signature/nominal, status terbaru, empat callback bersamaan, rollback, pembayaran ganda, refund/reversal, sukses terlambat, dan order tanpa voucher. Provider pada tes ini adalah gateway pengganti.
- Lint, typecheck dan production build lulus. `npm.cmd run test:http:webhook` menguji handler Next.js nyata dengan database test, key tiruan, penolakan payload/signature/identitas dan tanpa panggilan provider.
- Uji opt-in `node --import tsx scripts/webhook-live-sandbox.mjs` berhasil membuat tunnel HTTPS terbatas POST webhook: signature palsu mendapat 403, root publik mendapat 404. Snap Sandbox nyata berhasil membuat token PENDING untuk fixture test Rp14.000 dengan notification override. Ini belum membuktikan pembayaran lunas atau callback provider sukses.
- Pengguna meminta melanjutkan tanpa simulasi VA manual karena pernah berhasil pada proyek lain. Pengalaman itu tidak dianggap bukti Salvora. O-06/UAT pembayaran bank tetap terbuka untuk BE-14. Tidak ada webhook sukses atau konsumsi stok/voucher nyata yang diklaim.
- Tunnel, child server Next.js dan kontrol loopback sudah dihentikan. Input sesi proses tertutup sehingga penghentian menggunakan PID induk/anak yang diperiksa secara tepat. Tidak ada merchant Dashboard, env lokal, database dev atau LanggananKu yang diubah oleh uji ini.

Proof tanpa key/token berada privat di `.local/midtrans-webhook-proof.json`; referensi akun/produk/order/attempt uji dipertahankan agar transaksi provider tidak kehilangan referensi lokal. Fixture BE-08 juga dipertahankan terpisah. Jangan menghapus proof untuk mencoba pembayaran baru sebelum meninjau/rekonsiliasi attempt lama. URL tunnel sudah tidak berlaku; mengulang pengujian memerlukan endpoint HTTPS baru dan penanganan override transaksi lama. Script menolak membuat attempt baru jika proof sudah ada.

Referensi resmi: [HTTP notification dan signature](https://docs.midtrans.com/docs/https-notification-webhooks), [Get Transaction Status](https://docs.midtrans.com/reference/get-transaction-status), [Sandbox simulator](https://docs.midtrans.com/docs/testing-payment-on-sandbox), [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).
