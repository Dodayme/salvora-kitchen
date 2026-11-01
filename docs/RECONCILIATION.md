# BE-10 — Rekonsiliasi, retry dan kedaluwarsa

**Pembaruan akhir 24 Oktober:** BE-14 Selesai backend dan satu BNI VA Sandbox Rp14.000 terverifikasi settlement/webhook/application. Pembayaran uji diproses webhook pada database test, **bukan** worker dev; worker dev hanya terbukti pass antrean kosong. Tidak ada rekonsiliasi manual, perubahan task atau konfigurasi dev. Tunnel/server uji sudah ditutup. Catatan retensi regresi awal dan penerimaan UI/deployment tetap terpisah pada [BE14-RECONCILIATION.md](BE14-RECONCILIATION.md).

Acuan PRD 1.7, FR-07, bagian 10–11/14.1. Implementasi 23 Oktober 2026 memakai layanan verifikasi/penerapan BE-09 yang sama untuk webhook, Get Status manual dan penjadwal. Tidak ada migrasi atau dependensi baru.

**Pembaruan BE-14:** setelah pemulihan manual, SQL dev/test:55433 dan dua tick otomatis 14:09/14:12 WIB terverifikasi; task PT1M, LastTaskResult 0, launcher exit 0 dan worker COMPLETED checked=0. Ini pass antrean kosong, bukan pembayaran atau jaminan tick masa depan. Regresi 108 setelah cleanup auth diperbaiki lulus dengan fingerprint test cocok. Tidak menjalankan worker manual atau mengubah task. Lihat [BE14-RECONCILIATION.md](BE14-RECONCILIATION.md) untuk bukti dan batas, termasuk mismatch retensi pada regresi pertama. Bukti BE-10 di bagian akhir tetap historis.

## Pemeriksaan dari aplikasi

`POST /api/orders/{orderId}/payments/reconcile`, JSON `{}`, membutuhkan sesi pemilik BUYER atau ADMIN dan Origin aplikasi yang tepat. Akun lain mendapat 404; anonim 401; Origin salah 403; field tambahan 422. Tidak menerima nominal, identitas provider atau status sukses dari browser. Respons privat no-store dan Vary Cookie, berbentuk `{order: OrderDetail, reconciledAt}` dalam envelope standar. DTO tidak berisi cookie, hash, signature, token Snap atau key.

Limiter atomik PostgreSQL memakai waktu database: maksimum 20 pemeriksaan per akun per jendela tetap 15 menit, serta satu pemeriksaan per order per jendela tetap 30 detik, berlaku bersama untuk pemilik/admin. HTTP 429 menyertakan Retry-After. Pemeriksaan kepemilikan dilakukan sebelum limiter dan panggilan provider. Batas ini teknis untuk mencegah spam, bukan perubahan kebijakan pembayaran.

Setiap attempt diperiksa lewat Get Status Sandbox menggunakan referensi dari database. Bukti penolakan Snap definitif tidak perlu diperiksa ke provider. Bukti sukses menerapkan transaksi melalui service BE-09 tanpa membuat signature atau event webhook sintetis. Sumber event manual STATUS_API dan job SCHEDULER. Jika satu attempt belum pasti, attempt lain tetap diperiksa agar suksesnya dapat dicatat; respons akhir 503 PAYMENT_RECONCILIATION_UNCONFIRMED dengan Retry-After 30. Status yang berhasil diverifikasi tetap tersimpan. Frontend tidak boleh menafsirkan 503 sebagai pembayaran gagal atau membukakan charge baru.

Get Status 404 dapat berarti pembeli belum memilih metode pada Snap, meskipun token masih berlaku. Timeout, network error, status asing, identitas/nominal tidak cocok atau respons tidak lengkap tidak membuktikan transaksi sudah tidak dapat dibayar. Semua keadaan ini menahan reservasi. Job akan mencoba lagi; kasus yang tetap belum pasti memerlukan pemeriksaan operator, bukan reset status manual.

Kompatibilitas respons legacy diperbaiki: dokumentasi Core API mendefinisikan gross_amount dalam IDR dan memiliki contoh respons tanpa field currency. Currency yang tidak disertakan diterima hanya dalam kontrak endpoint server Sandbox ini, dengan nominal/order IDR tetap cocok. Currency yang eksplisit selain IDR (termasuk string kosong) ditolak. Ini menggantikan batas strict currency pada BE-09; kedua kasus dibuktikan tes PostgreSQL.

## Retry dan release

Token PENDING yang masih berlaku dipakai ulang. Attempt CREATED/UNCONFIRMED tetap memblokir charge baru. Attempt terminal lokal tanpa bukti tidak cukup untuk retry. Seluruh attempt lama harus mempunyai bukti terminal gagal/cancel/expire terverifikasi atau bukti penolakan request Snap definitif. Retry memakai order/snapshot/reservasi yang sama, providerOrderId SV-UUID baru, dan tenggat asli 60 menit; tidak memperpanjang waktu. Tidak membuat retry otomatis dari job. Hint canPay memakai bukti tersebut, canReconcile aktif bila ada attempt atau order menunggu sudah melewati tenggat.

Release hanya dilakukan setelah tenggat database lewat, order masih AWAITING_PAYMENT, tidak ada PaymentApplication, serta seluruh attempt telah dipastikan terminal dalam pemeriksaan ini. Order tanpa attempt aman dilepas. Sebelum menulis, service mengunci User → Order → produk berurutan → Discount dan mengulang validasi seluruh attempt/reservasi. Attempt baru atau sukses yang datang saat pemeriksaan tidak lolos syarat release.

Transaksi release mengurangi reservedStock tanpa mengurangi physicalStock, mengubah semua reservasi menjadi RELEASED/finalizedAt, mengembalikan voucher RESERVED milik order menjadi AVAILABLE, serta mencatat EXPIRED dan riwayat SYSTEM sekali. Flag pembelian pertama tidak berubah. Kerusakan reservasi atau kegagalan penyimpanan membatalkan seluruh release. Tidak melepaskan order PROCESSING/NEEDS_ATTENTION atau voucher USED. Webhook sukses sesudah release tetap mencatat pembayaran dan Perlu Penanganan tanpa konsumsi/pengiriman otomatis. Pending, unknown dan regresi status tetap ditahan.

## Penjadwal lokal yang dipilih

Audit terminal Windows: action PowerShell interaktif lama merupakan kandidat kuat kilatan meskipun memakai Hidden. Setelah uji inert dan persetujuan pengguna, action task yang sama sudah dimigrasikan ke GUI launcher tanpa mengubah interval/principal/settings. Tick normal mencatat consoleAttached=false; worker masih exit 1 seperti sebelum migrasi dan belum terdiagnosis. Lihat [WINDOWS-AUTOMATION-AUDIT.md](WINDOWS-AUTOMATION-AUDIT.md) untuk bukti, migrasi/rollback serta diagnosis tambahan. Catatan BE-10 awal di bawah bersifat historis.

Diagnosis lanjutan kini mengonfirmasi fase database_connection/CONNECTION_REFUSED: cluster workspace 55433 tidak berjalan. Log FAILED terbaru dan kategori fase tersedia; consoleAttached hanya mengukur launcher. Lihat [PAYMENT-WORKER-DIAGNOSTICS.md](PAYMENT-WORKER-DIAGNOSTICS.md). Database tidak dinyalakan dalam audit dan keberhasilan rekonsiliasi nyata belum dibuktikan.

Pengguna menyetujui Windows Task Scheduler lokal. Task `SalvoraKitchen-PaymentReconciliation-Local` berjalan setiap 1 menit melalui launcher PowerShell/Node tersembunyi dengan akun pengguna yang sedang login dan hak Limited. Tidak memakai service admin, HTTP cron publik, password Windows atau CRON_SECRET. Task memerlukan komputer menyala, pengguna login, PostgreSQL aktif dan jaringan provider tersedia. Browser/Next.js dev server tidak perlu terbuka. Ini menutup pilihan mekanisme lokal O-08; hosting demo/penjadwal server tetap belum dipilih dan belum diklaim tersedia 24 jam.

CLI satu pass: `npm.cmd run payments:reconcile` atau `node --import tsx scripts/reconcile-payments.mjs`. Membaca konfigurasi Salvora sendiri dari env lokal, memvalidasi whitelist database app, dan tidak mempunyai fallback ke LanggananKu/test/dev lain. Tidak ada key atau koneksi database dalam argumen Scheduled Task. Runtime produksi tetap mengikuti konfigurasi environment deployment.

Worker menggunakan advisory lock PostgreSQL pada koneksi pg khusus, bukan lock sesi dari pool Prisma atau transaksi baris yang dibiarkan terbuka selama HTTP. Worker kedua melewati pass jika lock dipakai. Putus koneksi lock menghentikan pemrosesan order berikutnya; lock dilepas saat selesai/error/koneksi berakhir. Lock serta transaksi per order menjaga job berulang/overlap tidak menerapkan ulang efek.

Satu pass mengambil maksimal 25 order menunggu atau Perlu Penanganan dengan attempt aktif, memakai jeda per order pada tabel RateLimit. Order tanpa attempt baru diperiksa setelah deadline. Order yang lolos pemeriksaan mendapat jeda 60 detik, yang belum pasti 300 detik. Antrean diurutkan menurut jadwal agar order 404 yang berulang tidak menghalangi order lain. Batas mulai order baru 50 detik per pass; satu order dengan beberapa attempt dapat melewati batas tersebut. Scheduled Task mengabaikan peluncuran tumpang tindih dan memiliki batas proses 10 menit. Penghentian proses tidak menganggap attempt gagal; pass berikutnya merekonsiliasinya.

Order EXPIRED/PROCESSING yang tidak mempunyai attempt aktif tidak dipoll terus oleh job awal ini. Perubahan sesudahnya ditangani webhook atau pemeriksaan manual pemilik/admin. Tidak ada refund otomatis atau override sukses.

## Operasi dan pemantauan

```powershell
# Status instalasi dan hasil terakhir (tanpa rahasia)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/payment-scheduler.ps1 -Action Status

# Bangun launcher GUI lokal; tidak menjalankan worker atau mengubah task
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/build-payment-launcher.ps1
# Tinjau migrasi action task existing, tanpa perubahan Windows
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/payment-scheduler.ps1 -Action Plan
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/payment-scheduler.ps1 -Action Update -WhatIf
# Setelah persetujuan, backup dan ganti action task yang sama (interval tetap)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/payment-scheduler.ps1 -Action Update -Confirm
# Hanya jika task belum ada, Install -Confirm membuat satu task bernama tetap

# Nonaktifkan pemicu berikutnya secara reversible; worker berjalan tidak diputus
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/payment-scheduler.ps1 -Action Disable -Confirm
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/payment-scheduler.ps1 -Action Enable -Confirm
```

Installer menolak memodifikasi task bernama sama yang menunjuk workspace/action lain. Tidak ada penghapusan rutin task. Update hanya mengganti action setelah backup; rollback dan perintah lengkap ada di laporan audit. Status Task Scheduler menampilkan LastRunTime, LastTaskResult dan NextRunTime. Exit 0 berarti pass selesai/worker lain memegang lock; exit 2 berarti ada order belum terkonfirmasi; exit 1 berarti startup/config/database/job gagal. Periksa waktu terbaru, bukan hanya hasil sukses lama. Disable menunda rekonsiliasi/release otomatis; webhook tidak dihapus.

Ringkasan pass disimpan atomik di `.local/payment-job-last.json`: startedAt, completedAt, status dan hitungan checked/released/unconfirmed. Tidak berisi akun, order ID, token, signature atau key. Kegagalan startup bisa meninggalkan proof sebelumnya; LastTaskResult dan waktu eksekusi membedakannya. Detail pembayaran/event aman tetap di database untuk audit. Fixture provider BE-08/BE-09 di database test tetap dipertahankan, tidak disapu oleh worker dev.

## Bukti pengujian

50 tes unit/fondasi + 108 tes PostgreSQL lulus, mencakup sukses lewat status API, akses/limiter, pending/404/timeout/status asing, empat release bersamaan, tanpa attempt/voucher, penolakan definitif, retry dengan tenggat tetap, currency legacy/salah, attempt campuran, rollback release, late success, race webhook/reconcile, advisory lock dan jeda antrean. Tes antrean memakai scope fixture pada database test, tidak memproses order provider nyata yang dipertahankan.

Production build/typecheck/lint lulus. HTTP Next.js nyata menguji sesi, Origin, payload, pemilik/admin, header privat/429 dan expiry tanpa attempt memakai database test/key tiruan; tidak menghubungi provider. Regresi HTTP webhook dan pembeli/checkout lulus. Worker CLI nyata pada database dev berisi 0 order selesai dengan checked/released/unconfirmed semuanya 0. Task OS terpasang dan tick otomatis 23 Oktober 2026 05:02:38 WIB selesai dengan LastTaskResult 0; tick berikutnya dijadwalkan satu menit kemudian. Ini membuktikan startup/lock/antrean/proof dan peluncuran otomatis OS, bukan pembayaran provider.

Uji VA lunas/webhook sukses provider Salvora tetap terbuka sesuai arahan pengguna pada BE-09 dan harus ditutup di BE-14. Tidak ada klaim seluruh UAT produk/frontend selesai.

Referensi resmi: [status dan nominal Core API](https://docs.midtrans.com/reference/get-transaction-status), [Snap Get Status 404](https://docs.midtrans.com/docs/snap-advanced-feature), [expiry sesi dan kanal pembayaran](https://docs.midtrans.com/reference/expire-a-snap-session).
