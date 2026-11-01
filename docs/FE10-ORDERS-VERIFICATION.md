# FE-10 — Pesanan, pembayaran dan fulfillment admin

Pembaruan FE-12, 25 Oktober 2026: Batal/pengiriman/validasi konfirmasi/Selesai dan recovery note browser diamati pada fixture baru, tetapi checkpoint runner mencapai batas waktu sehingga tetap FAIL, cleanup 18 tabel PASS. Status tetap Ditinjau; belum membuktikan daftar/filter/akses/responsif lengkap. [Bukti terbaru](FE-VERIFICATION.md); bagian di bawah mempertahankan hasil tahap FE-10 sebelumnya.

25 Oktober 2026. PRD 1.9 FR-10/bagian 24, API 0.13, [ORDERS](ORDERS.md), [task frontend](TASKS-FRONTEND.md).

**Status: Ditinjau.** Implementasi, 415 unit/regresi dan tujuh kelompok HTTP/PostgreSQL test lulus. Pengujian interaksi browser belum berjalan: Chrome ditemukan, tetapi izin membaca/mengendalikan jendela melalui computer-use timeout. Checkpoint UI tidak lulus dan tidak diklaim sebagai bukti browser. FE-05–FE-09 tetap sesuai status sebelumnya.

## Perubahan

| Halaman | Perilaku |
|---|---|
| `/admin/pesanan` | Daftar 10 baris per halaman, nomor/pembeli/item snapshot/unit/total, dua status berbeda, seluruh kanal dan link detail. Filter nomor, status order/payment, kanal persis dan tanggal WIB |
| `/admin/pesanan/[orderId]` | Snapshot alamat/item/biaya/deadline; seluruh percobaan pembayaran; riwayat status, catatan privat dan nama pelaku admin. GET ulang setelah mutasi terkonfirmasi |
| `/admin/pembayaran` | Daftar percobaan readonly, nominal/kanal/status/waktu dan link pesanan; filter status, ID pesanan, kanal dan tanggal. Link dari detail mengisi orderId. ID invalid tidak memicu GET atau mengganti filter menjadi seluruh data |
| Transisi | Hanya kandidat PROCESSING → SHIPPED → COMPLETED. UI menahan status belum dibayar/perlu penanganan/refund/reversal/attempt aktif yang terlihat. Application dan reservasi tidak tersedia dalam DTO; server tetap memeriksa kelayakan sebenarnya |
| Selesai | Checkbox konfirmasi manual selalu awalnya kosong, catatan trim 1–1.000 karakter wajib. Payload menyertakan receiptConfirmed=true hanya untuk COMPLETED, expectedStatus berasal dari detail terakhir |
| Catatan | POST note saja; teks dan identitas pelaku hanya dalam detail admin. Ditampilkan sebagai teks React, bukan HTML. Catatan boleh untuk NEEDS_ATTENTION tanpa mengubah status |
| Konflik/jaringan | Kunci mutasi menahan double-click dan penutupan dialog saat pending. 409/5xx/hasil jaringan tidak pasti mewajibkan pemeriksaan GET ulang, tanpa replay otomatis. Catatan tidak memiliki jaminan idempotensi setelah refresh/form baru; periksa history sebelum mengulang |

Filter tanggal kosong berarti semua tanggal, bukan periode tersembunyi. Bila dipakai, kedua hari WIB inklusif diubah ke from UTC inklusif/to eksklusif. Daftar order memakai order.createdAt; daftar pembayaran memakai payment.createdAt. Draft filter tidak mengubah label hasil sebelum diterapkan; pergantian filter kembali ke halaman 1. Status dan kanal pada filter order harus cocok pada **attempt yang sama**, tetapi status ringkas dapat memprioritaskan SUCCESS/refund dari attempt lain; UI menjelaskan dan menyediakan detail seluruh attempt.

Loading/error/kosong/pagination/retry tersedia. Pembacaan dikunci ke akun/role/revisi/path terbaru. Dialog mutasi menggunakan state detail saat dibuka; konflik menutup draft dan membaca ulang sebelum tindakan baru. Gate ADMIN memakai layout yang sudah ada, sedangkan API adalah otoritas akses. Tidak ada hapus transaksi, ekspor, pembayaran sukses manual, refund otomatis, COD/transfer manual atau pemanggilan rekonsiliasi/gateway dari halaman admin ini.

PNG `.Desain/Pesanan - Admin.png` diperiksa sebagai referensi tema, tabel dan panel. Kolom/status contoh yang bertentangan dengan kontrak diganti: nomor pesanan terpisah dari pembeli, beberapa item, dua status dan kanal nyata. Tidak memakai email/avatar palsu, angka statistik dummy, ekspor atau tombol hapus. Metrik tersedia melalui dashboard. Kesamaan render Figma belum diklaim; Figma tidak dipanggil ulang setelah limit FE-00.

Berkas:

- `src/lib/admin-client/orders-model.ts`: decoder whitelist admin, filter/tanggal dan payload note/transisi; kandidat UI bukan izin server.
- `src/components/admin/order-screens.tsx`: daftar, detail, pembayaran, form catatan dan dialog konfirmasi.
- `src/app/admin/pesanan/page.tsx`, `pesanan/[orderId]/page.tsx`, `pembayaran/page.tsx`: route baru dengan params/searchParams async sesuai dokumentasi Next terpasang.
- `src/components/admin/admin-shell.tsx`: mengaktifkan Pesanan/Pembayaran, menu Pesanan tetap aktif pada detail. Voucher masih belum tersedia, profil masih readonly sampai FE-11.
- `src/components/admin/catalog-hooks.tsx`: GET dapat dinonaktifkan dengan path null untuk input URL invalid; mekanisme auth/latest read tetap sama.
- `tests/admin-orders-client.test.ts`: 28 tes baru.
- `scripts/verify-admin-orders-client.mjs`: API nyata, fixture sintetis terisolasi, fingerprint, cleanup dan mode persiapan browser.

Service/API backend, aturan bisnis, migrasi/schema, dependency, PRD, `.env`, task Windows dan database dev tidak diubah. Tidak memulai worker/reconcile manual atau transaksi provider.

## Pemeriksaan aktual

| Perintah | Hasil |
|---|---|
| `npm.cmd test -- tests/admin-orders-client.test.ts` | 28 lulus: DTO/privasi/ID, filter khusus order vs payment, batas tanggal, payload transisi/receipt, note Unicode/kontrol, kandidat, konflik dan respons note hilang |
| `npm.cmd test` | **23 file / 415 tes lulus**; unit/regresi tanpa PostgreSQL atau DOM |
| `npm.cmd run lint` | Lulus |
| `npm.cmd run typecheck` | Lulus setelah build selesai. Percobaan bersamaan build sempat membaca generated route types yang belum selaras; pemeriksaan berurutan lulus. Satu error ReactNode unknown pada draft implementasi sudah diperbaiki sebelum build lulus |
| `npm.cmd run build` | Lulus; tiga route baru tercantum. Tidak membuktikan browser |
| `npm.cmd run check:client` | PASS: **69 source files / 41 browser artifacts / empat nilai privat** diperiksa tanpa dicetak |
| `node --import tsx scripts/verify-admin-orders-client.mjs` | **PASS tujuh kelompok**, real Next HTTP + PostgreSQL test:55433, cleanup PASS, 18 fingerprint cocok, fixture user 0, providerCalls=0 |
| `node --import tsx scripts/verify-admin-orders-client.mjs --ui` | Tujuh kelompok API lulus lagi dan UI_READY terbit. Browser tidak dapat dikendalikan karena izin aplikasi timeout. Dihentikan melalui control file; **checkpoint FAIL, cleanup PASS**, browserTested=false. Bukan kegagalan transisi API atau bukti browser |

tsx sempat mendapat spawn EPERM di sandbox; dijalankan ulang dengan izin di luar sandbox. Kegagalan tool/startup tidak dianggap hasil tes produk.

### Cakupan HTTP dan SQL

1. Anonymous 401, BUYER pada admin 403, foreign owner 404, Origin asing pada mutasi 403; sesi ADMIN dicabut kemudian ditolak 401.
2. Sebelas order baru menghasilkan pagination 10+1 berbeda. Periode 15 April 2096 WIB menghitung 9: tepat from dan to−1ms masuk, tepat to dan from−1ms tidak. Filter NEEDS_ATTENTION bekerja. FAILED+credit_card cocok order dengan status ringkas SUCCESS; FAILED+bank_transfer tidak cocok karena tidak ada attempt yang memenuhi keduanya.
3. Dua belas attempt pada satu order menghasilkan pagination 10+2; periode payment.createdAt mengecualikan attempt tepat to dan menghitung 11. Filter orderId/SUCCESS/bank_transfer menemukan satu attempt.
4. Detail dua item memakai nama/harga/alamat/total snapshot. Attempt PENDING lain memblokir pemenuhan; SUCCESS tanpa PaymentApplication juga ditolak ORDER_PAYMENT_NOT_FULFILLABLE meskipun UI hanya dapat menawarkan kandidat. NEEDS_ATTENTION dapat ditambah note tanpa transisi.
5. Dua controller mengirim SHIPPED dengan expectedStatus PROCESSING bersamaan: satu 200, satu ORDER_STATUS_CONFLICT, satu history pengiriman. COMPLETED tanpa receiptConfirmed mendapat 422 tanpa menambah history. Konfirmasi manual valid menyelesaikan sekali; expectedStatus lama ditolak 409.
6. POST note sengaja kehilangan respons setelah commit. Controller memerlukan reload dan tidak mengirim ulang; history memuat tepat satu note. Admin melihat note/nama pelaku; pembeli hanya melihat dua transisi admin dengan note=null dan tidak menerima actorUser/note privat. Snapshot, deadline, Payment, PaymentApplication, stok dan reservasi sebelum–sesudah operasi admin cocok. Kelayakan ulasan pembeli sesudah COMPLETED juga terkonfirmasi.
7. Sesi dicabut dan akses ditolak. Transport hanya mengizinkan auth/GET order/admin list serta status/notes, tanpa endpoint payment create/reconcile/webhook/worker.

Pembayaran SUCCESS, application, paidAt, identitas provider dan reservasi CONSUMED dalam tes ini **fixture sintetis**. Tidak ada gateway mock/provider nyata yang dipanggil; tes ini membuktikan integrasi frontend/controller–API–database untuk administrasi, bukan verifikasi pembayaran baru atau pengiriman/penerimaan fisik nyata.

## Isolasi dan bukti

Sebelum fixture ditulis, URL loopback 55433 dan SQL current_database=salvora_kitchen_test/inet_server_port=55433 diperiksa. Secret auth baru hanya di memori, DATABASE_URL child kosong dan kedua key pembayaran kosong. User/kategori/produk/order/payment baru memakai namespace run; cleanup transaksi menghapus relasi milik run sesuai urutan, termasuk voucher login sebelum user. Tidak reset database, menghapus fixture provider lama, menyentuh backup/rollback atau memakai 5432/LanggananKu.

Run API lulus **25 Oktober 2026 09:03:49 UTC / 16:03:49 WIB**, ID `155dc6df-6def-48f5-af3c-8bd57bdf83b1`. `.local/fe10/http-result.json` dan file `<run>-result.json` memuat laporan tersanitasi; `<run>-baseline.json` hanya hitungan/hash tabel, tanpa baris pelanggan/kredensial. Delapan belas tabel cocok: User, Session, Address, Category, Product, ProductPhoto, Cart, CartItem, Discount, CheckoutQuote, Order, OrderItem, StockReservation, OrderStatusHistory, Payment, PaymentApplication, PaymentEvent, Rating. Rate-limit dihapus hanya key secret/email/window run yang diketahui. Ini cakupan tabel tersebut, bukan checksum seluruh cluster.

Run UI `75fd5d15-c738-45fe-82db-400b90193c89`, selesai **09:16:23 UTC / 16:16:23 WIB**, tersimpan di `.local/fe10/ui-result.json`. Tujuh kelompok API lulus; belum ada mutasi dari browser. Checkpoint tidak memenuhi status/notes yang diharapkan; fixture order UI tetap belum diselesaikan sampai dibersihkan. Cleanup PASS dengan 18 fingerprint cocok dan user fixture nol. Server test/proxy ditutup, tidak mematikan development server pengguna. Timeout kontrol Chrome tidak dibalas dengan membaca kredensial admin, mengubah pengaturan keamanan atau mencoba jalur kontrol lain untuk menghindari izin.

## Penerimaan browser yang masih terbuka

Mode `--ui` menyiapkan order sintetis baru, proxy cookie admin di memori dan control file `.local/fe10/ui-control.json`. Ini bukan uji login/cookie browser. Mutasi hanya diizinkan untuk satu order fixture baru; daftar dibatasi fixture, gateway diblokir. UI_READY memberikan origin/page/fixturePrefix tanpa kredensial. Startup/cleanup mode ini terbukti, tetapi alur interaksi proxy belum berhasil dibuktikan.

Setelah akses browser tersedia, jalankan mode tersebut pada cluster test yang sudah hidup dan build terbaru:

1. Buka page UI_READY, periksa dua item snapshot, dua attempt dan status. Buka dialog pengiriman lalu Batal tanpa request; ulangi dan konfirmasi Dikirim. Periksa status/history terbaru.
2. Buka Selesai: checkbox belum dicentang, tanpa checkbox/note tidak boleh submit. Isi catatan dan centang hanya setelah konfirmasi fixture manual; simpan, periksa satu transisi Selesai.
3. Set loseNextNote=true pada control file, tambah satu note. Respons sengaja menjadi 503 setelah commit; periksa error/reload dan history, tanpa replay POST. Jangan menulis token/cookie ke bukti.
4. Periksa daftar order/pembayaran, pagination, filter periode/kanal/status, kosong/error, text panjang, Tab/fokus/Escape/dialog, 360/768/1440px dan drawer. Proxy membatasi data daftar ke fixture; pengujian query tidak terbatas sudah dilakukan oleh harness HTTP terpisah.
5. Ganti scope pada control file menjadi buyer/anonymous lalu refresh untuk gate, kembalikan admin; logout terakhir. Pergantian cookie proxy tanpa refresh bukan perubahan sesi browser yang telah dikonfirmasi.
6. Set stop=true setelah selesai; checkpoint mensyaratkan tepat dua status 200 dan satu note 201. Cleanup harus PASS. Bukti checkpoint tetap dipisahkan dari screenshot/responsif/akses browser yang benar-benar diamati.

FE-10 belum Selesai sampai kriteria browser/transisi/cancel/conflict/akses/multi-attempt dan responsif terbukti. FE-11 dapat mengerjakan voucher tetap/profil nama sendiri, dengan gap FE-05–FE-10 tetap tercatat. Penerimaan seluruh produk/Figma/UAT/deployment tetap terpisah.
