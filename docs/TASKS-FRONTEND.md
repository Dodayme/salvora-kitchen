# Task Frontend — Salvora Kitchen

| Metadata | Nilai |
|---|---|
| Tanggal | 25 Oktober 2026 |
| PRD acuan | [PRD 1.9](../PRD-Salvora-Kitchen.md) |
| Kontrak API | [API-CONTRACT.md](API-CONTRACT.md), versi 0.13 |
| Dasar kesiapan | [BE-VALIDATION-FOR-FE.md](BE-VALIDATION-FOR-FE.md) |
| Handoff integrasi | [FRONTEND-HANDOFF.md](FRONTEND-HANDOFF.md) |
| Stack | React melalui Next.js, Tailwind CSS, shadcn/ui |
| Status | FE-00/01 serta fungsi FE-02–FE-04 selesai. FE-05–FE-12 Ditinjau: seluruh halaman P0 tersedia; 438 unit/regresi dan statis/build lulus. Checkout browser response-loss/reload/recovery PASS, cleanup 15 tabel; admin fulfillment/note diamati parsial tetapi checkpoint timeout, cleanup 18 tabel PASS. Browser lintas halaman/state, provider UI baru dan aset visual final belum lengkap. Lihat FE-VERIFICATION.md untuk bukti terbaru dan batas penerimaan |

## 1. Aturan tetap

- PRD menentukan perilaku; Figma dan PNG `.Desain` menentukan visual. Bagian 24 PRD mengalahkan tombol/menu yang bertentangan di desain.
- Jangan mengganti backend yang telah diterima, schema atau payload hanya untuk memudahkan UI. Jika ada gap, catat reproduksi, dampak, dan usulan; perubahan aturan bisnis mengikuti proses PRD.
- Semua status, harga, voucher, stok, hak akses, dan hasil pembayaran berasal dari server. Perhitungan tampilan bukan otoritas transaksi.
- Gunakan fetch same-origin/cookie, envelope API, pagination dan penanganan non-JSON sesuai kontrak. Tangani error/empty/loading/pending/conflict, bukan hanya happy path.
- Jangan simpan sesi/server key di frontend atau localStorage. Snap token, URL instruksi dan referensi rahasia tidak dimasukkan log, analytics, atau URL aplikasi.
- React dapat memakai data contoh terlabel saat mengembangkan komponen; penerimaan integrasi P0 harus memakai endpoint nyata yang sesuai. Jangan menyamarkan fixture sebagai data operasional resmi.
- Utamakan Tailwind dan tema shadcn/ui. CSS manual hanya pengecualian minimal yang terdokumentasi. Jangan memasang pustaka UI utama tambahan tanpa alasan.
- Gunakan satu task aktif atau subtask kecil yang dapat ditinjau; penutupan mencatat perubahan, pemeriksaan aktual, dan batas yang belum teruji.
- Dokumen task bukan perintah membuat chat baru, automasi, transaksi pembayaran, atau deployment.

Status: **Belum dimulai → Dikerjakan → Ditinjau → Selesai**; **Terhambat** harus mencatat alasan serta pekerjaan independen yang masih dapat dilanjutkan.

## 2. Backlog P0

| ID | Task | Dependensi | Status |
|---|---|---|---|
| FE-00 | Audit visual/aset dan pemetaan halaman–API | Dokumen backend aktif | Selesai — audit/matriks/aset tersedia; batas Figma dicatat |
| FE-01 | Fondasi UI, tema, komponen, dan API client | FE-00 | Selesai — tes unit/regresi, lint/typecheck/build, boundary dan browser fondasi lulus |
| FE-02 | Auth, sesi, navigasi peran, dan proteksi tampilan | FE-01 | Selesai untuk fungsi — API/browser test nyata dan mock lulus; aset visual final masih gap |
| FE-03 | Beranda, kategori, katalog, dan detail produk | FE-01; FE-02 untuk tambah keranjang | Selesai untuk fungsi — browser/API test dan responsif lulus; aset/konten final masih gap |
| FE-04 | Alamat, keranjang, dan informasi voucher | FE-02, FE-03 | Selesai untuk fungsi — browser/API test lulus; penutup statis/build 25 Oktober, visual final tetap FE-12 |
| FE-05 | Quote dan konfirmasi checkout idempoten | FE-04 | Ditinjau — recovery checkout browser/reload PASS pada FE-12, cleanup 15 tabel; seluruh state/keyboard/responsif belum lengkap |
| FE-06 | Snap Sandbox, status, retry, dan halaman finish | FE-05; konfigurasi webhook untuk uji pembayaran baru | Ditinjau — 302 unit/regresi dan HTTP test lulus; browser/Snap/VA baru dan webhook HTTPS belum terpenuhi |
| FE-07 | Riwayat/detail pembeli dan ulasan terverifikasi | FE-02, FE-06 | Ditinjau — 335 unit/regresi dan HTTP/PostgreSQL test lulus; interaksi browser belum diuji |
| FE-08 | Layout admin dan dashboard operasional | FE-01, FE-02 | Ditinjau — 359 unit/regresi dan HTTP/PostgreSQL test lulus; browser/drawer/keyboard/responsif belum diuji |
| FE-09 | Admin kategori, produk, foto, dan stok | FE-08 | Ditinjau — 387 unit/regresi, tujuh kelompok HTTP/PostgreSQL test dan cleanup 16 tabel/foto lulus; browser CRUD/upload/stok belum diuji |
| FE-10 | Admin pesanan, pembayaran, catatan, dan fulfillment | FE-08, FE-06 | Ditinjau — 415 unit/regresi dan tujuh kelompok HTTP/PostgreSQL test lulus; checkpoint browser belum lulus, cleanup 18 tabel cocok |
| FE-11 | Admin voucher tetap dan akun sendiri | FE-08 | Ditinjau — 437 unit/regresi dan tujuh kelompok HTTP/PostgreSQL test lulus; browser voucher/profil belum diuji, cleanup 18 tabel cocok |
| FE-12 | Verifikasi browser, responsif, alur produk, dan handoff | FE-00 sampai FE-11 | Ditinjau — 438 tes/statis/build lulus; checkout browser PASS, admin parsial/checkpoint timeout; gap lintas halaman/provider/aset tetap terbuka |

## 3. Task dan kriteria selesai

### FE-00 — Audit visual/aset dan pemetaan halaman–API

**Hasil 24 Oktober 2026: Selesai untuk audit.** [FE-DESIGN-AUDIT.md](FE-DESIGN-AUDIT.md) memetakan halaman publik/pembeli/admin, route UI usulan, role, API, komponen, loading/empty/error/session/conflict/pending dan koreksi PRD. [FE-ASSET-INVENTORY.md](FE-ASSET-INVENTORY.md) mencatat metadata serta status 21 PNG (20 screenshot, satu hero individual), kebutuhan font/logo/foto/auth dan konten resmi yang belum tersedia.

**Bukti dan batas:** Figma get_design_context beranda 29:4 berhasil beserta screenshot, font Abhaya Libre/Poppins dan warna konteks terverifikasi. Panggilan metadata berikutnya terkena limit Starter plan; halaman lain memakai PNG, node/ukuran/font spesifiknya tidak diklaim terverifikasi Figma. Semua PNG dibaca/decode dan contact sheet diperiksa; sejumlah form/table diperiksa full-size. Gambar/font/export yang belum lokal tidak dianggap siap, screenshot tidak menjadi aset produk. Tidak mengubah kode produk/backend/PRD/API/config/database/task, menginstal dependency, mengunduh semua aset Figma atau membuat transaksi. Pemeriksaan dokumentasi/endpoint dilakukan statis tanpa suite DB/provider/build ulang.

**Kesiapan FE-01:** semantic theme, primitive shadcn, layout responsif dan API client dapat dikerjakan dari audit. Font file/export logo serta aset foto/auth perlu diperoleh pada FE terkait; placeholder development diberi label, penerimaan visual tetap FE-12. FE-01–FE-12 masih Belum dimulai, tidak ditandai selesai oleh hasil audit.

**Verifikasi dokumentasi:** checker lokal mencocokkan 47 rujukan API tertulis (termasuk pengulangan) dengan file route dan export metode, serta 21 nama/dimensi aset terhadap inventaris. Link Markdown valid dan scan pola kredensial tidak menemukan kecocokan. Ini pemeriksaan statis audit, bukan pengujian endpoint, browser atau transaksi.

**Acuan:** PRD 7/12/15/24/25, seluruh FR P0, kontrak 0.13. **Script siap pakai:** [prompts/FE-00.md](prompts/FE-00.md).

**Keluaran:** `docs/FE-DESIGN-AUDIT.md` dan `docs/FE-ASSET-INVENTORY.md` saat task dijalankan.

- Baca desain lokal serta Figma bila akses tersedia; catat sumber dan keterbatasan. Jangan menganggap ekspor PNG memiliki semua informasi font/token.
- Petakan halaman P0, route UI yang diusulkan, role, endpoint/metode, komponen, state, dan gap desain. Route UI tidak sama dengan route API.
- Inventaris foto/logo/banner/ikon/font dan asalnya. Bedakan aset terpisah, gambar screenshot, belum tersedia, placeholder, dan data resmi/demo.
- Catat perbedaan desain–PRD: voucher tetap, tanpa COD/transfer manual/promo umum/pickup; dua jenis status; registrasi membutuhkan kata sandi.
- Tambahkan alur yang belum memiliki desain: keranjang/alamat/checkout/Snap/status/detail pesanan/ulasan/penanganan admin; usulkan layout menggunakan bahasa visual yang sama tanpa menciptakan fitur bisnis baru.

**Selesai jika:** semua halaman P0 memiliki sumber data dan state; aset kurang tercatat; task FE berikutnya memiliki referensi yang jelas. Belum mengubah kode produk, memasang dependency, menulis DB, atau membuat transaksi. Jika Figma tidak tersedia, lanjutkan dari ekspor dan nyatakan ukuran/font belum terverifikasi.

### FE-01 — Fondasi UI, tema, komponen, dan API client

**Hasil 24 Oktober 2026: Selesai untuk fondasi.** [UI-FOUNDATION.md](UI-FOUNDATION.md) mencatat tema/font lokal berlisensi, 14 primitive shadcn/Radix, wrapper form/state/status/pagination, layout publik dan API client browser. Pratinjau `/dev/ui` development memakai data contoh; produksi 404. 39 tes baru in-memory; total 14 file/142 unit-regresi lulus, lint/typecheck/build dan scan grafik impor/bundle lulus. Browser 360/768/1440px, dialog/fokus, drawer, error form, Select/checkbox, pending/toast/pagination diperiksa. Tidak menjalankan DB/provider atau mengubah backend/task/.env. Halaman bisnis dan penerimaan seluruh desain/alur/deployment tetap task berikutnya. **FE-02 siap dimulai.**

**Acuan:** PRD 7/15/16; kontrak bagian aturan bersama. **Dependensi:** FE-00.

- Siapkan tema krem/oranye/cokelat, font berdasarkan audit, spacing, radius, breakpoint dan fokus; sesuaikan komponen shadcn/ui dengan identitas toko.
- Bangun komponen tombol, input/field error, badge, dialog, tabel, pagination, toast, skeleton, empty/error state, serta layout publik.
- API client menangani envelope, 404/405 non-JSON, 401/403/409/422/429/503, Retry-After, pembatalan pembacaan dan requestId tanpa PII.
- Format Rupiah integer dan waktu Asia/Jakarta; nilai null tidak berubah menjadi angka atau status contoh.
- Pisahkan modul server-only dari komponen browser; jangan mengimpor Prisma/config server ke client bundle.

**Selesai jika:** komponen dapat digunakan ulang, state dapat ditinjau, typecheck/lint/build relevan lulus, dan tidak ada kebocoran rahasia pada konfigurasi/client bundle yang diperiksa. Tes fokus pada perilaku error/asinkron yang berisiko, bukan sekadar snapshot setiap elemen.

### FE-02 — Auth, sesi, navigasi peran, dan proteksi tampilan

**Hasil 24 Oktober 2026: Selesai untuk fungsi.** [FE02-AUTH-VERIFICATION.md](FE02-AUTH-VERIFICATION.md) memuat login/register, konfirmasi cookie lewat GET sesi, logout, return path aman, header/drawer peran serta gate akun/admin. Total 183 tes unit/regresi lulus; lint/typecheck/build/boundary lulus. Browser memakai API Next nyata pada test 55433: register/login/logout, 401/409/429, role, sesi dicabut, role berubah dan navigasi ponsel terverifikasi. Mock terpisah mencakup 422, gangguan sesi/logout 503 dan fokus error. Fixture baru dibersihkan terarah, enam fingerprint cleanup cocok. Tidak mengubah dev/backend/task/pembayaran. Logo/pola/kolase auth belum tersedia terpisah; visual Figma identik dan UAT produk belum diterima. **FE-03 siap dimulai.**

**Acuan:** FR-01/FR-14, kontrak auth. **Dependensi:** FE-01.

**API:** `/api/auth/register`, `/login`, `/logout`, `/session` pada prefix `/api/auth`.

- Registrasi nama/email/password/confirmPassword; tanpa jenis kelamin, alamat wajib, atau Ingatkan Saya yang belum didukung.
- Ambil sesi dari server; role BUYER/ADMIN mengarahkan navigasi yang benar. Login/logout memperbarui tampilan dan cache data akun.
- Gunakan return path relatif/internal yang aman; jangan membuka arbitrary redirect dari query pengguna.
- Saat sesi kedaluwarsa, jangan menampilkan data akun lama. Admin tidak diperlakukan sebagai buyer untuk checkout atau review.

**Selesai jika:** registrasi/login/logout diuji di browser; error field, loading, salah kredensial, 401/403 dan navigasi role benar. Proteksi UI tidak diklaim menggantikan otorisasi API.

### FE-03 — Beranda, kategori, katalog, dan detail produk

**Hasil 24 Oktober 2026: Selesai untuk fungsi.** [FE03-CATALOG-VERIFICATION.md](FE03-CATALOG-VERIFICATION.md) memuat beranda/hero lokal, katalog publik/filter/pagination, detail/ulasan server, demo/fallback dan add-cart peran BUYER. 218 unit/regresi lulus, lint/typecheck/build/boundary lulus. Browser/API PostgreSQL test membuktikan 9+2 produk, kosong/404/foto rusak, login-return/add, konflik stok, role admin dan respons cart sengaja hilang setelah commit tanpa replay. Overlay rating/503 dibedakan dari API nyata. Overflow kategori panjang diperbaiki; retest 360/768px lulus. Dua run cleanup exit 0, lima fingerprint tabel cocok, user fixture 0; tanpa order/payment/provider/worker manual/dev/task changes. Logo/cutout/banner/about/konten resmi dan penerimaan Figma identik tetap gap visual. **FE-04 siap dimulai.**

**Acuan:** FR-02, PRD 7/24. **Dependensi:** FE-01; FE-02 untuk aksi tambah.

**API:** `GET /api/categories`, `/api/products`, `/api/products/{id}`, `/api/products/{id}/reviews`.

- Terapkan hero, kategori, kartu serta cerita toko sesuai Figma; gunakan data produk aktual dan label demo bila `isDemo`.
- Banner menyebut 20% pembeli baru, maksimal Rp100.000, sekali pakai. Tidak ada minimum belanja yang ditambahkan dari gambar.
- Produk nonaktif/habis ditangani sesuai respons; foto hilang memiliki fallback yang jelas dan alt text.
- Gunakan `meta.ratingSummary` untuk agregat; jangan menghitung rata-rata dari halaman ulasan saat ini.
- Tidak membuat CRUD CMS/testimoni, formulir kontak aktif, pencarian pelanggan lanjutan, atau ranking terlaris tanpa cakupan dan data yang mendukungnya. Gunakan konten konfigurasi resmi atau placeholder terlabel.

**Selesai jika:** katalog publik, detail, kategori, add-to-cart/navigation dan seluruh state utama bekerja di desktop/ponsel; data admin/pelanggan konsisten; gambar bukan screenshot satu halaman sebagai UI.

### FE-04 — Alamat, keranjang, dan informasi voucher

**Hasil 24–25 Oktober 2026: Selesai untuk fungsi.** [FE04-BUYER-VERIFICATION.md](FE04-BUYER-VERIFICATION.md) mencatat CRUD alamat, cart PATCH absolut/DELETE, badge aktual dan voucher. 245 unit/regresi, lint/typecheck/build/boundary lulus. Dua run browser/API test nyata membuktikan invalid/conflict, respons hilang setelah commit tanpa replay, perbaikan badge, harga berubah/overflow, alamat 6+1, sesi dicabut/admin dan responsif. RESERVED/USED/null voucher memakai mock, AVAILABLE API nyata. Tiga run cleanup exit 0, delapan fingerprint cocok dan user fixture 0. Browser tidak terhubung setelah restart; dua perbaikan visual kecil terakhir hanya diverifikasi statis/build. Kontrak GET cart yang sudah overflow sejak pembacaan pertama tetap memerlukan pemeriksaan harga admin; tidak menebak ID item. Setup cluster existing dan Next.js dinyalakan 25 Oktober sesuai instruksi pengguna; task dan logika pembayaran tidak diubah. **FE-05 siap dimulai**; pemilihan alamat/quote/konfirmasi checkout belum dibuat.

**Acuan:** FR-03/FR-04/FR-05. **Dependensi:** FE-02/FE-03.

**API:** `/api/addresses`, `/api/addresses/{id}`, `/api/cart`, `/api/cart/items`, `/api/cart/items/{id}`, `/api/me/voucher`; metode persis mengikuti kontrak.

- CRUD alamat milik pembeli dan kuantitas/hapus item; tampilkan perubahan harga/stok dari server.
- Badge keranjang diambil dari data aktual dan diperbarui setelah mutasi.
- Tampilkan voucher AVAILABLE/RESERVED/USED dengan penjelasan; AVAILABLE bukan jaminan reservasi checkout.
- Jangan membuat stok atau diskon dianggap terkunci hanya karena ada di keranjang.

**Selesai jika:** keadaan kosong, sesi hilang, kegagalan mutasi, jumlah invalid dan stok berubah dapat dipulihkan tanpa data palsu. Total transaksi final tetap berasal dari quote server.

### FE-05 — Quote dan konfirmasi checkout idempoten

**Hasil 25 Oktober 2026: Ditinjau.** [FE05-CHECKOUT-VERIFICATION.md](FE05-CHECKOUT-VERIFICATION.md) mencatat `/checkout`, pilihan alamat, quote server, persetujuan eksplisit, key/referensi minimal per tab/akun, recovery dan hasil order. 266 unit/regresi, lint/typecheck/build/boundary serta tiga kelompok controller frontend + HTTP Next + PostgreSQL test lulus. Respons hilang setelah commit dipulihkan dengan input/key sama, satu order/reservasi, deadline tetap dan GET setelah hasil diketahui. Perubahan harga/expiry/stok/delivery ditangani. Cleanup 15 fingerprint cocok; tanpa provider/worker manual/dev/task/config changes. Browser belum dijalankan: DOM connector tidak tersedia dan izin kontrol Chrome timeout; checkpoint UI FAILED dengan cleanup PASS dipertahankan. **Belum Selesai** sebelum interaksi/reload/keyboard/responsif browser terbukti. FE-06 dapat mengintegrasikan Snap dari hasil order, tetapi tidak menutup gap FE-05.

**Acuan:** FR-06, docs CHECKOUT dan kontrak. **Dependensi:** FE-04.

**API:** `POST /api/checkout/quote` dengan `{addressId}`, `POST /api/orders` dengan `{quoteId}` dan `Idempotency-Key`.

- Tampilkan item, salinan alamat, subtotal, diskon, ongkir Rp10.000 dan total dari quote; wilayah delivery mengikuti server.
- Quote TTL lima menit dan belum mereservasi stok. CHECKOUT_CHANGED/QUOTE_EXPIRED memerlukan quote baru dan persetujuan tampilan terbaru.
- Buat key sebelum submit dan pertahankan untuk retry jaringan tindakan konfirmasi yang sama; jangan generate key baru karena timeout atau render ulang.
- Pulihkan konteks konfirmasi yang belum pasti secara minimal di tab yang sama tanpa menyimpan rahasia; batasi ke sesi/akun dan hapus pada logout. Snapshot lama bukan sumber nominal yang dipercaya.
- Disable submit ganda membantu UX, tetapi tetap gunakan jaminan server. Jangan mengganti body untuk key yang sama.

**Selesai jika:** pengujian respons hilang/retry tidak membuat order baru; konflik stok/harga/quote ditangani; payload tidak mengirim harga/userId/role dari browser sebagai otoritas.

### FE-06 — Snap Sandbox, status, retry, dan finish

**Hasil 25 Oktober 2026: Ditinjau.** [FE06-PAYMENT-VERIFICATION.md](FE06-PAYMENT-VERIFICATION.md) mencatat route `/pembayaran/[orderId]`, Next/Script Snap Sandbox, gating/lock, callback GET-only, rekonsiliasi eksplisit/cooldown, countdown/status dan finish dari konteks tab minimal. 302 unit/regresi (36 baru), lint/typecheck/build/boundary lulus. Empat kelompok controller/HTTP/PostgreSQL test lulus: regresi checkout ditambah owner GET/foreign 404, key kosong ditolak sebelum Payment dibuat, canReconcile=false tidak mengirim pemeriksaan, dan query finish palsu tidak melunaskan order. Mock menangani 201/200/202/SDK/callback/reconcile; bukan bukti provider nyata. Cleanup 15 fingerprint cocok, user fixture 0, provider call 0. Snap config valid tetapi webhook config belum valid. **Belum Selesai** sebelum browser dan uji VA Sandbox baru diotorisasi/dibuktikan sesuai [rencana](FE06-SANDBOX-PLAN.md). FE-05 tetap Ditinjau; tidak ada transaksi provider baru, perubahan dev/.env/task/backend atau rekonsiliasi manual.

**Acuan:** FR-07, PAYMENTS/WEBHOOKS/RECONCILIATION dan handoff. **Dependensi:** FE-05; callback HTTPS yang valid untuk pengujian transaksi baru.

**API:** `POST /api/orders/{id}/payments {}`, `GET /api/orders/{id}`, `POST /api/orders/{id}/payments/reconcile {}`.

- Tindakan bayar eksplisit memulai/melanjutkan Snap; 200 reuse/201 baru/202 belum pasti ditampilkan dengan benar.
- Jangan memanggil create/reconcile dari effect yang berulang. Polling GET lokal bila digunakan dibatasi, berhenti saat unmount/terminal, dan tidak melakukan panggilan gateway otomatis.
- Callback sukses, redirect finish dan penutupan popup hanya memicu pembacaan keadaan lokal; tidak mengubah status menjadi sukses/gagal sendiri.
- Tombol rekonsiliasi mengikuti `canReconcile`, izin dan limiter. Retry hanya setelah server mengizinkan dan tidak mengganti deadline 60 menit.
- Countdown memakai paymentDeadline; nol bukan bukti reservasi telah dilepas. Tampilkan NEEDS_ATTENTION/refund/reversal tanpa janji refund otomatis.
- Kembali dari Snap ke order milik pengguna melalui konteks yang aman; jangan menaruh Snap token atau redirect URL pada URL internal/analytics.

**Selesai jika:** uji state mock/browser close/finish/refresh/timeout lulus; uji UI provider baru dicatat hanya bila dilakukan sesuai rencana sandbox yang diotorisasi. Jika HTTPS/provider belum siap, task tetap Ditinjau/Terhambat untuk kriteria itu, bukan Selesai palsu. Jangan memakai ulang referensi pembayaran lama.

### FE-07 — Riwayat/detail pembeli dan ulasan terverifikasi

**Hasil 25 Oktober 2026: Ditinjau.** [FE07-ORDERS-VERIFICATION.md](FE07-ORDERS-VERIFICATION.md) mencatat `/pesanan`, detail/snapshot/history publik, filter/pagination dan ulasan per item melalui kelayakan server. 335 unit/regresi (33 baru), lint/typecheck/build/boundary dan empat kelompok controller/HTTP/PostgreSQL test lulus. Riwayat 5+2, detail dua item, snapshot/privasi, foreign 404/admin 403, respons ulasan hilang setelah commit tanpa replay, duplicate/not-completed, pembelian ulang dan agregat publik terverifikasi. Penghitung Unicode UI diselaraskan dengan Zod terpasang dan batas HTTP diuji; backend tidak diubah. Cleanup 15 fingerprint cocok, fixture user 0, provider call 0. Pesanan Selesai baru adalah fixture sintetis, bukan bukti bayar/fulfillment baru. `--orders-ui` disiapkan tetapi belum dijalankan. **Belum Selesai** sampai owner/foreign/empty/error/pagination/submit dan responsif browser terbukti; FE-05/06 tetap Ditinjau. FE-08 dapat mulai dengan gap penerimaan tetap tercatat.

**Acuan:** FR-08/FR-11. **Dependensi:** FE-02/FE-06.

**API:** `GET /api/orders`, `/api/orders/{id}`, `POST /api/order-items/{itemId}/review`, serta baca ulasan publik.

- Tampilkan multi-item, nomor, snapshot harga/alamat, dua jenis status dan history publik yang diberikan server; tidak membangun ulang catatan admin.
- Form ulasan hanya saat `canReview`/kelayakan server; rating integer 1–5, komentar trim 10–1.000 karakter.
- REVIEW_EXISTS/ORDER_NOT_COMPLETED dan perubahan sesi ditangani dengan muat ulang aman, tanpa loop submit.

**Selesai jika:** halaman pemilik, foreign owner, kosong/error, pagination dan submit ulasan valid/gagal teruji pada browser; nama/komentar dirender sebagai teks aman.

### FE-08 — Layout admin dan dashboard operasional

**Hasil 25 Oktober 2026: Ditinjau.** [FE08-ADMIN-DASHBOARD-VERIFICATION.md](FE08-ADMIN-DASHBOARD-VERIFICATION.md) mencatat sidebar/header/drawer, profil readonly yang dipindahkan, dashboard server dan periode hari WIB inklusif → batas UTC eksklusif. 359 unit/regresi (24 baru), lint/typecheck/build/boundary dan empat kelompok controller/HTTP/PostgreSQL test lulus. Batas from/to, status nol/total/latest, inventaris global saat periode kosong, reservasi/nonaktif/stok nol, cuplikan 10 versus hitungan penuh, 401/403/sesi dicabut dan GET tanpa perubahan produk/order terverifikasi. Cleanup 15 fingerprint cocok, user fixture 0, provider call 0. PNG admin diperiksa sebagai referensi; tidak ada metrik/grafik/ranking palsu. Menu modul FE-09–FE-11 belum aktif, profil edit tetap FE-11. `--dashboard-ui` disiapkan tetapi belum dijalankan. **Belum Selesai** sampai browser/gate/drawer/logout/keyboard/responsif terbukti. FE-05–FE-07 tetap Ditinjau; FE-09 dapat mulai.

**Acuan:** FR-13, PRD 24. **Dependensi:** FE-01/FE-02.

**API:** `GET /api/admin/dashboard`; sesi role admin.

- Sidebar P0: Dashboard, Produk, Kategori, Pesanan, Pembayaran, Voucher Pembeli Baru, Akun Saya, Logout; tidak mengaktifkan seluruh menu settings pada Figma.
- Kirim from/to UTC dengan konversi batas tanggal Asia/Jakarta yang benar; jelaskan periode metrik.
- Bedakan inventaris global saat ini dari metrik pesanan berperiode; tampilkan angka nol yang asli dan cuplikan listLimit=10 sebagai cuplikan.
- Warna stok dan status disertai label; admin layout responsif dengan navigasi yang dapat digunakan di ponsel.

**Selesai jika:** definisi angka cocok kontrak, filter tanggal tidak bergeser zona waktu, empty/error/loading bekerja; tidak ada grafik dummy atau klaim laba.

### FE-09 — Admin kategori, produk, foto, dan stok

**Hasil 25 Oktober 2026: Ditinjau.** [FE09-CATALOG-VERIFICATION.md](FE09-CATALOG-VERIFICATION.md) mencatat `/admin/kategori` dan `/admin/produk`, kategori berhalaman, form metadata, upload terpisah dan PUT stok dengan versi terbaru. 387 unit/regresi (28 baru), lint/typecheck/build/boundary dan tujuh kelompok controller/HTTP/PostgreSQL test lulus. Foto valid WebP/pending/public, duplicate/FK kategori, metadata tanpa stok, snapshot historis, versi/reservasi, nonaktif dan respons create hilang tanpa replay diuji. Cleanup 16 fingerprint tabel dan arsip foto test cocok; user fixture nol, provider call nol. Dua preflight arsip dan satu kegagalan cleanup voucher/user serta recovery terarah dicatat, bukan disembunyikan. **Belum Selesai** sampai CRUD/upload/stok/cancel/akses/keyboard/responsif browser terbukti. Tidak mengubah backend, dev, `.env`, task atau melakukan pembayaran. FE-10 dapat mulai; gap FE-05–FE-08 tetap terbuka.

**Acuan:** FR-09, CATALOG, PRD 24. **Dependensi:** FE-08.

**API:** `/api/admin/categories`, `/api/admin/products`, `/api/admin/product-photos`, serta `/api/admin/products/{id}/stock`.

- Daftar/filter/pagination dan formulir tambah/ubah/nonaktif sesuai kemampuan endpoint; kategori dari sumber tersimpan.
- Stok tanpa prefiks Rp. Pisahkan physical/reserved/available dan aktif/nonaktif dari stok habis.
- Upload tepat satu file JPEG/PNG/WebP maksimal 2.000.000 byte, tanpa Content-Type JSON untuk FormData; preview bukan bukti server menerima foto.
- Perubahan stok mengikuti kontrak `expectedUpdatedAt`; konflik memerlukan muat ulang, tidak menimpa reservasi.
- Produk historis tidak dihapus paksa. Tampilkan kesalahan kategori masih digunakan dan hasil batal konfirmasi dengan benar.

**Selesai jika:** CRUD/unggahan/stok memakai API nyata di browser; validasi file, konflik versi, akses admin, cancel dan kegagalan jaringan diperiksa.

### FE-10 — Admin pesanan, pembayaran, catatan, dan fulfillment

**Hasil 25 Oktober 2026: Ditinjau.** [FE10-ORDERS-VERIFICATION.md](FE10-ORDERS-VERIFICATION.md) mencatat daftar/detail pesanan, attempt pembayaran, filter/pagination, catatan privat dan transisi expectedStatus. Selesai wajib checkbox konfirmasi manual dan note, tanpa penyelesaian otomatis. 415 unit/regresi (28 baru), lint/typecheck/build/boundary serta tujuh kelompok controller/HTTP/PostgreSQL test lulus. Akses/Origin, 10+1 order/10+2 attempt, tanggal WIB, attempt historis, eligibility server, SHIPPED bersamaan satu sukses/satu konflik, receipt 422, Selesai sekali, note respons hilang tanpa replay dan privasi pembeli teruji. Cleanup 18 fingerprint cocok dan user fixture nol. Pembayaran sintetis, provider call nol. Mode browser UI_READY tetapi izin kontrol Chrome timeout; checkpoint FAIL dengan cleanup PASS dipertahankan. **Belum Selesai** sampai interaksi browser/cancel/conflict/keyboard/responsif terbukti. Tidak mengubah backend, dev, konfigurasi atau task. FE-11 dapat mulai; gap FE-05–FE-09 tetap terbuka.

**Acuan:** FR-10, ORDERS, PRD 24. **Dependensi:** FE-08/FE-06.

**API:** `/api/admin/orders`, `/api/admin/orders/{id}`, `/api/admin/payments`, status PATCH dan notes POST per order.

- Tabel memisahkan nomor pesanan, pembeli, item, nominal, kanal, status pembayaran/pesanan. Tidak memakai status Aktif/Tidak Aktif atau hapus rutin transaksi.
- Detail memuat attempts/history dan catatan privat sesuai hak akses; filter mengikuti kontrak, bukan semua pilihan bebas pada gambar.
- Transisi menggunakan `expectedStatus`; Selesai mengharuskan checkbox konfirmasi operasional yang tidak dicentang otomatis serta note.
- Konflik status/NEEDS_ATTENTION memuat keadaan terbaru; tidak ada override sukses atau pengiriman yang belum diizinkan.

**Selesai jika:** alur SHIPPED/COMPLETED dengan catatan, cancel dialog, conflict, akses dan multi-attempt teruji; informasi internal tidak muncul pada halaman pembeli.

### FE-11 — Admin voucher tetap dan akun sendiri

**Hasil 25 Oktober 2026: Ditinjau.** [FE11-ACCOUNT-VOUCHER-VERIFICATION.md](FE11-ACCOUNT-VOUCHER-VERIFICATION.md) mencatat `/admin/voucher` readonly, policy tetap, relasi/pagination/status dan `/admin/akun` GET/PATCH nama akun sendiri. 437 unit/regresi (22 baru), lint/typecheck/build/boundary serta tujuh kelompok HTTP/PostgreSQL test lulus. Akses/Origin, semua status dan halaman cocok SQL, relasi RESERVED/USED, voucher tidak berubah karena GET, dua admin terisolasi, body ID/email/role ditolak, nama trim/Unicode/session refresh dan respons hilang tanpa replay diuji. Cleanup 18 fingerprint cocok, user fixture nol, provider call nol. **Belum Selesai** sampai interaksi browser/cancel/error/pagination/keyboard/responsif terbukti. Tidak mengulang izin kontrol Chrome yang baru timeout pada FE-10. Tidak mengubah backend, dev, `.env` atau task. FE-12 berikutnya; gap FE-05–FE-10 tetap terbuka.

**Acuan:** FR-13/FR-14. **Dependensi:** FE-08.

**API:** `GET /api/admin/vouchers`, `/api/admin/voucher-policy`; `GET/PATCH /api/admin/me`.

- Voucher menampilkan aturan tetap, pemilik/relasi pesanan, state dan pagination; tidak ada Tambah Promo, reset voucher, minimum belanja, atau beli 2 gratis 1.
- Profil admin hanya nama yang dapat diubah; email/peran informasi. Avatar/username/telepon/password baru tidak ditambahkan sebagai fungsi aktif.

**Selesai jika:** semua kontrol sesuai kontrak, error simpan/pagination ditangani dan tidak ada peran/akun lain yang bisa diubah dari UI.

### FE-12 — Verifikasi browser, responsif, alur produk, dan handoff

**Hasil 25 Oktober 2026: Ditinjau, belum Selesai.** [FE-VERIFICATION.md](FE-VERIFICATION.md) merekonsiliasi bukti tiap task. Bug refresh fokus sesi yang membuang draft diperbaiki; 438 unit/regresi dan lint/typecheck/build/boundary lulus. Browser checkout kini membuktikan pilihan alamat, quote/persetujuan, respons konfirmasi hilang, reload dan recovery order sama; checkpoint PASS/cleanup 15 tabel. Hasil order diperiksa pada lebar 360/768/1440 sebagai smoke visual, bukan audit semua halaman. Admin Batal/pengiriman/validasi konfirmasi/Selesai serta note respons hilang sempat diamati, tetapi runner timeout sebelum checkpoint ditutup: tetap FAIL, cleanup 18 tabel PASS. Browser katalog/ulasan/dashboard/profil/voucher dan state lain belum tuntas; UI VA Sandbox baru/aset final belum tersedia. Seluruh server test berakhir; tidak mengubah dev/task/backend/provider. Indeks artefak read-only dan tindak lanjut spesifik tersedia pada laporan; tidak menaikkan seluruh task menjadi Selesai.

**Acuan:** PRD 16/17/22; UAT frontend termasuk 22/23/24/27/29 dan bagian UI transaksi lainnya. **Dependensi:** FE-00–FE-11.

- Verifikasi lebar 360/768/1440, keyboard/fokus, kontras, label, dialog, gambar, loading/error/empty/conflict.
- Bandingkan halaman dengan Figma/PNG; catat deviasi yang disengaja karena PRD atau aset belum final.
- Uji alur buyer dan admin menggunakan API nyata, cookie/sesi dan database lokal yang diizinkan. Rencanakan fixture terisolasi agar tidak mengubah pesanan/aset lama untuk tes.
- Pengujian provider/UI dibedakan dari mock dan bukti backend historis. Jangan mengklaim pembayaran UI telah dibuktikan oleh test backend.
- Jalankan lint/typecheck/build serta pemeriksaan regresi relevan sesudah perubahan; perbaiki kegagalan yang terkait.
- Buat laporan `docs/FE-VERIFICATION.md` dan handoff, termasuk kriteria yang belum selesai, aset placeholder dan kesiapan lingkungan.

**Selesai jika:** cakupan frontend P0 benar-benar lulus atau gap penerimaan dicatat sebagai belum selesai. Frontend diterima tidak berarti produksi/deployment otomatis siap.

## 4. Catatan setiap task

```markdown
### Hasil FE-xx
- Status:
- Tanggal dan penanggung jawab:
- PRD/kontrak acuan:
- Halaman, endpoint, dan berkas yang berubah:
- Sumber Figma/PNG dan deviasi yang disepakati:
- Pemeriksaan aktual beserta hasil:
- Mock / API nyata / provider nyata: jelaskan batasnya
- Kriteria yang belum terpenuhi:
- Catatan task berikutnya:
```

Jika PRD/kontrak berubah, tinjau task yang terdampak. Jangan mengubah definisi selesai hanya agar status task terlihat tuntas.
