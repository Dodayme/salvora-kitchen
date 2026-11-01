# BE-14 — Verifikasi backend dan batas serah terima

Disusun 23 Oktober, diperbarui **24 Oktober 2026**. PRD 1.9, API 0.13. **BE-11–BE-14 Selesai untuk cakupan backend.** BNI VA Sandbox Rp14.000 settlement, signature/status/reference/nominal dan penerapan stok/voucher tepat sekali terverifikasi melalui webhook nyata, SQL read-only dan GET status 24 Oktober 13:53 WIB. Ditambah 19-suite PostgreSQL, 108 regresi bersih, 7 kelompok HTTP, fresh DB Prisma migration/seed/isolasi/restore serta tick antrean kosong yang telah lulus. Dasar penerimaan, artefak dan batas: [BE14-RECONCILIATION.md](BE14-RECONCILIATION.md).

**Batas penerimaan:** mismatch retensi run regresi pertama tetap tidak dapat dipastikan/dipulihkan retrospektif, tidak dinyatakan bersih atau dihapus. Cleanup auth diperbaiki; penutupan backend berdasar run bersih dan bukti lengkap berikutnya, dengan keterbatasan historis tersebut tetap terbuka sebagai catatan audit, bukan klaim recovery. Frontend/Figma/responsif, hosting/volume foto/job server serta restore berkas foto belum diterima. Endpoint HTTPS uji sudah ditutup; .env/merchant Dashboard/task/dev/backup lama tidak diubah. Tidak ada klaim seluruh produk siap produksi.

Bagian berikut adalah **baseline historis sampai sekitar 13:01 WIB**, sebelum laporan terisolasi 13:50 dan pekerjaan rekonsiliasi lanjutan. Pernyataan “belum ada suite DB”, “cluster berhenti”, atau “HTTP tertunda” di bagian historis tidak menggambarkan status saat ini. Bukti lama tetap dipertahankan dengan batas waktu; jangan menyamakan sumber/laporan 19 tes dengan rerun baru.

## Hasil baseline BE-14 awal (historis)

| Pemeriksaan | Hasil | Arti dan batas |
|---|---|---|
| npm.cmd test | 103 lulus, 12 berkas | Fondasi/unit dan service/handler mock, tanpa PostgreSQL/provider |
| node --test tests/payment-worker.test.mjs | 11 lulus | Orkestrasi/classifier mock; percobaan pertama gagal spawn EPERM sandbox, pengulangan dengan izin lulus; tidak menjalankan worker pembayaran |
| npm.cmd run test:automation:scheduler | 8 skenario mock lulus | Tidak memanggil cmdlet ScheduledTasks asli atau mengubah task |
| npm.cmd run lint | Lulus tanpa warning | Pemeriksaan sumber |
| npm.cmd run typecheck | Lulus | Pemeriksaan TypeScript |
| npm.cmd run build | Lulus | Route terkompilasi; bukan bukti DB/provider sehat |
| npm.cmd run test:http | Lulus pada dua proses Next.js sementara | Home 200; health konfigurasi kosong/fixture 503/200; metode yang tidak didukung 405 dan path asing 404. Handler bisnis tidak dipanggil |
| npm.cmd run db:validate | Lulus pada pengulangan dengan izin di luar sandbox | Validasi statis Prisma, bukan koneksi/migrasi. Percobaan pertama wrapper gagal tanpa detail; penyebab percobaan pertama tidak dipastikan |

Smoke HTTP lama menganggap GET orders menghasilkan 405 dan admin/orders belum ada (404). Setelah BE-11 asumsi itu usang. scripts/verify-http.mjs sekarang memakai DELETE yang tidak diekspor untuk menguji dispatch route tersedia, termasuk BE-11–BE-13, serta path asing eksplisit. Hanya home dan health yang menjalankan handler; health menyatakan database/payment=not_checked. Fixture environment hanya milik subprocess, tidak mengubah .env.local.

Validasi statis Prisma bukan migrasi pada database baru. Tes launcher GUI tidak diulang: runner tersebut dapat membangun ulang binary action task aktif. Bukti migrasi/launcher terdahulu tetap [WINDOWS-AUTOMATION-AUDIT.md](WINDOWS-AUTOMATION-AUDIT.md); ini bukan alasan mengklaim worker sehat.

Tidak menjalankan test:db, migrasi, seed, script HTTP bisnis, worker/rekonsiliasi manual, Snap/simulator atau gateway. Tidak mengubah task, interval, binary launcher, backup/rollback, data transaksi atau cluster. PostgreSQL tidak dinyalakan. Tidak mengaudit ulang status OS/log tick saat ini; diagnosis terakhir yang tersedia tetap FAILED/database_connection/CONNECTION_REFUSED pada cluster 55433 yang berhenti. Jangan menganggapnya pemeriksaan listener baru.

## Bukti historis dan gap

BE-02–BE-10 mencatat pengujian PostgreSQL/HTTP terdahulu; BE-10 mencatat 108 tes PostgreSQL, HTTP serta satu tick otomatis selesai pada antrean kosong. Itu bukan pengulangan regresi terhadap kode BE-11–BE-13 saat ini. Token Snap Sandbox nyata pernah berhasil dibuat; VA lunas, webhook provider sukses dan penerapan pembayaran nyata Salvora belum terbukti. Pengalaman sukses proyek lain tidak menggantikannya.

Suite tests/database saat BE-14 masih mencakup auth, buyer, catalog, checkout, integrity, payments, reconciliation, vouchers dan webhook. Belum ada suite PostgreSQL khusus orders/reviews/dashboard atau satu skenario end-to-end lengkap hingga ulasan. Test runner default tidak memuat direktori database. Menjalankan test:db yang ada kelak tidak otomatis menutup seluruh BE-11–BE-14.

## Pemetaan seluruh UAT PRD

Legenda: **Mock** = bagian unit/mock lulus saat BE-14, bukan UAT runtime; **Historis** = pernah tercatat dalam dokumen task sebelum BE-11–BE-13, belum diulang; **Tertunda** = bukti yang diminta belum tersedia. Seluruh UAT produk tetap memerlukan integrasi frontend; tabel ini hanya menjelaskan bukti backend yang tersedia.

| UAT | Bukti backend | Yang belum dibuktikan pada BE-14 |
|---|---|---|
| 01 registrasi | Historis AUTH / database/auth | Registrasi HTTP/DB saat ini |
| 02 voucher satu akun | Historis VOUCHERS / database/vouchers | Login pertama/ulang runtime saat ini |
| 03 diskon 60.000 | Mock pricing; historis voucher | Quote/checkout runtime |
| 04 plafon 100.000 | Mock pricing; historis voucher | Quote/checkout runtime |
| 05 voucher concurrent | Historis database/checkout | Race pada kode saat ini |
| 06 stok terakhir | Historis database/checkout | Race pada kode saat ini |
| 07 konfirmasi berulang | Historis database/checkout | Idempotensi HTTP/DB saat ini |
| 08 sukses diterapkan sekali | Mock webhook; historis WEBHOOKS | Provider nyata + penerapan DB |
| 09 gagal/retry | Mock payments; historis RECONCILIATION | Retry end-to-end |
| 10 timeout Snap | Mock payments; historis database/payments | Gateway nyata/antrean pemulihan |
| 11 callback ulang | Mock webhook; historis database/webhook | Callback provider dan regresi DB |
| 12 signature/nominal palsu | Mock webhook; historis WEBHOOKS | HTTP/DB saat ini |
| 13 gagal setelah sukses | Mock webhook; historis database/webhook | Regresi DB saat ini |
| 14 expiry/release | Mock kebijakan; historis RECONCILIATION | Tick otomatis sehat dan release terisolasi |
| 15 sukses terlambat | Mock status; historis database/reconciliation | Regresi DB saat ini |
| 16 snapshot harga | Mock ORDERS; historis CATALOG/CHECKOUT | Detail HTTP setelah perubahan katalog |
| 17 produk nonaktif | Mock visibilitas; historis CATALOG | Riwayat/detail baru tetap utuh di DB |
| 18 pesanan asing | Mock ORDERS | Endpoint BE-11 dengan sesi/DB nyata |
| 19 ulasan sebelum selesai | Mock REVIEWS | HTTP/DB nyata |
| 20 ulasan item selesai | Mock REVIEWS | Insert dan rata-rata katalog aktual |
| 21 ulasan ganda | Mock existing/P2002 | Dua Submit concurrent/unique PostgreSQL |
| 22 ponsel | Tertunda | Frontend responsif/UAT browser |
| 23 React/Tailwind/shadcn | Fondasi Next.js build lulus | Implementasi halaman lengkap dan penggunaan komponen |
| 24 CSS khusus | Tertunda | Audit UI lengkap |
| 25 migrasi lingkungan baru | Historis DATABASE | Deploy seluruh migrasi pada DB kosong baru, seed/role/restore |
| 26 pembayaran adaptasi | Token nyata historis, mock pembayaran | VA lunas + webhook Salvora + DB |
| 27 kecocokan Figma | Tertunda | UI/aset/responsif |
| 28 callback browser | Halaman finish tidak menerapkan pembayaran; mock status | Interaksi browser/Snap end-to-end |
| 29 tutup Snap | Server tidak bergantung popup; belum ada UI Snap lengkap | UAT tutup popup dan pending tetap |
| 30 retry terminal | Mock payments; historis RECONCILIATION | HTTP/DB saat ini dan provider |
| 31 konfigurasi kosong | Smoke HTTP health lulus; mock allowlist | Guard bukan bukti listener/database sehat |
| 32 efek toko, bukan langganan | Mock webhook; historis database/webhook | Penerapan aktual Salvora terintegrasi |
| 33 expiry konsisten | Mock policy; historis CHECKOUT/PAYMENTS | Tenggat Snap/reservasi/UI end-to-end |
| 34 refund/reversal | Mock status; historis WEBHOOKS | Race dengan fulfillment/review baru di DB |
| 35 dua pembayaran sukses | Mock status; historis database/webhook | Regresi DB/fungsi admin saat ini |
| 36 periode dashboard | Mock DASHBOARD | Agregasi PostgreSQL/tanggal batas/snapshot |
| 37 aktif stok nol | Mock query; historis CATALOG | Agregasi dashboard + checkout aktual |
| 38 voucher admin | Mock DASHBOARD | Owner/relasi/pagination di DB dan HTTP |
| 39 profil admin | Historis AUTH / database/auth | Regresi HTTP/DB saat ini |

Tidak ada UAT baru yang ditandai lulus end-to-end hanya karena mock atau build berhasil. Kegagalan operasional terakhir tetap worker tidak dapat terhubung; bukan transaksi yang telah diverifikasi gagal.

## Rencana penutupan awal (historis; sebagian sudah dipenuhi)

1. Tinjau dampak antrean sebelum startup: task tiap menit tetap aktif, sehingga cluster hidup dapat langsung memproses order dev dan memanggil Sandbox. Scope task dev tidak sama dengan fixture provider pada database test. Tidak bisa memeriksa antrean SQL saat cluster berhenti. Persetujuan pemulihan harus menjelaskan risiko ini; jangan mengganti target ke 5432 atau menonaktifkan task diam-diam.
2. Setelah persetujuan terpisah dan identitas cluster/binary diverifikasi ulang, pulihkan cluster yang sama dengan startup minimal pg_ctl. Jangan initdb, hapus PID, reset, atau jalankan bootstrap provisioning untuk menebak pemulihan. Periksa listener 55433 dan identitas database secara read-only; amati satu atau dua tick normal dengan log whitelist. Startup belum dilakukan dalam BE-14 ini.
3. Siapkan database test terisolasi dan database kosong baru untuk uji migrasi. Nama/role/target harus sesuai allowlist proyek, tanpa fallback dev/LanggananKu; jangan menghapus database test yang memiliki fixture provider lama. Rencana DB kosong memerlukan target test yang benar-benar terisolasi sebelum implementasi, bukan reset database saat ini.
4. Lengkapi dan jalankan suite PostgreSQL/HTTP BE-11–BE-13, lalu alur akun baru → alamat/cart/voucher → quote/order → gateway mock → penerapan → kirim → konfirmasi manual selesai → review → dashboard. Buktikan rollback, dua submit, race webhook/admin/review serta batas tanggal/stok. Daftar terperinci: ORDERS.md, REVIEWS.md dan DASHBOARD.md. Tanpa gateway nyata untuk regresi integritas.
5. Setelah regresi terisolasi aman, lakukan uji Sandbox bank/VA khusus dengan persetujuan/sarana interaktif yang sesuai, URL webhook HTTPS dan key baru di konfigurasi privat; periksa status provider, signature, nominal, order dan PaymentApplication sekali. Jangan menyalin token ke laporan atau membayar ulang fixture lama tanpa verifikasi.
6. Verifikasi backup/restore pada target terisolasi, volume foto persisten dan hosting HTTPS/job server. Jalankan UAT UI bersama frontend, lalu perbarui bukti/status task. Tidak menutup BE-14 sebelum kriteria tersebut dipenuhi.

Panduan kontrak dan UI: [FRONTEND-HANDOFF.md](FRONTEND-HANDOFF.md). Setup/migrasi: [DATABASE.md](DATABASE.md). Diagnosis dan backup/rollback task tetap pada dokumen operasional yang ada; tidak dihapus atau diganti oleh laporan ini.
