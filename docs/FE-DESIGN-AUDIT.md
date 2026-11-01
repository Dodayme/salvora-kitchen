# FE-00 — Audit visual dan pemetaan halaman–API

Tanggal: 24 Oktober 2026. Acuan PRD **1.9**, kontrak API **0.13**, TASKS-FRONTEND dan prompts/FE-00. **Audit/pemetaan selesai; belum implementasi halaman.** Backend lokal/Sandbox diterima dengan batas pada BE-VALIDATION-FOR-FE dan BE14-RECONCILIATION. FE-00 tidak mengulang penerimaan backend.

**Pembaruan setelah FE-00:** FE-01 pada 24 Oktober 2026 menuntaskan tema/font lokal, primitive, layout publik dan API client, dengan bukti pada [UI-FOUNDATION.md](UI-FOUNDATION.md). Paragraf kesiapan/gap di audit ini mempertahankan keadaan saat FE-00; font kini lokal, sedangkan logo/aset halaman dan integrasi bisnis tetap tindak lanjut. Tidak ada klaim verifikasi Figma tambahan setelah batas kuota.

## 1. Sumber dan batas inspeksi

- Figma file [Salvora Kitchen](https://www.figma.com/design/Mz9sFXvJbWMbAlgTY9AaaR/Untitled), frame [Beranda pelanggan 29:4](https://www.figma.com/design/Mz9sFXvJbWMbAlgTY9AaaR/Untitled?node-id=29-4). create_session dan get_design_context berhasil, termasuk screenshot/reference code. Font/warna di bagian 5 berasal dari context frame ini, bukan perkiraan PNG.
- Panggilan get_metadata sesudahnya gagal dengan **Figma MCP Starter plan tool call limit**. Tidak mengulang panggilan untuk menghindari kuota, tidak mengganti akun atau mengubah Figma. Node ID/struktur serta token halaman lain belum diverifikasi langsung. Perubahan Figma yang belum ada dalam ekspor lokal tidak dapat dipastikan.
- Seluruh **21 PNG lokal** diperiksa metadata dan contact sheet; register, tambah produk, akun admin dan pesanan juga diperiksa penuh. Rinciannya pada FE-ASSET-INVENTORY. Ekspor visual bukan spesifikasi interaksi/mobile lengkap.
- Struktur saat ini: src/app/page.tsx masih landing sementara, layout/globals.css dasar dan /payment/finish informasional. src/components baru README, public belum ada. Belum ada konfigurasi/komponen shadcn atau font custom terpasang; package.json memakai React/Next/Tailwind, tidak ada primitive UI tambahan.
- Tidak ditemukan AGENTS.md pada workspace/ancestor yang diperiksa. Backlog FE serta validasi backend yang sudah tersedia dipakai, tidak ditimpa dengan rencana baru.

Tidak ada perubahan kode produk, dependency, PRD, kontrak, desain/aset sumber, database/config/Windows task atau transaksi. Artefak inspeksi di .local/fe00 hanya contact sheet dan metadata, bukan aset produk. Tidak ada nilai rahasia dibuka atau dibutuhkan.

## 2. Legenda state dan role

Route berikut **usulan UI**, berbeda dari route API; belum diklaim tersedia. G=guest, B=BUYER pemilik, A=ADMIN. Admin tidak checkout/review sebagai pembeli.

| Kode | State minimum dan perilaku |
|---|---|
| D | Data: loading skeleton, berhasil, kosong sesuai filter, error dengan coba lagi, 404/non-JSON aman; request lama dibatalkan/diabaikan ketika filter berubah |
| S | Sesi: resolving, user=null, role sesuai/tidak sesuai, 401 setelah expiry, 403; sembunyikan data privat lama ketika logout/role berubah; UI guard tidak menggantikan server |
| F | Form: idle, validasi field, submitting/cegah submit ganda, sukses, gagal jaringan/500, 422 per field, 429/503 Retry-After, cancel tanpa mutation; input pengguna tetap ada saat gagal |
| C | Konflik: 409 muat ulang snapshot/status/version, jelaskan perubahan dan minta tinjau ulang; jangan memaksa sukses atau retry mutasi tanpa batas |
| P | Payment: AWAITING_PAYMENT dengan CREATED/PENDING/UNCONFIRMED, paid, terminal gagal/expired, NEEDS_ATTENTION/refund/reversal, loading/belum pasti; hitung mundur 0 tidak sama dengan stok sudah dilepas |

Sukses/empty bukan angka contoh. Daftar memakai meta.pagination, halaman di luar hasil tidak diam-diam dipindah. Semua mutasi JSON memakai cookie same-origin/Origin dan Content-Type sesuai API; upload memakai multipart tanpa menetapkan boundary manual.

## 3. Matriks pelanggan dan publik

Semua path di kolom API tersedia pada kontrak aktif; tidak memanggilnya pada audit ini. State kode di atas adalah kewajiban seluruh halaman yang merujuknya.

| Halaman / route UI usulan | Role | Desain/bukti visual | Komponen dan API aktual | State/koreksi/dependensi |
|---|---|---|---|---|
| Beranda `/` | G/B/A publik | Figma 29:4 + Beranda pelanggan (1).png | Public header, hero, banner voucher, kategori, pilihan produk, tentang/kontak/footer; GET /api/categories dan /api/products | D + S untuk header/cart; FE-03. Banner 20% maksimal Rp100.000 sekali pembeli baru. “Pilihan Kami”, bukan ranking terlaris. Tidak ada form kontak/testimoni kurasi P1 atau nomor contoh sebagai kontak resmi |
| Katalog `/menu?categoryId=…&page=…` | Publik | Halaman menu.png | Category tabs/chips, product cards, pagination; GET /api/categories, GET /api/products dengan categoryId/page/pageSize | D/S/F tambah cart; FE-03. Katalog publik tidak memiliki pencarian/sort lanjutan. Stok nol tetap tampak, tambah disabled; isDemo diberi label, harga dari server |
| Detail `/menu/[productId]` | Publik | Belum ada frame terpisah; komposisi turunan kartu/header | Foto/fallback, harga/stok, jumlah, ulasan; GET /api/products/{id}; POST /api/cart/items {productId,quantity} setelah login B | D/S/F/C; FE-03. 404 produk/kategori nonaktif. Guest diarahkan login dengan returnTo internal tervalidasi; admin tidak melakukan add-cart |
| Ulasan produk `/menu/[productId]#ulasan` | Publik | Pola kartu Ulasan Dan Rating.png; itu bukan form submit | Review list/pagination/stars; GET /api/products/{id}/reviews | D; FE-03/FE-07. meta.ratingSummary untuk seluruh produk, bukan rata-rata halaman. Teks dirender sebagai teks, author hanya displayName |
| Login `/login?returnTo=…` | G | Login.png | Email/password, field error, tautan register; POST /api/auth/login, GET /api/auth/session | S/F; FE-02. Tidak ada remember-me configurable atau forgot-password API P0. ReturnTo hanya path internal yang aman, tidak ke domain luar. Jangan menyimpan cookie/token di localStorage |
| Registrasi `/register` | G | Register.png, wajib koreksi form | name/email/password/confirmPassword; POST /api/auth/register | S/F, 409 EMAIL_EXISTS; FE-02. Hapus gender/alamat/remember-me dari form registrasi; registrasi bersesi tetap BUYER, bukan role pilihan |
| Menu akun/logout pada header | B/A | Icon/header beranda; tambahan interaksi | GET /api/auth/session, POST /api/auth/logout {} | S/F; FE-02. Nama/peran dari server. B ke riwayat/alamat, A ke admin; logout mencabut cookie, tidak sekadar navigasi |
| Keranjang `/keranjang` | B | Belum tersedia; turunan kartu produk | Cart rows, quantity stepper/delete, subtotal/warnings; GET /api/cart, POST /api/cart/items, PATCH /api/cart/items/{id} {quantity}, DELETE path sama {} | D/S/F/C; FE-04. Quantity PATCH absolut, bukan delta. Harga/stok berubah, item unavailable dan overflow ditampilkan. Tidak mereservasi stok; ulang GET setelah delete |
| Alamat `/alamat` + dialog tambah/ubah | B pemilik | Belum tersedia; pola form auth/admin | Daftar/pagination/radio pilihan; GET/POST /api/addresses, PATCH/DELETE /api/addresses/{id} | D/S/F/C; FE-04. Penerima/telepon/alamat/kota/provinsi, postalCode/notes opsional. Jangan isi kontak/data contoh sebagai profil nyata. Alamat historis order tidak ikut berubah |
| Voucher pembeli `/keranjang#voucher`, ringkasan checkout | B | Banner beranda sebagai visual; panel tambahan | Voucher badge/status/ketentuan; GET /api/me/voucher | D/S; FE-04. AVAILABLE/RESERVED/USED persisted bukan janji kelayakan checkout. Tak ada input kode promo umum/minimum tambahan atau reset |
| Checkout `/checkout` | B | Belum ada; layout ringkasan/form mengikuti tema | Pilih alamat, review quote/peringatan, submit; GET /api/addresses dan /api/cart; POST /api/checkout/quote {addressId} → 201, POST /api/orders {quoteId} + Idempotency-Key → 201/200 replay | D/S/F/C; FE-05. Quote TTL 5 menit, tanpa reservasi. Key dibuat dan dipertahankan untuk satu konfirmasi sebelum fetch; network retry memakai key sama. CHECKOUT_CHANGED/QUOTE_EXPIRED butuh quote/tinjau ulang |
| Pembayaran `/pesanan/[orderId]/pembayaran` | B pemilik | Belum ada; Snap disediakan Midtrans | Order/payment status, deadline, buka/lanjut instruksi; GET /api/orders/{id}; POST /api/orders/{id}/payments {} → 201 baru/200 reuse/202 belum pasti; POST /api/orders/{id}/payments/reconcile {} hanya tindakan tepat | D/S/F/C/P; FE-06. Tidak charge dari mount/effect, tidak polling gateway setiap render. Reconcile patuhi canReconcile dan limiter; canPay hint, server memutuskan. Token tidak ke log/analytics/URL aplikasi |
| Finish `/payment/finish` | Publik, data detail memerlukan B/A | Halaman kode informasional sudah ada, visual belum final | Pesan “status diperiksa server”, tautan riwayat; GET /api/auth/session dan GET order hanya jika internal orderId sah sudah diketahui dari flow sendiri | S/D/P; FE-06. Query provider order_id bukan internal ID dan tidak menentukan paid. Tanpa internal ID andal, buka riwayat sendiri; jangan lookup pesanan orang lain/membuat endpoint baru |
| Riwayat `/pesanan?status=…&page=…` | B | Belum ada; kartu/table turunan | GET /api/orders, status filter/pagination | D/S/P; FE-07. Status order dan payment terpisah; ringkasan memuat snapshot multi-item, tidak mengambil nama/harga katalog untuk mengganti order |
| Detail `/pesanan/[orderId]` | B pemilik | Belum ada; detail turunan | GET /api/orders/{id}; items/address/amount snapshot, attempts/history, canPay/canReview/canReconcile | D/S/C/P; FE-07. Foreign/missing 404; admin note bebas disembunyikan. NEEDS_ATTENTION bukan CTA bayar ulang atau janji refund |
| Form review dialog pada detail order | B pemilik, item COMPLETED belum diulas | Ulasan Dan Rating.png hanya referensi kartu; form belum ada | POST /api/order-items/{itemId}/review {rating,comment} → 201, lalu refresh detail/product review | S/F/C; FE-07. Rating integer 1–5; trim 10–1.000. 409 REVIEW_EXISTS/ORDER_NOT_COMPLETED ditangani. Tidak ada edit/hapus/moderasi atau satu review per unit barang |

Untuk semua tambah-cart guest: setelah login kembali ke asal dan **tinjau/lanjutkan aksi**, tanpa mengulang mutasi otomatis yang mungkin sudah berhasil. Cart badge adalah total unit, bukan jumlah baris. Informasi delivery tersedia dalam quote/order; jangan mengarang endpoint konfigurasi toko.

## 4. Matriks admin

Semua halaman admin memakai S dengan role A, navigasi aktif dan menu mobile. Semua daftar memakai D, mutasi F/C sesuai kondisi. Tidak ada CRUD admin lain atau promosi umum.

| Halaman / route UI usulan | Sumber visual | Komponen / API aktual | State dan koreksi / FE |
|---|---|---|---|
| Layout `/admin/*` | Semua PNG admin: sidebar/header/sidebar active orange | Admin guard, sidebar, user menu/logout; GET /api/auth/session, POST /api/auth/logout {} | S/F; FE-08 + FE-02. Menu Dashboard/Produk/Kategori/Pesanan/Pembayaran/Voucher/Akun saja sesuai kemampuan. Pengaturan generik bukan modul |
| Dashboard `/admin` | Dashbord - Admin.png | Period picker, status cards, latest, stock lists; GET /api/admin/dashboard?from=UTC&to=UTC | D; FE-08. from inklusif/to eksklusif, total/status/latest berdasarkan order.createdAt sama. Semua status termasuk nol. Produk aktif termasuk stok nol; inventaris global saat ini 1–5/0, listLimit=10 + total penuh. Hapus grafik/ranking/pendapatan/pelanggan dummy, metrik opsional tidak ada pada DTO minimum |
| Kategori `/admin/kategori` + dialog | Kategori Produk fiks - Admin.png terisi, Kategori - Admin.png kosong | GET/POST /api/admin/categories; PATCH /api/admin/categories/{id}; DELETE path sama {} | D/S/F/C; FE-09. Count dinamis; 409 RESOURCE_IN_USE bukan berhasil hapus. isActive terpisah dari jumlah produk, placeholder katalog tidak menjadi data |
| Produk `/admin/produk` | Kelola Produk - Admin.png | GET /api/admin/products dengan q/categoryId/isActive/availability/page/pageSize | D/S/F/C; FE-09. Aktif/nonaktif berbeda dari stok AVAILABLE/LOW/OUT_OF_STOCK. Aksi lihat/edit/stok/nonaktif; tidak ada DELETE produk rutin |
| Tambah `/admin/produk/baru` | Kelola Produk -_ Tambah Produk - Admin.png | GET kategori admin, POST /api/admin/products {categoryId,name,description,price,physicalStock,isActive,photoId?} | F/S/C; FE-09. Sidebar Produk, bukan Pengaturan. Stok tanpa Rp, kategori pilih ID tersimpan, ada Simpan/Batal, validasi input dan loading |
| Edit `/admin/produk/[id]/edit` | Turunan form tambah, frame edit belum tersedia | GET /api/admin/products/{id}; PATCH path sama, subset produk tanpa physicalStock | D/S/F/C; FE-09. Tampilkan stok read-only/link dialog stok; jangan mengirim physicalStock pada PATCH. Nonaktif tidak menghapus histori |
| Foto pada form produk | Kolom upload/preview form tambah | POST /api/admin/product-photos multipart file → {photoId,url}; GET /api/product-photos/{photoId} | F/S; FE-09. JPEG/PNG/WebP <=2.000.000 byte; preview pending/admin-only, error upload tidak dianggap produk tersimpan. Simpan photoId, bukan path/nama file client; cancel tidak mengarang endpoint hapus foto |
| Stok dialog pada `/admin/produk/[id]/edit` | Input stok dalam desain dikoreksi, dialog baru | GET detail admin, PUT /api/admin/products/{id}/stock {physicalStock,expectedUpdatedAt} | F/S/C; FE-09. Tidak kurang dari reservedStock. 409 RESOURCE_VERSION_CONFLICT/STOCK_RESERVED refresh dan tinjau, tidak overwrite diam-diam |
| Daftar `/admin/pesanan` | Pesanan - Admin.png | GET /api/admin/orders dengan q/status/paymentStatus/channel/from/to/pagination | D/S/P; FE-10. Cari nomor pesanan, bukan ID pelanggan; dua kolom status, multi-item snapshot, kanal aktual. Hapus ekspor/hapus transaksi dan Aktif/Tidak Aktif. Summary priority refund/reversal/success tidak menyembunyikan attempts |
| Detail `/admin/pesanan/[id]` | Belum ada; table/card admin sebagai pola | GET /api/admin/orders/{id}; POST /api/admin/orders/{id}/notes {note} → 201; PATCH /api/admin/orders/{id}/status {status,expectedStatus,note?,receiptConfirmed?} | D/S/F/C/P; FE-10. PROCESSING → SHIPPED → COMPLETED, checkbox penerimaan tidak default true dan note wajib saat Selesai. expectedStatus dari hasil terkini, conflict refresh. Catatan NEEDS_ATTENTION tidak override sukses/refund |
| Monitoring `/admin/pembayaran` | Pengaturan -_ Pembayaran - Admin.png hanya pola panel, tabel tambahan | GET /api/admin/payments dengan status/orderId/channel/from/to/pagination; tautan detail order; reconcile order POST {} bila tindakan berwenang diperlukan | D/S/F/C/P; FE-10. Tanpa COD/rekening manual/toggle e-wallet/server key. Filter kanal berasal nilai tercatat, bukan janji semua kanal merchant aktif |
| Voucher `/admin/voucher` | Promosi.png diubah isi/aksi | GET /api/admin/voucher-policy; GET /api/admin/vouchers?status=…&page=… | D/S; FE-11. 20%/maks100.000/sekali, status owner/reservedOrder/usedOrder, tidak ada Tambah/Edit/Hapus Promo/reset/minimum/beli 2 gratis 1 |
| Akun `/admin/akun` | Pengaturan -_ Akun Admin - Admin.png | GET /api/admin/me; PATCH {name}; logout POST /api/auth/logout {} | D/S/F; FE-11. Hanya name editable. Email/peran info, avatar/username/nomor HP tidak diunggah/diedit, tanpa admin CRUD lain |
| Informasi delivery pada checkout/detail, tanpa halaman setting baru | Pengaturan -_ Pengiriman - Admin.png referensi visual saja | shipping snapshot dari quote/order dan kebijakan tetap PRD; tidak ada API CRUD tarif/wilayah | FE-05/10. Kota Tanjungpinang, Kepulauan Riau Rp10.000; tanpa pickup/gratis ongkir/per-kecamatan configurable |

Tidak ada route P0 untuk export, CMS profil toko, notifikasi, atau pengaturan metode bayar/pengiriman configurable. Kartu menu Pengaturan - Produk.png tidak mengharuskan semua subpage dibuat. Rincian endpoint/payload tetap mengacu API-CONTRACT; audit tidak menambah endpoint baru.

## 5. Arahan tema dan komponen FE-01

### Nilai langsung dari Figma beranda 29:4

| Token kandidat | Nilai terbaca | Bukti konteks |
|---|---|---|
| background | #FFF6EF | Root frame 29:4, kartu/CTA kategori |
| foreground | #4E342E | Teks judul/body, contoh 36:24/36:51 |
| brand | #FF7A00 | Label/logo dan kategori, 74:612/30:17 |
| CTA kuat | #B7260C | Hero/category/about CTA 36:165/36:52/47:62 |
| surface alternatif | #F8E8D5 / #F0D8C0 | Produk 30:15 dan testimoni 36:7 |
| contact accent | #F97316 | Section 36:4; bukan berarti setiap CTA memakai warna ini |
| heading | Abhaya Libre Bold, contoh 64px desktop | Hero 36:163 dan section titles; 50px contact 36:231 |
| body/label | Poppins Light/Medium/SemiBold/Bold | Contoh body 20px 36:162/36:51, label 24px, card title20/desc12/price16 |
| radius | 20/22/28/30px pada elemen berbeda | Testimoni/card/photo/banner/button context |
| komposisi desktop | Frame 1440, hero 1440×552; konten kategori sekitar1306px | 30:5/47:46; bukan layout tetap untuk mobile |

Warna/font/shadow/breakpoint admin dan auth belum diverifikasi node Figma, hanya pola visual PNG. Existing globals.css (#fff8ee/#44291d/#bd4c21, Arial/Georgia) adalah baseline sementara yang **belum** diselaraskan. FE-01 membuat semantic tokens shadcn background/foreground/primary/secondary/muted/border/input/ring/destructive, bukan menyalin warna literal di semua halaman. Jangan mengklaim kontras/fokus aksesibel hanya dari screenshot; uji pasangan warna saat FE-01/12 dan gunakan CTA kuat/dark text yang terbaca.

### Usulan implementasi, bukan ukuran hasil Figma

- FE-01 dapat dimulai: layout mobile-first, container responsif berpusat mengikuti lebar desktop, padding 16–24px mobile, ukuran heading responsif; breakpoint verifikasi 360/768/1440 dari backlog. Detail gutter/grid/focus/hover mobile adalah rancangan tambahan, bukan spesifikasi mobile yang sudah diberikan.
- Abhaya Libre dan Poppins sudah diketahui namanya, tetapi file font/lisensi/provider belum disediakan lokal. Peroleh dari sumber resmi saat FE-01, atau pakai fallback eksplisit sementara; jangan mengklaim Arial/Georgia identik. Tidak perlu menunggu foto produk final untuk theme/API client.
- shadcn/ui akan dipasang/disesuaikan pada FE-01, belum dipasang dalam FE-00. Minimal: Button (termasuk link button), Input/Label/Textarea, Select/Checkbox, Dialog/AlertDialog/Sheet, Table, Badge, pagination, toast, skeleton. Sediakan loading/empty/error/form message dan payment/status badges semantik.
- PublicHeader/Footer dan AdminShell dipisah; header desktop beranda/menu/anchor tentang/kontak + akun/cart. Mobile menu dapat dibuka/ditutup keyboard, focus management, label tombol ikon dan reduced-motion. Semua gambar punya alt yang sesuai tujuan, dekoratif alt kosong, rasio dan slot ditetapkan untuk mencegah layout meloncat.
- ProductCard/Breadcrumb/Price/OrderStatusBadge/PaymentStatusBadge terpisah dari ORM. Jangan membuat data produk/ulasan/angka admin sebagai literal konten Figma. Penanda isDemo diteruskan dengan jelas.
- API client typed untuk envelope/meta.pagination/meta.ratingSummary; tangani 404/405 non-JSON, abort/race GET, requestId, field errors, Retry-After. Tidak log request/response mentah atau token. Mutasi tidak di-retry generik; hanya konfirmasi order yang mempertahankan Idempotency-Key sesuai desain FE-05.
- Rupiah integer dan UTC → Asia/Jakarta helper bersama. Filter dashboard memakai from/to UTC dari periode UI; inventoryScope CURRENT_ALL_PRODUCTS tidak diberi label periode historis. Endpoint read-only tidak memicu gateway/charge.

## 6. Gap dan tindakan berikutnya

| ID | Gap/batas | Dampak / tindakan | Menghambat |
|---|---|---|---|
| G-01 | Kuota Figma habis setelah beranda; frame lain belum terbaca langsung | Gunakan PNG untuk audit; FE halaman terkait perlu node URL/export presisi ketika tersedia. Jangan menebak node ID atau mengklaim semua halaman terverifikasi | Tidak FE-01; membatasi fidelity halaman lain |
| G-02 | Font file serta icon/logo export belum lokal | FE-01 peroleh font resmi dan primitive/icon konsisten; FE-03/02 ekspor slot identitas/auth dari Figma, bukan crop screenshot | Tidak theme/API; penerimaan visual butuh aset |
| G-03 | Hanya hero aset individual | FE-03 butuh foto kategori/produk/about/banner; fallback gambar hilang terlabel dapat dipakai development. Jangan menjadikan screenshot 1440px sebagai foto item | Tidak FE-01; visual FE-03/12 |
| G-04 | Tidak ada frame mobile/detail/cart/checkout/payment/history/review form/detail admin | Susun layout dari pola tema dengan state pada matriks, review pada FE terkait dan FE-12 | Tidak FE-01; bukan fitur backend baru |
| G-05 | Kontak/menu/foto/harga/testimoni gambar belum resmi | Config konten awal terpisah, sumber API dan label demo; kontak belum final tidak menjadi tautan nomor palsu | Tidak FE-01; konfirmasi sebelum penerimaan konten FE-03 |
| G-06 | Endpoint best-seller/curated testimonial/contact form tidak ada, di luar P0 minimum | “Pilihan Kami” dari katalog dengan label pilihan, tanpa ranking/perhitungan baru. Review per produk sudah ada; bagian testimoni beranda disembunyikan untuk P0, kontak hanya kanal resmi bila tersedia | Tidak P0; jangan menambah API/P1 |
| G-07 | Webhook HTTPS tetap belum disiapkan, tunnel test sudah ditutup | FE-06 verifikasi UI dengan state/mock dahulu; uji provider baru butuh rencana/izin dan endpoint HTTPS aktif. Jangan menjalankan script token di mount | Tidak FE-01–05; penerimaan pembayaran baru |
| G-08 | API daftar kanal merchant, kebijakan shipping CRUD/CMS tidak tersedia | Monitoring kanal tercatat dan informasi delivery saja; jangan membuat pengaturan palsu | Tidak P0 |
| G-09 | Konten/task backend punya paragraf historis dengan gap lama | Gunakan baseline aktif/header penerimaan akhir dan sumber handler; bila konflik nyata muncul catat reproduksi sebelum mengubah backend | Tidak FE-01 |

Tidak ada gap yang menghalangi FE-01 fondasi. Aset final dan spesifikasi mobile membatasi penerimaan visual kemudian, bukan alasan menyatakan halaman selesai dengan placeholder.

## 7. Urutan pengerjaan dan pemeriksaan FE-00

Ikuti backlog yang sudah ada: **FE-01 → FE-02 → FE-03 → FE-04 → FE-05 → FE-06 → FE-07**, kemudian rangkaian admin **FE-08 → FE-09 → FE-10 → FE-11**, dan **FE-12** integrasi/browser/visual. Beberapa dependensi memungkinkan paralel, tetapi proyek memakai satu task aktif yang dapat ditinjau. Tidak menambah BE-15 atau P1.

Pemeriksaan aktual FE-00: baca PRD/kontrak/handoff/backlog/domain docs, sumber frontend serta ekspor PNG; berhasil context+screenshot Figma beranda, metadata berikutnya gagal kuota; metadata/decode/contact sheet 21 PNG berhasil. Percobaan node -e metadata awal gagal quoting PowerShell dan diganti script lokal; SVG label QA menghasilkan peringatan cache font sandbox, contact sheet tetap terbentuk dan diperiksa. Tidak mengubah keamanan/cache global atau menganggap thumbnail sebagai bukti font admin. Dokumen dan link/coverage diperiksa, tidak menjalankan suite DB/provider/build untuk audit dokumentasi.

Keluaran: audit ini, FE-ASSET-INVENTORY dan pembaruan status/task FE-00. **FE-01 siap dimulai**, tetapi tidak dikerjakan sebagai bagian FE-00; semua route usulan dan komponen di atas masih harus diimplementasikan serta diverifikasi.
