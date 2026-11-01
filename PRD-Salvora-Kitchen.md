# Product Requirements Document (PRD)

## Website E-Commerce Salvora Kitchen — Kelompok 11

| Metadata | Keterangan |
|---|---|
| Versi | 1.9 |
| Tanggal | 23 Oktober 2026 |
| Status | Draf untuk dasar perancangan dan implementasi |
| Platform | Website responsif |
| Model bisnis | Business-to-Consumer (B2C) |
| Frontend wajib | React melalui Next.js, Tailwind CSS, dan shadcn/ui |
| Backend | Next.js untuk API dan logika server |
| Database | PostgreSQL |
| Pembayaran | Midtrans Snap Sandbox sebagai payment gateway |
| Sumber adaptasi | Proyek LanggananKu (payment method), diperiksa pada tingkat kode |
| Pembaruan versi | BE-12: rating bulat 1–5, komentar 10–1.000 karakter setelah trim, satu ulasan per item pesanan; disetujui pengguna. Konfirmasi penerimaan manual admin, batas pembayaran 60 menit dan delivery Kota Tanjungpinang Rp10.000 tetap; cakupan fitur tetap |

> Detail yang diberi label **usulan** atau **perlu ditetapkan** belum menjadi keputusan final kelompok. Stack aplikasi telah ditetapkan. Midtrans Snap Sandbox ditetapkan sebagai layanan pembayaran berdasarkan kode LanggananKu yang telah diperiksa. Pemeriksaan sumber belum membuktikan keberhasilan transaksi di Salvora Kitchen; adaptasi dan pengujian integrasi tetap wajib dilakukan.

## Daftar Isi

1. [Ringkasan produk](#1-ringkasan-produk)
2. [Dasar perancangan dan keputusan ruang lingkup](#2-dasar-perancangan-dan-keputusan-ruang-lingkup)
3. [Masalah yang diselesaikan](#3-masalah-yang-diselesaikan)
4. [Tujuan dan indikator keberhasilan](#4-tujuan-dan-indikator-keberhasilan)
5. [Aktor dan hak akses](#5-aktor-dan-hak-akses)
6. [Ruang lingkup dan prioritas](#6-ruang-lingkup-dan-prioritas)
7. [Kebutuhan desain dan pengalaman pengguna](#7-kebutuhan-desain-dan-pengalaman-pengguna)
8. [Kebutuhan fungsional](#8-kebutuhan-fungsional)
9. [Aturan perhitungan transaksi](#9-aturan-perhitungan-transaksi)
10. [Status dan aturan transisi](#10-status-dan-aturan-transisi)
11. [Konsistensi stok, voucher, dan pembayaran](#11-konsistensi-stok-voucher-dan-pembayaran)
12. [Daftar halaman](#12-daftar-halaman)
13. [Kebutuhan data dan penyesuaian RAT](#13-kebutuhan-data-dan-penyesuaian-rat)
14. [Kebutuhan arsitektur dan infrastruktur](#14-kebutuhan-arsitektur-dan-infrastruktur)
15. [Ketentuan teknologi frontend](#15-ketentuan-teknologi-frontend)
16. [Kebutuhan nonfungsional](#16-kebutuhan-nonfungsional)
17. [Skenario pengujian penerimaan](#17-skenario-pengujian-penerimaan)
18. [Keterkaitan dengan diagram](#18-keterkaitan-dengan-diagram)
19. [Tahapan pengerjaan dan keluaran](#19-tahapan-pengerjaan-dan-keluaran)
20. [Risiko dan penanganan](#20-risiko-dan-penanganan)
21. [Keputusan yang masih perlu ditetapkan](#21-keputusan-yang-masih-perlu-ditetapkan)
22. [Definition of Done](#22-definition-of-done)
23. [Acuan dokumen](#23-acuan-dokumen)
24. [Audit desain dan keputusan cakupan admin](#24-audit-desain-dan-keputusan-cakupan-admin)
25. [Pelaksanaan berbasis task dan pengendalian perubahan](#25-pelaksanaan-berbasis-task-dan-pengendalian-perubahan)

## 1. Ringkasan produk

Salvora Kitchen merupakan website e-commerce untuk menjual camilan, dengan kategori awal risol dan cookies. Website membantu pelanggan menemukan produk, melihat harga dan ulasan, memasukkan produk ke keranjang, menggunakan voucher pembeli baru, membayar melalui Midtrans Snap, serta memantau pesanan.

Admin menggunakan halaman pengelolaan untuk mengatur produk, kategori, stok, dan proses pemenuhan pesanan. Status pembayaran diperbarui oleh sistem berdasarkan informasi terverifikasi dari layanan pembayaran.

Tiga fitur utama produk adalah:

1. Voucher otomatis bagi pembeli baru dengan diskon 20% dan maksimal potongan Rp100.000.
2. Checkout dan pembayaran melalui payment gateway Midtrans Snap pada lingkungan sandbox.
3. Rating dan ulasan yang hanya dapat diberikan untuk produk pada pesanan milik pembeli yang telah selesai.

Desain beranda mengutamakan fotografi makanan, warna oranye dan krem, serta navigasi yang sederhana untuk mengarahkan pelanggan dari pengenalan merek menuju pembelian.

Website dibangun dalam satu proyek **Next.js**: frontend menggunakan React, sedangkan API dan logika bisnis dijalankan pada server Next.js. Styling menggunakan **Tailwind CSS**, komponen antarmuka menggunakan **shadcn/ui**, dan data disimpan dalam **PostgreSQL**. Integrasi **Midtrans Snap Sandbox** dari proyek **LanggananKu** diadaptasi dengan mengganti logika langganan menjadi transaksi produk.

## 2. Dasar perancangan dan keputusan ruang lingkup

PRD ini menggunakan proposal awal sebagai dasar kebutuhan dan tiga activity diagram terbaru sebagai pembaruan alur: Checkout & Pembayaran, Kelola Produk, serta Ulasan & Rating.

| Aspek | Ketentuan PRD |
|---|---|
| Identitas toko | Salvora Kitchen, mengikuti referensi desain terbaru |
| Produk awal | Risol dan cookies |
| Pengguna utama | Pembeli dan admin |
| Pembayaran | Midtrans Snap Sandbox; aplikasi berkomunikasi dengan Midtrans, bukan langsung dengan API bank |
| Lingkungan transaksi | Sandbox tanpa perpindahan uang sungguhan |
| Konfirmasi pembayaran | Otomatis setelah informasi pembayaran diverifikasi server |
| Voucher | Diskon 20%, maksimal Rp100.000, sekali pakai per akun |
| Ulasan | Berdasarkan pembelian pada pesanan berstatus Selesai |
| Pengiriman | Dikelola admin tanpa integrasi ekspedisi otomatis |
| Bahasa dan mata uang | Bahasa Indonesia dan Rupiah |
| Metode pengembangan | Waterfall dengan pencatatan perubahan kebutuhan |
| Frontend | React melalui Next.js, Tailwind CSS, dan shadcn/ui; CSS manual tidak menjadi pendekatan utama |
| Backend | Next.js dalam proyek yang sama dengan frontend |
| Database | PostgreSQL dengan database khusus Salvora Kitchen |
| Acuan desain utama | File Figma Salvora Kitchen; ekspor di folder `.Desain` sebagai acuan pendukung |
| Integrasi yang digunakan kembali | Modul Midtrans, pola autentikasi, dan akses PostgreSQL dari LanggananKu setelah disesuaikan dan diuji ulang |

Fitur unggah bukti transfer dan persetujuan pembayaran manual tidak termasuk alur utama versi ini. Bagian proposal dan sequence diagram yang masih menggunakan alur tersebut perlu diperbarui.

**Pemisahan istilah:** Midtrans adalah payment gateway yang menyediakan Snap serta akses ke kanal pembayaran. Bank atau kanal lain merupakan pihak di belakang layanan tersebut. Website mengirim permintaan ke Midtrans dan menerima notifikasi dari Midtrans. Istilah “API bank” pada dokumen awal harus diselaraskan menjadi “Midtrans Snap Sandbox” pada kebutuhan dan diagram implementasi.

Kanal yang diaktifkan pada akun merchant masih perlu diverifikasi. Untuk penerimaan versi awal, minimal satu kanal transfer bank/virtual account sandbox harus berhasil diuji; kanal tambahan tidak dianggap tersedia sampai dikonfigurasi dan diuji. Tidak ada unggah bukti transfer atau persetujuan manual admin sebagai pengganti konfirmasi Midtrans.

## 3. Masalah yang diselesaikan

| Masalah | Kebutuhan produk |
|---|---|
| Informasi menu, harga, dan ketersediaan sulit dilihat dalam satu tempat | Katalog dan detail produk yang terpusat |
| Pembeli baru membutuhkan dorongan untuk mencoba produk | Voucher pembelian pertama |
| Pencatatan pembayaran dapat terlambat atau tidak konsisten | Pembaruan status berdasarkan integrasi pembayaran |
| Admin membutuhkan informasi pesanan yang terstruktur | Daftar pesanan beserta detail dan status pemenuhannya |
| Ulasan dapat kehilangan kredibilitas jika ditulis oleh orang yang belum membeli | Validasi kepemilikan pembelian sebelum ulasan disimpan |
| Tampilan toko perlu membangun ketertarikan terhadap produk | Beranda dengan foto makanan, kategori, produk unggulan, dan informasi merek |

## 4. Tujuan dan indikator keberhasilan

Tujuan produk adalah menyediakan pengalaman belanja yang mudah dipahami, menjaga konsistensi transaksi, dan membantu admin menjalankan operasional toko.

Indikator berikut merupakan target penerimaan proyek, bukan hasil yang telah dicapai.

| Tujuan | Indikator penerimaan |
|---|---|
| Alur belanja lengkap | Pembeli dapat menyelesaikan skenario login → pilih produk → checkout → pembayaran sandbox → pesanan selesai → ulasan |
| Voucher akurat | Seluruh pengujian batas diskon, penggunaan ulang, dan pembayaran gagal menghasilkan nilai yang benar |
| Pembayaran andal | Callback berulang tidak menggandakan pemrosesan pesanan, penggunaan voucher, atau pengurangan stok |
| Ulasan terverifikasi | Seluruh percobaan ulasan atas pesanan orang lain atau pesanan belum selesai ditolak |
| Hak akses terjaga | Pembeli tidak dapat menjalankan fungsi admin atau melihat data pribadi pembeli lain |
| Kemudahan penggunaan | Usulan: minimal 4 dari 5 peserta uji dapat menyelesaikan checkout tanpa bantuan |
| Kesiapan demo | Tidak ada masalah kritis yang menghalangi alur utama pada akhir pengujian |

Setelah website digunakan, jumlah checkout, pesanan berhasil dibayar, penggunaan voucher, dan ulasan terverifikasi dapat digunakan sebagai ukuran perkembangan produk.

## 5. Aktor dan hak akses

| Aktor | Kebutuhan dan hak akses |
|---|---|
| Pengunjung | Mengakses beranda, informasi merek, dan kontak; usulan: dapat melihat katalog dan detail produk sebelum login |
| Pembeli | Mengelola akun, alamat, keranjang, checkout, pembayaran, riwayat pesanan, serta ulasan miliknya |
| Admin | Mengelola kategori, produk, stok, pesanan, dan memantau status pembayaran |
| Midtrans Snap Sandbox | Menerima permintaan transaksi, menyediakan antarmuka pembayaran, mengirim notifikasi, serta menyediakan Get Status API |
| Sistem | Menghitung harga, memvalidasi akses, menerbitkan voucher, memproses informasi pembayaran, dan menjaga konsistensi data |

Akun admin dibuat melalui mekanisme internal. Registrasi publik selalu menghasilkan akun pembeli.

**Keputusan akses katalog (23 Oktober 2026):** beranda, katalog dan detail produk dapat dilihat publik tanpa login. Menambahkan produk ke keranjang dan transaksi tetap memerlukan login. Diagram yang dimulai dari Login diselaraskan dengan keputusan ini pada integrasi berikutnya.

## 6. Ruang lingkup dan prioritas

P0 berarti wajib tersedia agar alur utama dapat digunakan dan didemonstrasikan. P1 merupakan pelengkap setelah P0 berjalan.

| Prioritas | Fitur |
|---|---|
| P0 | Beranda responsif sesuai arah desain |
| P0 | Registrasi, login, logout, dan pembatasan akses berdasarkan peran |
| P0 | Katalog, kategori, detail produk, serta informasi stok |
| P0 | Keranjang dan pengelolaan alamat |
| P0 | Voucher pembeli baru |
| P0 | Checkout dan pembuatan pesanan |
| P0 | Pembayaran Midtrans Snap Sandbox, webhook terverifikasi, dan pemeriksaan status server |
| P0 | Riwayat dan detail pesanan |
| P0 | Pengelolaan produk, kategori, stok, dan status pesanan oleh admin |
| P0 | Rating dan ulasan berdasarkan pembelian selesai |
| P0 | Dashboard operasional sederhana, pemantauan voucher tetap, dan profil dasar akun admin sendiri |
| P1 | Pencarian dan pengurutan produk |
| P1 | Analitik penjualan lanjutan, grafik, dan peringkat produk pada dashboard admin |
| P1 | Testimoni beranda yang bersumber dari ulasan nyata |
| P1 | Formulir kontak dan pengelolaan pesan pelanggan |
| P1 | Moderasi ulasan dengan alasan yang tercatat |

Dashboard P0 hanya merangkum data operasional yang sudah tersedia; tidak mencakup laporan keuangan lengkap. Daftar pada bagian 24 memperjelas keputusan per halaman. Kandidat pengembangan yang belum memiliki aturan rinci tidak otomatis menjadi pekerjaan P0 atau kewajiban versi awal.

Di luar cakupan versi awal:

- Marketplace banyak penjual.
- Transaksi uang sungguhan.
- Pembayaran cicilan.
- Integrasi kurir otomatis dan pelacakan kurir langsung.
- Chat langsung.
- Afiliasi.
- Rekomendasi personal.
- Retur dan refund otomatis.
- COD, transfer manual dengan unggah bukti, promo beli 2 gratis 1, serta mesin promo umum.
- Pickup, tarif dinamis per wilayah, dan gratis ongkir bersyarat sebelum aturan tambahannya ditetapkan.
- Ekspor laporan, pengelolaan konten toko, serta preferensi notifikasi sebagai fitur wajib versi awal.

## 7. Kebutuhan desain dan pengalaman pengguna

### 7.1 Arah visual

Acuan desain utama adalah [file Figma Salvora Kitchen](https://www.figma.com/design/Mz9sFXvJbWMbAlgTY9AaaR/Untitled), dengan [frame Beranda pelanggan](https://www.figma.com/design/Mz9sFXvJbWMbAlgTY9AaaR/Untitled?node-id=29-4). Ekspor PNG pada folder `.Desain` menjadi acuan pendukung untuk halaman pelanggan dan admin.

File Figma mencakup beranda, menu, login/register, ulasan, dashboard, produk, pesanan, promosi, kategori, dan pengaturan. Keberadaan desain halaman tidak otomatis menambah fungsi di luar prioritas PRD; kebutuhan tambahan harus dipetakan dan dicatat sebelum implementasi.

| Elemen | Arahan |
|---|---|
| Karakter tampilan | Hangat, ramah, menggugah selera, dan mudah dibaca |
| Warna utama | Oranye untuk identitas dan sorotan |
| Warna pendukung | Krem, cokelat tua, putih, dan merah bata untuk tombol utama |
| Tipografi | Judul bergaya serif; teks isi dan navigasi memakai sans-serif |
| Foto | Foto makanan yang jelas, relevan dengan produk, dan memiliki pencahayaan konsisten |
| Kartu | Sudut membulat, ruang antarelemen cukup, dan hierarki informasi yang jelas |
| Tombol | Aksi utama terlihat menonjol dan memiliki label yang menjelaskan tujuan |
| Ikon | Gaya konsisten; ikon tindakan tetap memiliki nama yang dapat dibaca pembaca layar |

Nilai warna, font, ukuran, dan jarak diperiksa dari Figma saat implementasi, lalu diterapkan secara terpusat melalui tema Tailwind dan token shadcn/ui. Nilai yang tidak tersedia ditetapkan secara konsisten dan didokumentasikan. Tampilan bawaan komponen harus disesuaikan dengan identitas oranye, krem, cokelat, dan fotografi makanan Salvora Kitchen.

**Aset desain:**

- Gunakan aset asli yang tersedia di `.Desain/Assets`; aset hero telah tersedia sebagai `Hero Page.png` pada pemeriksaan awal.
- Aset lain diperiksa di Figma dan diekspor sesuai kebutuhan implementasi.
- Placeholder diperbolehkan selama pengembangan, diberi identitas yang jelas, dan mudah diganti.
- Sebelum penyerahan, gambar utama dan produk yang masuk cakupan demo harus menggunakan aset yang disepakati, tanpa tautan gambar rusak.
- Ikon dapat menggunakan pustaka ikon React dengan gaya konsisten.

**Arah tampilan modern:**

- Beranda dan katalog menggunakan layout khusus mengikuti Figma, foto makanan yang menonjol, judul serif, dan kartu produk membulat.
- Formulir, modal, dropdown, notifikasi, tabel admin, filter, dan badge status menggunakan komponen shadcn/ui yang disesuaikan.
- Hover, fokus, transisi, indikator proses, dan notifikasi memberi umpan balik yang jelas.
- Animasi dibuat ringan, tidak menghambat pembelian, dan menghormati preferensi pengurangan gerakan pengguna.
- Mengganti framework tidak menjadi syarat visual modern; kualitas tampilan dinilai dari kesesuaian desain, keterbacaan, konsistensi, dan kemudahan penggunaan.

### 7.2 Susunan beranda

| Bagian | Isi dan perilaku |
|---|---|
| Header | Logo Salvora Kitchen, Beranda, Menu, Tentang Kami, Kontak, ikon keranjang, dan akun |
| Hero | Foto risol/cookies, judul “Jajanan Lezat dari Dapur Kami”, deskripsi singkat, dan tombol menuju menu |
| Banner promo | Informasi voucher pembeli baru beserta batas potongan dan ketentuan sekali pakai |
| Menu pilihan | Kartu Risol dan Cookies yang membuka katalog dengan kategori terkait |
| Produk terlaris | Kartu produk berisi foto, nama, deskripsi singkat, harga, dan tombol tambah |
| Tentang merek | Cerita singkat Salvora Kitchen dan foto pendukung |
| Alasan memilih | Informasi manfaat toko yang dapat dipertanggungjawabkan |
| Testimoni | Ulasan pembelian terverifikasi jika tersedia |
| Kontak | Kanal komunikasi resmi dan, bila P1 dikerjakan, formulir pesan |
| Footer | Identitas toko, navigasi tambahan, dan informasi kontak |

Ketentuan konten:

- Banner promo menggunakan teks: **“Diskon 20% untuk Pembeli Baru — Maksimal Rp100.000”**.
- Tambahkan penjelasan: **“Berlaku sekali untuk pembelian pertama. Syarat dan ketentuan berlaku.”**
- Rp100.000 adalah batas potongan, bukan batas total belanja.
- Label “Produk Terlaris” pada bagian cerita merek diubah menjadi “Tentang Salvora Kitchen”.
- Nama, harga, foto, nomor telepon, alamat, dan testimoni dalam gambar diperlakukan sebagai contoh sampai data toko dikonfirmasi.
- Klaim seperti “Pengiriman Cepat” harus sesuai layanan yang benar-benar disediakan.
- Jika belum ada data penjualan, bagian terlaris menggunakan judul “Pilihan Kami”, bukan menampilkan peringkat yang belum memiliki dasar.
- Jika belum ada ulasan, tampilkan keadaan kosong atau sembunyikan bagian testimoni. Data demo diberi penanda pada lingkungan demo.

Usulan perhitungan produk terlaris: jumlah unit pada pesanan Selesai selama 30 hari terakhir.

### 7.3 Perilaku navigasi dan responsif

- Logo membuka beranda.
- Menu membuka katalog.
- Tentang Kami dan Kontak menuju bagian terkait di beranda.
- Ikon keranjang menampilkan jumlah total unit dalam keranjang.
- Ikon akun membuka login untuk pengunjung dan menu akun untuk pembeli yang sudah login.
- Pengunjung yang memilih tambah produk diarahkan ke login; setelah berhasil, kembali ke produk asal dan dapat melanjutkan aksi.
- Pada ponsel, navigasi diringkas ke menu yang dapat dibuka dan ditutup.
- Kartu produk menyesuaikan jumlah kolom tanpa menyebabkan halaman bergulir horizontal.
- Teks promo, harga, serta tombol tetap terbaca pada layar kecil.
- Setiap halaman data memiliki kondisi memuat, kosong, berhasil, dan gagal.
- Implementasi responsif menggunakan utility dan breakpoint Tailwind dengan pendekatan mobile-first.

## 8. Kebutuhan fungsional

### FR-01 — Registrasi dan autentikasi

Sebagai calon pembeli, pengguna dapat membuat akun agar transaksi dan riwayat pembeliannya tersimpan.

**Ketentuan:**

- Registrasi meminta nama, email, kata sandi, dan konfirmasi kata sandi.
- Email harus unik setelah normalisasi.
- Usulan batas kata sandi: minimal 8 karakter.
- Login memeriksa identitas dan kata sandi.
- Login berhasil membuat sesi dan mengarahkan pengguna sesuai perannya.
- Logout mengakhiri sesi.
- Pesan kesalahan login tidak mengungkap apakah suatu email terdaftar.

**Kriteria penerimaan:**

- Email duplikat tidak menghasilkan akun kedua.
- Akun pembeli tidak dapat memilih atau mengubah dirinya menjadi admin.
- Pengguna yang sudah logout tidak dapat membuka halaman pribadi melalui sesi lama.
- Login berulang tidak menerbitkan voucher baru.

### FR-02 — Katalog dan detail produk

Sebagai pembeli, pengguna dapat memahami produk sebelum memasukkannya ke keranjang.

**Data produk yang ditampilkan:**

- Nama, kategori, foto, deskripsi, harga per satuan, dan ketersediaan.
- Rata-rata rating dan jumlah ulasan jika tersedia.
- Pilihan jumlah dan tombol tambah ke keranjang.

**Ketentuan:**

- Produk nonaktif tidak ditawarkan untuk pembelian.
- Produk habis dapat tetap ditampilkan dengan label “Stok Habis”.
- Produk tanpa ulasan menampilkan “Belum ada ulasan”.
- Untuk versi awal, setiap varian yang memiliki harga atau stok berbeda dicatat sebagai produk tersendiri.

**Kriteria penerimaan:**

- Kategori Risol hanya menampilkan produk kategori tersebut.
- Produk habis tidak dapat ditambahkan ke keranjang.
- Pembeli tidak dapat mengubah harga produk melalui permintaan dari browser.

### FR-03 — Keranjang

Sebagai pembeli, pengguna dapat menambah, mengubah jumlah, dan menghapus produk sebelum checkout.

**Ketentuan:**

- Jumlah berupa bilangan bulat positif.
- Produk yang sama digabungkan dalam satu baris keranjang.
- Keranjang tersimpan pada akun.
- Harga dan stok diperiksa kembali saat checkout.
- Menaruh produk di keranjang belum mencadangkan stok.

**Kriteria penerimaan:**

- Jumlah nol, negatif, atau melebihi stok ditolak.
- Perubahan jumlah memperbarui subtotal.
- Keranjang kosong tidak dapat dilanjutkan ke checkout.
- Produk nonaktif atau perubahan harga ditampilkan kepada pembeli sebelum pesanan dikonfirmasi.

### FR-04 — Alamat pengiriman

Pembeli dapat menambah, mengubah, memilih, dan menghapus alamat miliknya.

**Data minimum:**

- Nama penerima.
- Nomor telepon.
- Alamat lengkap.
- Kota/kabupaten dan provinsi.
- Kode pos bila diperlukan untuk wilayah layanan.
- Catatan alamat opsional.

**Ketentuan:**

- Pembeli hanya dapat mengakses alamat miliknya.
- Salinan alamat disimpan pada pesanan ketika checkout dikonfirmasi.
- Perubahan alamat akun tidak mengubah alamat pesanan lama.

**Kriteria penerimaan:**

- Checkout tanpa alamat valid ditolak.
- ID alamat milik akun lain tidak dapat digunakan.
- Penghapusan alamat akun tidak menghilangkan alamat dalam riwayat pesanan.

### FR-05 — Voucher pembeli baru

Sistem menerbitkan satu voucher saat login pertama yang memenuhi syarat.

**Aturan:**

- Pengguna memiliki peran pembeli.
- Pengguna belum pernah berhasil membayar pesanan.
- Voucher pembeli baru belum pernah diterbitkan untuk akun tersebut.
- Voucher dimiliki satu akun dan tidak dapat dipindahkan.
- Besar diskon adalah 20% dari subtotal produk, maksimal Rp100.000.
- Voucher diterapkan otomatis pada checkout yang memenuhi syarat.
- Voucher ditandai terpakai setelah pembayaran sukses terverifikasi.
- Tidak ada penumpukan voucher.

Usulan untuk mencegah penggunaan bersamaan: voucher dicadangkan pada satu pesanan aktif sampai pesanan selesai dibayar atau benar-benar kedaluwarsa. Percobaan pembayaran ulang pada pesanan yang sama tetap menggunakan cadangan tersebut.

**Kriteria penerimaan:**

- Login berulang menghasilkan paling banyak satu voucher.
- Dua checkout bersamaan tidak dapat memakai voucher yang sama.
- Pembayaran gagal tidak langsung menghabiskan voucher.
- Pesanan tanpa voucher tetap dapat diproses tanpa perubahan pada data voucher.
- Pembayaran sukses mengubah `is_first_purchase` menjadi `false`.

### FR-06 — Checkout

Pembeli dapat memeriksa ringkasan dan mengonfirmasi pesanan.

**Sistem memvalidasi:**

- Sesi pembeli.
- Kepemilikan keranjang dan alamat.
- Status aktif produk.
- Harga terkini.
- Stok tersedia.
- Kelayakan voucher.
- Wilayah layanan pengiriman jika diberlakukan.

Ringkasan menampilkan daftar produk, jumlah, harga satuan, subtotal, diskon, ongkir, alamat, dan total akhir.

**Ketentuan:**

- Perhitungan dilakukan server.
- Pesanan dibuat setelah konfirmasi pembeli.
- Harga, nama produk, dan alamat disalin ke pesanan.
- Klik berulang tidak membuat pesanan ganda.
- Stok dan voucher dicadangkan secara konsisten ketika pesanan dibuat.
- Item yang berhasil dimasukkan ke pesanan dikeluarkan dari keranjang tanpa menghapus item baru yang ditambahkan secara bersamaan.

**Kriteria penerimaan:**

- Ketika harga berubah, pembeli diminta meninjau total terbaru.
- Stok tidak boleh menjadi negatif.
- Dua pembeli yang memesan unit terakhir tidak sama-sama memperoleh reservasi.
- Pesanan baru berstatus Menunggu Pembayaran.

### FR-07 — Pembayaran melalui Midtrans Snap Sandbox

Pembeli menerima instruksi pembayaran setelah pesanan dibuat.

**Alur utama:**

1. Sistem membuat percobaan pembayaran yang terhubung ke pesanan toko. Setiap percobaan memiliki `provider_order_id` unik untuk dikirim sebagai `order_id` ke Midtrans.
2. Server mengambil total yang sudah disimpan pada pesanan dan mengirim permintaan Snap ke Midtrans Sandbox. Browser tidak menentukan nominal.
3. Midtrans mengembalikan Snap token dan redirect URL. Server menyimpan referensi tersebut pada percobaan terkait.
4. Website membuka Snap menggunakan token atau mengarahkan pembeli ke URL yang dikembalikan, serta menampilkan batas pembayaran yang konsisten dengan server.
5. Pembeli menyelesaikan pembayaran pada kanal sandbox yang tersedia.
6. Midtrans mengirim notifikasi HTTP ke webhook server aplikasi. Halaman finish dan callback JavaScript Snap hanya mengarahkan tampilan untuk memeriksa status.
7. Server memvalidasi payload, signature, referensi, dan nominal, kemudian mengambil status terbaru melalui Get Status API Midtrans.
8. Status terverifikasi diterapkan dalam transaksi database: catat pembayaran, proses pesanan, selesaikan reservasi stok, gunakan voucher terkait, dan perbarui penanda pembelian pertama tepat satu kali.
9. Pembeli melihat status terbaru dari server pada detail pesanan.

**Ketentuan:**

- Informasi sukses dari browser tidak cukup untuk menandai pesanan dibayar.
- Webhook memverifikasi `signature_key` sesuai mekanisme Midtrans menggunakan server key; perbandingan signature dilakukan secara aman di server.
- Setelah signature dan nominal lolos, status terbaru diperiksa menggunakan Get Status API dengan autentikasi server. Jika pemeriksaan belum berhasil, pesanan tidak ditandai sukses dan tetap dapat direkonsiliasi.
- Nomor referensi, nominal, dan mata uang harus cocok.
- Callback duplikat tidak boleh menimbulkan efek ganda.
- Notifikasi lama atau tidak berurutan tidak boleh menurunkan pembayaran sukses. Perubahan nyata setelah sukses, misalnya refund atau reversal yang dikonfirmasi status terbaru, dicatat sebagai pengecualian dan memerlukan penanganan admin; stok/voucher tidak dibalik otomatis.
- Gangguan jaringan ditampilkan sebagai status belum terkonfirmasi, bukan langsung dianggap gagal.
- Sistem menyediakan pemeriksaan status ke Midtrans untuk transaksi yang belum jelas; endpoint pemeriksaan dari browser memvalidasi pemilik pesanan atau peran admin.
- Server key hanya berada di server; client key sandbox boleh digunakan untuk memuat Snap. Kunci, token sesi, dan rahasia tidak boleh dimasukkan ke log atau kode publik.
- Menutup popup Snap tidak dianggap pembatalan atau kegagalan pembayaran.
- Item, potongan, ongkir, dan nominal yang dikirim harus konsisten dengan `gross_amount`. Format rincian item ditetapkan pada desain teknis.

**Kriteria penerimaan:**

- Pembayaran sukses yang valid mengubah pesanan menjadi Diproses.
- Pesan tidak sah atau nominal tidak cocok tidak memproses pesanan.
- Pembayaran gagal menampilkan pilihan Coba Lagi bila pesanan masih dapat dibayar.
- Retry tidak membuat pesanan baru.
- Riwayat percobaan pembayaran tetap tersimpan.
- Pesanan yang sudah dibayar tidak dapat membuat percobaan pembayaran baru.
- Callback finish atau JavaScript yang menyatakan sukses tidak dapat sendiri mengubah data pembayaran.
- Satu pesanan yang belum dibayar dapat memiliki beberapa percobaan historis, tetapi maksimal satu percobaan yang masih mungkin dibayar.

**Pemetaan status Midtrans:**

| Kondisi dari status terbaru Midtrans | Hasil aplikasi |
|---|---|
| `pending` | Menunggu |
| `settlement` tanpa tanda fraud yang memblokir | Sukses setelah validasi referensi dan nominal |
| `capture` dengan `fraud_status = accept`, jika kanal terkait diaktifkan | Sukses |
| `capture` dengan `fraud_status = challenge` atau hasil belum jelas | Tetap menunggu pemeriksaan; tidak memproses pesanan |
| `deny`, `failure`, atau penolakan fraud yang terverifikasi | Gagal |
| `cancel` | Dibatalkan pada tingkat percobaan pembayaran |
| `expire` | Kedaluwarsa pada tingkat percobaan pembayaran |
| Status tak dikenal atau status tidak dapat diperoleh | Belum Terkonfirmasi; simpan status mentah dan jadwalkan pemeriksaan |
| `refund`, `partial_refund`, atau reversal terverifikasi setelah sukses | Catat status pembayaran sebenarnya dan tandai pesanan Perlu Penanganan; tidak menjalankan refund otomatis |

Pemetaan diterapkan sesuai kanal yang diaktifkan dan dokumentasi Midtrans. Pengamanan kode lama harus diaudit terhadap aturan ini; tidak semua status atau pengecualian di atas sudah ditangani oleh kode sumber.

### FR-08 — Riwayat dan status pesanan

Pembeli dapat melihat pesanan miliknya beserta:

- Nomor dan waktu pesanan.
- Item, jumlah, harga, potongan, ongkir, dan total.
- Alamat pengiriman.
- Status pembayaran dan pesanan.
- Instruksi pembayaran yang masih berlaku.
- Riwayat perubahan status.
- Tombol ulasan untuk item yang memenuhi syarat.

**Kriteria penerimaan:**

- Mengganti ID pada alamat halaman tidak membuka pesanan pembeli lain.
- Harga dalam riwayat tidak berubah ketika admin memperbarui harga produk.
- Pesanan Selesai menampilkan akses pemberian ulasan.

### FR-09 — Pengelolaan produk dan kategori

Admin dapat menambah, melihat, mengubah, serta menonaktifkan produk.

**Data minimum produk:**

- Nama.
- Kategori.
- Deskripsi.
- Harga.
- Stok.
- Foto.
- Status aktif/nonaktif.

**Ketentuan:**

- Harga harus positif; stok berupa bilangan bulat tidak negatif.
- Unggahan foto divalidasi jenis dan ukurannya.
- Batas foto yang ditetapkan pengguna pada 23 Oktober 2026: JPEG, PNG, atau WebP, maksimal 2 MB = **2.000.000 byte**. Jenis diperiksa dari isi foto, bukan hanya ekstensi/nama berkas.
- Produk yang sudah masuk transaksi dinonaktifkan, sehingga riwayat pesanan tetap utuh.
- Penyesuaian stok tidak boleh membuat stok fisik lebih kecil dari jumlah yang sedang dicadangkan.
- Kategori yang masih dipakai produk tidak dapat dihapus sebelum produknya dipindahkan.
- Status aktif/nonaktif diatur admin, sedangkan tersedia/hampir habis/habis dihitung dari stok tersedia setelah reservasi. Ambang hampir habis **1–5 unit**, habis **0**, dan stok normal **6 unit atau lebih**, ditetapkan pengguna pada 23 Oktober 2026.
- Kategori pada produk dipilih dari data kategori tersimpan, bukan teks bebas. Sumber kategori pelanggan dan admin sama; jumlah produk dihitung dari data aktual.
- Daftar admin menyediakan pencarian nama, filter kategori/status stok, dan pagination. Ini kebutuhan operasional admin P0; pencarian/pengurutan katalog pelanggan tetap P1.

**Kriteria penerimaan:**

- Data tidak valid menampilkan kesalahan pada kolom terkait.
- Perubahan berhasil memperbarui daftar produk.
- Pembatalan konfirmasi hapus tidak mengubah data.
- Pembeli tidak dapat menjalankan operasi admin meskipun mengirim permintaan langsung.

### FR-10 — Pengelolaan pesanan

Admin melihat daftar pesanan dan memfilter berdasarkan nomor, tanggal, serta status.

**Ketentuan:**

- Pesanan hanya dapat dikirim setelah pembayaran sukses dan status Diproses.
- Admin dapat mengubah Diproses menjadi Dikirim, lalu Selesai.
- Admin tidak dapat menandai pembayaran sukses melalui pengubahan status pesanan.
- Harga tidak dihitung ulang ketika status pengiriman berubah.
- Setiap perubahan mencatat admin, waktu, status lama, dan status baru.
- Penyelesaian pesanan dilakukan admin setelah mendapat konfirmasi penerimaan melalui komunikasi manual. Permintaan perubahan Dikirim → Selesai wajib menyertakan `receiptConfirmed=true` dan catatan konfirmasi; pelaku serta waktunya dicatat. Tidak ada penyelesaian otomatis. Disetujui pengguna pada BE-11.

**Kriteria penerimaan:**

- Pesanan Menunggu Pembayaran tidak dapat langsung menjadi Dikirim.
- Transisi yang tidak diizinkan ditolak.
- Pembeli melihat status terbaru setelah perubahan berhasil.
- Daftar pesanan menampilkan nomor pesanan, waktu, pembeli, ringkasan item, total, kanal Midtrans, status pembayaran, dan status pesanan secara terpisah.
- Detail pesanan menampilkan salinan alamat dan item, rincian diskon/ongkir, percobaan pembayaran, serta riwayat status. Pesanan tidak dihapus melalui tindakan rutin admin.
- Filter berdasarkan nomor pesanan, tanggal, status pembayaran/pesanan, serta kanal pembayaran yang benar-benar tercatat. Status Aktif/Tidak Aktif tidak digunakan untuk pesanan.

### FR-11 — Rating dan ulasan

Pembeli dapat memberikan rating dan ulasan melalui item pesanan yang telah selesai.

**Aturan:**

- Rating berupa bilangan bulat 1–5.
- Isi ulasan: 10–1.000 karakter setelah trim, disetujui pengguna pada BE-12.
- Sesi harus valid.
- Item pesanan harus dimiliki akun yang sedang login.
- Produk harus cocok dengan item pesanan.
- Status pesanan harus Selesai.
- Satu ulasan untuk satu item pesanan; pembelian produk yang sama pada pesanan berbeda dapat diulas lagi. Jumlah unit pada item yang sama tidak menambah kuota ulasan. Disetujui pengguna pada BE-12.
- Validasi diulang saat Submit.
- Identitas publik menggunakan nama tampilan; email dan alamat tidak ditampilkan.

Kepemilikan diperiksa melalui hubungan `order_items → orders → users`.

**Kriteria penerimaan:**

- Pesanan orang lain atau belum selesai tidak dapat diulas.
- Nilai di luar 1–5 ditolak.
- Submit berulang tidak membuat ulasan ganda.
- Ulasan valid tampil pada produk dan memperbarui rata-rata rating.
- Produk yang dibeli kembali pada pesanan berbeda dapat diulas untuk transaksi baru tersebut.

### FR-12 — Kontak dan testimoni, prioritas P1

Formulir kontak mengikuti arah desain dengan nama dan pesan, ditambah email atau nomor telepon agar admin dapat membalas.

**Ketentuan:**

- Pesan disimpan dan dapat dibaca admin.
- Tampilan berhasil hanya muncul jika pesan benar-benar tersimpan.
- Nomor WhatsApp dan alamat menggunakan data resmi.
- Testimoni beranda berasal dari ulasan terverifikasi yang diizinkan untuk ditampilkan.
- Jika moderasi diterapkan, admin mencatat alasan penyembunyian dan tidak mengubah rating pelanggan.

### FR-13 — Dashboard operasional dan pemantauan voucher, prioritas P0

Admin dapat melihat ringkasan operasional dari data yang tersimpan, dengan periode yang sama untuk total dan rincian status.

**Ketentuan:**

- Ringkasan menampilkan jumlah produk aktif, jumlah pesanan, jumlah per status utama, pesanan terbaru, dan daftar stok menipis/habis.
- Produk aktif yang kehabisan stok tetap masuk jumlah produk aktif. Daftar stok memakai stok tersedia setelah reservasi.
- Jika jumlah pelanggan ditampilkan, labelnya adalah “Akun Pembeli Terdaftar” dan hanya menghitung akun peran pembeli.
- Jika nilai pembayaran ditampilkan, labelnya “Nilai Pembayaran Berhasil”, menjumlah pembayaran terverifikasi sesuai periode `paid_at`, bukan laba. Refund/pengecualian harus ditandai; dua pembayaran untuk satu pesanan tidak boleh disamarkan sebagai satu transaksi. Perhitungan keuangan bersih berada di luar P0.
- Halaman voucher pembeli baru hanya memantau aturan tetap 20%, maksimal Rp100.000, serta status tersedia, dicadangkan, dan terpakai. Admin tidak membuat promo lain atau mengedit aturan diskon pada P0.
- Penanda reservasi, penggunaan, dan pesanan terkait bersumber dari database; login/halaman admin tidak dapat mengubah kelayakan voucher secara manual.

**Kriteria penerimaan:**

- Angka ringkasan cocok dengan kueri data uji dan tidak mencampur periode atau status yang berbeda.
- Keadaan tanpa data menampilkan nol/keadaan kosong, bukan angka contoh Figma.
- Produk stok nol dan hampir habis ditampilkan sesuai ambang yang disepakati.
- Pemantauan voucher tidak memberi kemampuan memakai ulang, menghapus riwayat, atau mengubah diskon transaksi lama.

### FR-14 — Profil dasar akun admin sendiri, prioritas P0

Admin dapat membaca profilnya dan mengubah nama tampilan. Login tetap menggunakan email; username, foto profil, nomor telepon, perubahan email, serta perubahan kata sandi melalui UI adalah kandidat lanjutan dan bukan janji implementasi pada task awal.

**Kriteria penerimaan:**

- Perubahan nama hanya berlaku untuk akun yang sedang login dan tidak mengubah peran atau identitas akun lain.
- Permintaan pembeli tidak memperoleh kemampuan admin melalui endpoint profil.
- Halaman tidak menampilkan kontrol Simpan untuk atribut yang belum didukung backend.

## 9. Aturan perhitungan transaksi

Semua nominal disimpan sebagai nilai Rupiah yang konsisten tanpa perhitungan pecahan floating-point untuk uang.

- Subtotal produk = jumlah seluruh harga satuan × kuantitas.
- Diskon = minimum dari 20% × subtotal produk dan Rp100.000.
- Tanpa voucher yang memenuhi syarat, diskon = Rp0.
- Total akhir = subtotal produk − diskon + ongkir.
- Diskon tidak berlaku pada ongkir.
- Pembulatan diskon: ke bawah ke Rupiah penuh, sekali pada subtotal seluruh barang; bukan per item. Keputusan BE-06 disetujui pengguna 23 Oktober 2026. Contoh subtotal Rp10.003 menghasilkan diskon Rp2.000.
- Biaya yang dibebankan kepada pelanggan harus terlihat sebelum konfirmasi.

| Subtotal | Voucher | Diskon | Total sebelum ongkir |
|---:|---|---:|---:|
| Rp30.000 | Memenuhi syarat | Rp6.000 | Rp24.000 |
| Rp300.000 | Memenuhi syarat | Rp60.000 | Rp240.000 |
| Rp500.000 | Memenuhi syarat | Rp100.000 | Rp400.000 |
| Rp800.000 | Memenuhi syarat | Rp100.000 | Rp700.000 |
| Rp300.000 | Tidak memenuhi syarat | Rp0 | Rp300.000 |

Delivery manual awal melayani Kota Tanjungpinang, Kepulauan Riau, dengan ongkir tetap Rp10.000 per pesanan, ditetapkan pada BE-07. Alamat di luar cakupan ditolak saat checkout. Tidak ada tarif per jarak, pickup, gratis ongkir bersyarat atau ongkir demo Rp0 pada implementasi awal.

## 10. Status dan aturan transisi

Status pembayaran dipisahkan dari status pemenuhan pesanan.

| Status percobaan pembayaran | Makna |
|---|---|
| Dibuat | Catatan lokal sudah dibuat; instruksi pembayaran belum dipastikan tersedia |
| Menunggu | Penyedia telah menyediakan transaksi yang dapat dibayar |
| Belum Terkonfirmasi | Hasil belum dapat dipastikan, misalnya karena timeout |
| Sukses | Pembayaran berhasil dan terverifikasi |
| Gagal | Penyedia menyatakan percobaan tersebut gagal |
| Dibatalkan | Midtrans memastikan percobaan dibatalkan; menutup Snap tidak cukup untuk status ini |
| Kedaluwarsa | Penyedia menyatakan percobaan tersebut tidak lagi dapat dibayar |
| Refund / Refund Sebagian | Pengembalian dana yang dilaporkan Midtrans; dicatat untuk penanganan, bukan fitur refund otomatis |

| Status pesanan | Pemicu |
|---|---|
| Menunggu Pembayaran | Pesanan berhasil dibuat |
| Diproses | Pembayaran sukses terverifikasi dan pemenuhan dapat dilakukan |
| Dikirim | Admin mencatat barang telah dikirim |
| Selesai | Admin mencatat penerimaan telah dikonfirmasi |
| Kedaluwarsa | Batas pembayaran selesai dan dipastikan tidak ada pembayaran sukses atau percobaan aktif |
| Perlu Penanganan | Terjadi kondisi tidak normal yang membutuhkan pemeriksaan, misalnya pembayaran terlambat setelah reservasi dilepas |

**Ketentuan retry dan akhir alur:**

- Memilih “Tidak” pada Coba Lagi mengakhiri interaksi saat itu; tindakan tersebut tidak otomatis membatalkan pesanan.
- Pesanan tetap dapat dilihat sampai dibayar atau kedaluwarsa.
- Retry hanya dilakukan setelah percobaan sebelumnya dipastikan gagal atau tidak aktif.
- Saat hasil masih belum terkonfirmasi, sistem memeriksa status sebelum membuat percobaan baru.
- Batas pembayaran pesanan ditetapkan **60 menit sejak pesanan dibuat** oleh pengguna pada BE-07. Tenggat yang sama berlaku pada reservasi, parameter expiry Snap dan hitung mundur UI; retry tidak memperpanjang deadline. Nilai ini dipilih untuk Salvora, bukan fallback otomatis dari LanggananKu.
- Retry tidak memperpanjang batas pesanan secara diam-diam. Jika token masih aktif, lanjutkan percobaan yang sama; jika percobaan sudah terminal dan waktu pesanan masih cukup, buat referensi Midtrans baru dengan batas waktu tersisa yang didukung kanal.
- Reservasi stok dan voucher dilepas setelah seluruh percobaan dipastikan tidak dapat menghasilkan pembayaran.
- Pembayaran sukses yang datang terlambat tetap dicatat. Jika reservasi telah dilepas, pesanan masuk Perlu Penanganan dan tidak otomatis dikirim.
- Jika terjadi dua pembayaran sukses pada pesanan yang sama, simpan keduanya untuk audit tetapi proses stok, voucher, dan pesanan hanya sekali. Tandai kasus sebagai Perlu Penanganan tanpa menghapus pembayaran kedua.

## 11. Konsistensi stok, voucher, dan pembayaran

**Usulan mekanisme stok:**

- Produk menyimpan stok fisik dan jumlah stok yang dicadangkan.
- Stok tersedia = stok fisik − stok dicadangkan.
- Checkout mencadangkan stok.
- Pembayaran sukses mengurangi stok fisik dan menghapus reservasinya.
- Pesanan kedaluwarsa melepaskan reservasi tanpa mengurangi stok fisik.
- Setiap efek pemrosesan hanya dilakukan satu kali.

Saat pembayaran sukses, perubahan pembayaran, status pesanan, penggunaan voucher, penanda pembelian pertama, dan stok harus disimpan secara atomik. Jika terjadi kegagalan, sistem tidak boleh meninggalkan sebagian perubahan saja.

Untuk dua checkout bersamaan yang memperebutkan voucher atau stok terakhir, hanya satu yang boleh memperoleh hak penggunaan. Transaksi lainnya menerima pemberitahuan dan total terbaru sebelum membayar.

## 12. Daftar halaman

| Halaman | Konten dan tindakan utama |
|---|---|
| Beranda | Hero, promo, kategori, produk pilihan, cerita merek, keunggulan, testimoni, kontak |
| Registrasi | Formulir akun dan kesalahan validasi |
| Login | Formulir login dan arah kembali setelah autentikasi |
| Katalog | Daftar produk, kategori, kondisi kosong; pencarian jika P1 dikerjakan |
| Detail produk | Foto, deskripsi, harga, stok, kuantitas, ulasan |
| Keranjang | Item, jumlah, subtotal, hapus, lanjut checkout |
| Alamat | Daftar dan formulir alamat |
| Checkout | Alamat, ringkasan harga, voucher, ongkir, konfirmasi |
| Pembayaran | Instruksi, batas waktu, status, pemeriksaan status, retry |
| Riwayat pesanan | Daftar transaksi dan status |
| Detail pesanan | Rincian transaksi, pembayaran, pengiriman, akses ulasan |
| Formulir ulasan | Rating, komentar, informasi produk |
| Akun | Profil dasar dan logout |
| Admin produk | Daftar, tambah, ubah, nonaktifkan, kelola stok |
| Admin kategori | Daftar dan pengelolaan kategori |
| Admin pesanan | Daftar, detail, filter, perubahan status |
| Admin pembayaran | Pemantauan percobaan dan transaksi bermasalah |
| Admin dashboard | Ringkasan operasional FR-13; grafik/analitik lanjutan P1 |
| Admin voucher pembeli baru | Aturan tetap, ringkasan, dan daftar status penggunaan; tanpa CRUD promo umum |
| Admin akun sendiri | Baca profil, ubah nama tampilan, dan logout sesuai FR-14 |
| Admin pesan | Daftar pesan kontak jika P1 dikerjakan |

**Contoh pesan antarmuka:**

- “Voucher pembeli baru berhasil diterapkan.”
- “Stok produk berubah. Periksa kembali jumlah pesanan.”
- “Status pembayaran sedang diperiksa.”
- “Pembayaran berhasil. Pesanan sedang diproses.”
- “Pembayaran gagal. Silakan coba lagi.”
- “Ulasan dapat diberikan setelah pesanan selesai.”

## 13. Kebutuhan data dan penyesuaian RAT

Daftar berikut merupakan kebutuhan data konseptual. Struktur fisik dan tipe kolom ditetapkan dalam desain basis data.

| Entitas | Data penting |
|---|---|
| `users` | ID, nama, email unik, hash kata sandi, peran, `is_first_purchase`, waktu pembuatan |
| `address` | ID, pemilik, penerima, telepon, alamat lengkap, wilayah, kode pos, catatan |
| `categories` | ID, nama, status aktif |
| `products` | ID, kategori, nama, deskripsi, harga, stok fisik, stok dicadangkan, foto, status aktif |
| `carts` | ID, pemilik |
| `cart_items` | ID, keranjang, produk, jumlah |
| `discounts` | ID, pemilik, jenis voucher, persentase, batas potongan, `is_used`, pesanan reservasi, waktu penggunaan |
| `orders` | ID, nomor unik, pembeli, voucher opsional, salinan alamat, subtotal, diskon, ongkir, total, status, batas pembayaran |
| `order_items` | ID, pesanan, produk, salinan nama dan harga, jumlah, subtotal |
| `payments` | ID percobaan, FK pesanan toko, `provider_order_id` unik, penyedia Midtrans, `midtrans_transaction_id` unik bila tersedia, Snap token/redirect URL, nominal, mata uang, status lokal dan mentah, masa berlaku, waktu sukses |
| `payment_events` | ID peristiwa, kunci deduplikasi yang diturunkan bila tidak ada event ID, percobaan pembayaran, sumber webhook/status API, status mentah dan hasil verifikasi, waktu proses, ringkasan kesalahan tanpa rahasia |
| `ratings` | ID, item pesanan, pembeli, produk, nilai, komentar, waktu |
| `order_status_history` | Pesanan, status lama/baru, pelaku, waktu, catatan |
| `contact_messages` | Nama, kontak, pesan, status penanganan; untuk P1 |

**Hubungan utama:**

- Satu pengguna memiliki banyak alamat dan pesanan.
- Satu pesanan memiliki banyak item serta dapat memiliki beberapa percobaan pembayaran.
- Satu produk memiliki banyak item transaksi dan ulasan.
- Satu voucher pembeli baru dimiliki satu akun dan hanya dipakai oleh satu pesanan berhasil.
- Satu item pesanan memiliki maksimal satu ulasan pada aturan versi awal.

**Constraint penting:**

- Email dan nomor pesanan unik.
- Referensi pembayaran dan kunci pemrosesan event tidak boleh diproses ganda.
- Kombinasi keranjang dan produk unik.
- `ratings.order_item_id` unik.
- Nomor pesanan toko berbeda fungsi dari `order_id` Midtrans: satu pesanan toko dapat memiliki beberapa `provider_order_id` untuk percobaan berbeda. Jangan memakai constraint satu pembayaran per pesanan seperti pada model langganan lama.
- Catat penanda penerapan pembayaran pada pesanan, atau gunakan mekanisme setara, agar beberapa percobaan tidak memproses pemenuhan lebih dari sekali.
- Foreign key menjaga hubungan antarentitas.
- Penghapusan produk tidak menghapus transaksi atau ulasan historis.
- Atribut yang terkait pembeli dan produk pada ulasan diturunkan serta diperiksa dari item pesanan, bukan dipercaya dari input browser.

## 14. Kebutuhan arsitektur dan infrastruktur

Arsitektur konseptual terdiri atas:

| Komponen | Tanggung jawab |
|---|---|
| Frontend React dalam Next.js | Menampilkan halaman dan menerima interaksi pembeli/admin |
| Tailwind CSS | Mengatur tampilan, tema, layout, dan perilaku responsif |
| shadcn/ui | Dasar komponen interaktif yang disesuaikan dengan desain Figma |
| Server Next.js | Autentikasi, otorisasi, API, katalog, checkout, voucher, pesanan, ulasan, dan callback pembayaran |
| PostgreSQL | Menyimpan data relasional dan menjaga konsistensi transaksi |
| Penyimpanan gambar | Menyimpan foto produk yang telah divalidasi |
| Integrasi Midtrans Snap Sandbox | Membuat transaksi Snap, memverifikasi webhook, dan melakukan rekonsiliasi melalui Get Status API |
| Proses terjadwal | Memeriksa transaksi tertunda dan menangani kedaluwarsa |
| Pencatatan operasional | Mencatat kesalahan, perubahan status, dan kejadian pembayaran |

**Kebutuhan infrastruktur:**

- Lingkungan pengembangan lokal dan lingkungan demo yang terpisah.
- Lingkungan demo memiliki HTTPS dan alamat callback yang dapat dijangkau penyedia sandbox.
- Kredensial disimpan dalam konfigurasi rahasia server.
- Browser tidak menerima kunci rahasia pembayaran.
- Basis data tidak dibuka langsung ke publik.
- Data sandbox dipisahkan dari konfigurasi produksi.
- Tersedia prosedur pencadangan dan pemulihan basis data.
- Frontend dan backend berada dalam satu proyek Next.js. Komponen tampilan, penanganan permintaan, layanan bisnis, dan akses database dipisahkan tanggung jawabnya; struktur Next.js tidak perlu dipaksakan mengikuti folder MVC klasik.
- Operasi database, kredensial, dan verifikasi pembayaran hanya dijalankan pada server. Menyembunyikan tombol di frontend tidak menggantikan pemeriksaan izin server.
- API dan webhook diimplementasikan melalui Route Handlers Next.js; proses terjadwal harus memiliki mekanisme eksekusi yang sesuai hosting dan tidak bergantung pada browser pengguna.
- PostgreSQL menggunakan database khusus Salvora Kitchen dengan koneksi aplikasi sendiri. Layanan/server yang sama dengan LanggananKu dapat digunakan jika sesuai, tetapi migrasi Salvora Kitchen tidak boleh diarahkan ke database LanggananKu.
- Skema dibuat melalui migrasi yang dapat diulang pada lingkungan pengembangan dan demo. Pilihan ORM/driver, hosting, penyimpanan aset, dan penjadwal masih perlu ditetapkan.
- Jika laporan atau kode awal menyebut SQLite, identifikasi terlebih dahulu bagian tersebut lalu selaraskan dokumentasi dan implementasi ke PostgreSQL. Migrasi data SQLite hanya diperlukan jika data lama memang tersedia dan harus dipertahankan.

### 14.1 Adaptasi proyek LanggananKu (payment method)

**Hasil pemeriksaan sumber:** folder `LanggananKu` menggunakan Next.js, PostgreSQL, Prisma, autentikasi berbasis sesi, peran pengguna/admin, dan Midtrans Snap Sandbox. Ditemukan kode verifikasi signature, pemeriksaan nominal, Get Status API, pencatatan event, penguncian transaksi, serta penanda penerapan pembayaran. Pengujian runtime belum dilakukan pada sesi pemeriksaan ini.

| Bagian sumber | Perlakuan untuk Salvora Kitchen |
|---|---|
| Pembungkus API Midtrans dan pemeriksaan signature | Adaptasi setelah audit, dengan konfigurasi aplikasi baru |
| Pemeriksaan nominal dan rekonsiliasi status | Pertahankan prinsipnya, lengkapi pemetaan status serta pengujian |
| Pola sesi, hash kata sandi, otorisasi, dan akses Prisma/PostgreSQL | Kandidat penggunaan kembali; jangan memindahkan akun atau sesi lama |
| `Plan`, `Subscription`, durasi dan hak akses premium | Tidak menjadi model bisnis Salvora Kitchen |
| Penerapan pembayaran sukses | Ganti aktivasi/perpanjangan langganan dengan pemrosesan pesanan, stok, voucher, dan pembelian pertama |
| `Payment.orderId` unik pada model lama | Ubah menjadi pemisahan pesanan toko dan referensi unik tiap percobaan Midtrans |
| Expiry 60 menit pada kode lama | Selaraskan dengan satu kebijakan waktu baru yang ditetapkan kelompok |

**Urutan adaptasi:**

1. Inventarisasi modul sumber dan ketergantungannya tanpa mengubah kode atau database LanggananKu.
2. Buat konfigurasi serta migrasi khusus Salvora Kitchen. Contoh konfigurasi hanya berisi placeholder, bukan kredensial nyata.
3. Konfigurasikan `DATABASE_URL`, URL aplikasi, kunci sandbox Midtrans, dan alamat webhook untuk aplikasi baru. Konfigurasi harus gagal dengan pesan jelas jika belum lengkap, tanpa fallback ke database lama.
4. Hubungkan pembayaran ke pesanan produk dan terapkan penguncian/constraint yang sesuai stok serta voucher. Penguncian per pengguna pada aplikasi langganan belum cukup untuk stok yang diperebutkan banyak pembeli.
5. Terapkan `applied_at` atau mekanisme setara pada pesanan untuk mencegah penerapan ganda lintas percobaan.
6. Uji ulang seluruh skenario pembayaran serta akses database pada lingkungan Salvora Kitchen. File tes yang tersedia pada sumber tidak dianggap telah lulus tanpa dijalankan.

**Kontrak endpoint pembayaran yang diusulkan:**

| Endpoint | Akses dan tanggung jawab |
|---|---|
| `POST /api/orders/{orderId}/payments` | Pemilik pesanan; server memvalidasi pesanan, nominal, percobaan aktif, dan batas waktu sebelum membuat/melanjutkan Snap |
| `GET /api/orders/{orderId}` | Pemilik atau admin; membaca status lokal dan ringkasan yang aman |
| `POST /api/orders/{orderId}/payments/reconcile` | Pemilik atau admin; memeriksa status Midtrans, dibatasi frekuensinya dan dilindungi sesuai mekanisme sesi |
| `POST /api/webhooks/midtrans` | Tidak membutuhkan login pembeli atau token CSRF; wajib verifikasi signature, payload, nominal, referensi, dan status server |

Nama endpoint final dapat disesuaikan pada desain teknis, tetapi tanggung jawab dan kontrol akses ini wajib dipertahankan. Webhook dijalankan pada runtime server Node.js dan menggunakan koneksi yang sesuai PostgreSQL.

Duplikat yang sudah diproses menerima respons berhasil setelah keadaan tersimpan dipastikan. Gangguan sementara saat rekonsiliasi tidak boleh diakui sebagai pembayaran sukses; server memberi respons yang memungkinkan pengiriman ulang dan proses rekonsiliasi terjadwal. Rahasia tidak ditampilkan pada pesan kesalahan.

Koneksi PostgreSQL dari server tidak menggantikan backend, dan pemakaian PostgreSQL sendiri tidak otomatis mencegah pembayaran ganda. Transaksi, constraint, dan aturan pemrosesan tetap wajib diterapkan.

PRD menetapkan perilaku produk dan stack Next.js–PostgreSQL–Tailwind–shadcn/ui. Detail endpoint, ORM/driver, dan desain teknis dituangkan pada dokumen implementasi.

## 15. Ketentuan teknologi frontend

Frontend website **wajib menggunakan React melalui Next.js, Tailwind CSS, dan shadcn/ui**. Next.js juga menyediakan backend aplikasi dalam satu proyek. Ketentuan ini menggantikan bagian draf sebelumnya yang masih membiarkan framework aplikasi dan DBMS terbuka.

React membangun antarmuka berbasis komponen, Tailwind CSS mengatur styling, dan shadcn/ui menjadi dasar komponen interaktif. Layout khusus beranda serta kartu produk tetap mengikuti Figma; komponen siap pakai disesuaikan agar tidak menghasilkan tampilan generik.

### 15.1 Teknologi dan penerapan

| Komponen | Ketentuan |
|---|---|
| Antarmuka | React melalui Next.js dengan komponen yang dapat digunakan kembali |
| Styling | Tailwind CSS sebagai pendekatan utama |
| Komponen UI | shadcn/ui untuk formulir, dialog, dropdown, notifikasi, tabel, filter, dan badge sesuai kebutuhan |
| Responsif | Menggunakan utility dan breakpoint Tailwind dengan pendekatan mobile-first |
| Konsistensi desain | Warna, tipografi, jarak, dan radius ditetapkan melalui konfigurasi tema Tailwind |
| Komponen bersama | Navbar, footer, tombol, input, kartu produk, modal, dan badge status digunakan secara konsisten |
| Pustaka tambahan | Pustaka pendukung yang kompatibel dapat digunakan sesuai kebutuhan; tidak menambahkan pustaka UI utama lain tanpa alasan yang terdokumentasi |

### 15.2 Batasan penggunaan CSS

- Tidak menggunakan CSS native/manual sebagai pendekatan utama styling.
- Tidak membuat stylesheet manual terpisah untuk setiap halaman atau komponen.
- Tidak menggunakan inline style untuk styling rutin.
- CSS khusus hanya diperbolehkan jika kebutuhan tidak dapat dipenuhi secara wajar oleh Tailwind atau diperlukan oleh pustaka pihak ketiga. Penggunaannya harus minimal dan terdokumentasi.
- File untuk memuat Tailwind dan mendefinisikan tema global diperbolehkan; ketentuan ini membatasi styling manual, bukan file integrasi yang diperlukan Tailwind.
- Penggunaan framework tetap harus mempertahankan arah visual desain Salvora Kitchen.

### 15.3 Kriteria penerimaan frontend

1. Seluruh halaman pembeli dan admin dibangun menggunakan React di dalam Next.js.
2. Layout, warna, tipografi, spacing, serta tampilan responsif diterapkan melalui Tailwind CSS.
3. Elemen antarmuka yang berulang menggunakan komponen bersama.
4. Website tetap nyaman digunakan pada layar ponsel, tablet, dan desktop.
5. Tidak terdapat stylesheet CSS manual yang menjadi dasar utama tampilan website.
6. Komponen shadcn/ui digunakan untuk kebutuhan interaktif yang relevan dan diberi tema sesuai Figma.
7. Tampilan pelanggan dan admin konsisten dalam warna, tipografi, spacing, ikon, fokus, serta umpan balik tindakan.
8. Aset sementara diinventarisasi dan diganti untuk halaman dalam cakupan penyerahan.

## 16. Kebutuhan nonfungsional

Angka berikut adalah target awal yang diusulkan untuk proyek.

| Aspek | Persyaratan dan cara verifikasi |
|---|---|
| Kinerja halaman | Beranda dan katalog dapat digunakan dalam ≤3 detik pada skenario uji koneksi 10 Mbps, dengan perangkat dan kondisi pengujian dicatat |
| Kinerja server | P95 operasi internal umum ≤1 detik pada 20 pengguna bersamaan, di luar waktu respons Midtrans |
| Pembaruan pembayaran | Status tersimpan ≤5 detik setelah callback valid diterima dalam lingkungan uji normal |
| Responsif | Alur utama dapat digunakan pada lebar 360, 768, dan 1440 piksel tanpa overflow horizontal halaman |
| Aksesibilitas | Formulir berlabel, fokus keyboard terlihat, tombol dapat digunakan dengan keyboard, dan informasi tidak bergantung pada warna |
| Keamanan akun | Kata sandi di-hash; sesi dilindungi; endpoint admin memeriksa peran pada server |
| Keamanan input | Validasi server, perlindungan injeksi, penanganan output aman, dan perlindungan CSRF untuk penggunaan sesi cookie |
| Keamanan transaksi | Pemeriksaan kepemilikan, validasi nominal, verifikasi callback, dan deduplikasi pemrosesan |
| Keandalan | Gangguan Midtrans tidak menghilangkan pesanan; transaksi belum jelas dapat diperiksa kembali |
| Privasi | Data pribadi hanya dapat diakses pihak yang berhak; log tidak berisi kata sandi atau kredensial |
| Pemeliharaan | Konfigurasi terpisah, migrasi basis data tersedia, komponen React dapat digunakan kembali, serta panduan instalasi dan demo terdokumentasi |
| Konsistensi styling | Tema dan utility Tailwind digunakan secara konsisten; pengecualian CSS khusus terdokumentasi |
| Pemulihan | Usulan: backup harian pada lingkungan demo yang menyimpan data penting dan satu uji pemulihan sebelum penyerahan |

## 17. Skenario pengujian penerimaan

| ID | Skenario | Hasil yang diharapkan |
|---|---|---|
| UAT-01 | Registrasi pembeli baru | Akun terbentuk sebagai pembeli |
| UAT-02 | Login pertama dan login ulang | Satu voucher diterbitkan; login ulang tidak menambah voucher |
| UAT-03 | Subtotal Rp300.000 memakai voucher | Diskon Rp60.000 |
| UAT-04 | Subtotal Rp800.000 memakai voucher | Diskon dibatasi Rp100.000 |
| UAT-05 | Dua checkout memakai voucher yang sama | Hanya satu pesanan memperoleh reservasi voucher |
| UAT-06 | Dua pembeli memesan stok terakhir | Stok tidak negatif dan hanya satu reservasi berhasil |
| UAT-07 | Konfirmasi checkout diklik berulang | Satu pesanan terbentuk untuk permintaan yang sama |
| UAT-08 | Pembayaran sukses valid | Pesanan Diproses; stok dan voucher diperbarui satu kali |
| UAT-09 | Pembayaran gagal lalu retry | Pesanan tetap sama; percobaan baru tercatat setelah percobaan lama dipastikan selesai |
| UAT-10 | Timeout saat membuat pembayaran | Status belum terkonfirmasi; sistem memeriksa sebelum membuat transaksi baru |
| UAT-11 | Callback yang sama dikirim ulang | Tidak ada perubahan ganda |
| UAT-12 | Callback palsu atau nominal salah | Pesanan tidak diproses |
| UAT-13 | Callback gagal tiba setelah sukses | Status sukses tidak diturunkan |
| UAT-14 | Pesanan kedaluwarsa tanpa pembayaran | Reservasi dilepas setelah status penyedia dipastikan |
| UAT-15 | Pembayaran sukses terlambat setelah reservasi dilepas | Pembayaran dicatat dan pesanan masuk Perlu Penanganan |
| UAT-16 | Admin mengubah harga produk | Pesanan lama mempertahankan harga saat transaksi |
| UAT-17 | Admin menonaktifkan produk yang pernah dibeli | Produk tidak dijual lagi; riwayat tetap tersedia |
| UAT-18 | Pembeli membuka pesanan orang lain | Akses ditolak |
| UAT-19 | Memberi ulasan sebelum pesanan selesai | Ditolak |
| UAT-20 | Memberi ulasan pada item selesai miliknya | Ulasan tersimpan dan tampil |
| UAT-21 | Submit ulasan berulang | Tidak terbentuk ulasan ganda |
| UAT-22 | Membuka website pada ponsel | Navigasi, kartu, formulir, dan checkout tetap dapat digunakan |
| UAT-23 | Meninjau implementasi frontend | Halaman menggunakan React melalui Next.js, styling utama menggunakan Tailwind, dan komponen shadcn/ui disesuaikan serta digunakan kembali |
| UAT-24 | Meninjau CSS khusus | Tidak ada stylesheet manual sebagai dasar utama; setiap pengecualian minimal dan terdokumentasi |
| UAT-25 | Menyiapkan database pada lingkungan baru | Migrasi PostgreSQL berjalan dan data proyek payment method tetap terpisah |
| UAT-26 | Menguji integrasi pembayaran yang diadaptasi | Transaksi terhubung ke pesanan Salvora Kitchen dan seluruh pengujian pembayaran tetap lulus |
| UAT-27 | Membandingkan implementasi dengan Figma | Halaman dalam cakupan mengikuti identitas visual; komponen bertema konsisten dan aset utama tidak rusak |
| UAT-28 | Callback browser sukses tanpa status sukses Midtrans | Pembayaran tidak ditandai sukses |
| UAT-29 | Pembeli menutup popup Snap | Pesanan dan percobaan tidak otomatis dibatalkan |
| UAT-30 | Retry setelah percobaan terminal | Pesanan toko sama, referensi Midtrans baru, dan tidak ada dua percobaan aktif |
| UAT-31 | Konfigurasi koneksi tidak tersedia | Aplikasi gagal dengan pesan aman tanpa menghubungi database LanggananKu |
| UAT-32 | Pembayaran sukses produk | Pesanan, stok, dan voucher diperbarui; tidak ada aktivasi langganan |
| UAT-33 | Pemeriksaan expiry | Waktu pesanan, reservasi, konfigurasi Snap, dan hitung mundur UI konsisten |
| UAT-34 | Refund atau reversal terverifikasi setelah sukses | Status sebenarnya dicatat, pesanan ditandai Perlu Penanganan, dan stok/voucher tidak dibalik otomatis |
| UAT-35 | Dua percobaan dibayar sukses untuk satu pesanan | Kedua pembayaran tercatat; pemenuhan diterapkan sekali dan kasus ditandai Perlu Penanganan |
| UAT-36 | Ringkasan admin pada periode yang sama | Total/status cocok dengan data uji; tanpa angka dummy dan tanpa mencampur status pembayaran/pesanan |
| UAT-37 | Produk aktif dengan stok tersedia nol | Tetap dihitung produk aktif, tetapi ditampilkan habis dan tidak dapat dibeli |
| UAT-38 | Admin memantau voucher | Status dan pesanan terkait benar; tidak tersedia CRUD promo umum atau pengubahan aturan transaksi lama |
| UAT-39 | Admin mengubah profil sendiri | Hanya nama tampilan akun sendiri berubah; peran dan akun lain tidak terpengaruh |

## 18. Keterkaitan dengan diagram

| Artefak | Kebutuhan yang diwakili | Penyesuaian yang diperlukan |
|---|---|---|
| Activity Checkout & Pembayaran | Voucher, checkout, Midtrans Snap, retry, pemrosesan sukses | Ganti swimlane Bank menjadi Midtrans; tambahkan verifikasi/Get Status API, kondisi voucher digunakan, dan hasil belum pasti |
| Activity Kelola Produk | Tambah, ubah, hapus/nonaktifkan produk | Tambahkan validasi data dan hasil batal konfirmasi |
| Activity Ulasan & Rating | Pemeriksaan pembelian dan penyimpanan ulasan | Gunakan relasi `orders` untuk pemilik; validasi ulang saat Submit |
| Use Case Diagram | Fungsi pembeli, admin, dan Midtrans | Ganti aktor API Bank menjadi Midtrans Payment Gateway; selaraskan fitur P0/P1 dan tugas admin |
| RAT | Data produk, transaksi, voucher, dan ulasan | Tambahkan atribut serta entitas yang diperlukan untuk status dan konsistensi |
| Sequence pembayaran | Urutan komunikasi transaksi | Gunakan Pembeli, antarmuka Snap, server Next.js, PostgreSQL, dan Midtrans; pisahkan redirect browser dari webhook serta Get Status API |
| Desain beranda | Identitas visual dan akses ke menu | Perbaiki teks promo, label bagian, dan sumber konten |

## 19. Tahapan pengerjaan dan keluaran

| Tahap | Pekerjaan | Keluaran/kriteria selesai |
|---|---|---|
| 1. Penyelarasan kebutuhan | Tetapkan ruang lingkup, pembayaran, pengiriman, dan aturan bisnis | PRD serta daftar keputusan yang disepakati |
| 2. Perancangan | Selaraskan use case, activity, sequence, RAT, dan UI | Dokumen desain tanpa konflik alur utama |
| 3. Fondasi aplikasi | Siapkan Next.js, Tailwind, shadcn/ui, PostgreSQL, autentikasi, peran, dan konfigurasi | Migrasi berjalan; tema tersedia; pembeli/admin dapat masuk dengan hak akses benar |
| 4. Katalog dan admin | Bangun produk, kategori, stok, dan beranda | Produk dapat dikelola dan ditampilkan |
| 5. Transaksi | Bangun alamat, keranjang, voucher, checkout, dan reservasi | Pesanan serta total tersimpan konsisten |
| 6. Pembayaran | Adaptasi modul Midtrans dari LanggananKu; ganti logika langganan, terapkan webhook, retry, dan rekonsiliasi | Skenario sukses, gagal, duplikat, timeout, serta expiry teruji pada Salvora Kitchen |
| 7. Pemenuhan dan ulasan | Bangun status pengiriman serta ulasan terverifikasi | Alur pesanan hingga ulasan selesai |
| 8. Validasi dan penyerahan | UAT, pemeriksaan responsif, kepatuhan teknologi frontend, dokumentasi, demo | Fitur P0 lulus dan masalah kritis ditutup |

Pembagian tugas dan tanggal disusun sesuai jadwal kelompok. Setiap perubahan aturan setelah tahap perancangan dicatat agar implementasi dan diagram tetap konsisten.

Pengerjaan dimulai dari fondasi database, autentikasi, serta kontrak data API, lalu frontend dan backend diselesaikan per fitur. Frontend dapat memakai data contoh sesuai kontrak selama endpoint dikembangkan. Akses sandbox diperiksa sejak tahap awal agar kendala integrasi diketahui lebih cepat.

## 20. Risiko dan penanganan

| Risiko | Penanganan |
|---|---|
| Akses merchant Midtrans Sandbox belum terverifikasi | Verifikasi konfigurasi dan kanal pada tahap awal; simulator lokal membantu pengembangan tetapi tidak menggantikan pengujian integrasi Midtrans |
| Proposal dan diagram berbeda versi | Gunakan satu daftar keputusan dan perbarui semua artefak terkait |
| Voucher terpakai beberapa kali | Reservasi, constraint, dan pembaruan atomik |
| Stok berlebih terjual | Pemeriksaan serta reservasi stok yang aman terhadap permintaan bersamaan |
| Pembayaran ganda atau callback terlambat | Referensi unik, deduplikasi, pemeriksaan status, dan status Perlu Penanganan |
| Penghapusan produk merusak riwayat | Nonaktifkan produk dan simpan salinan data transaksi |
| Desain bagus tetapi sulit digunakan di ponsel | Uji responsif dan tugas checkout pada ukuran layar target |
| Konten contoh dianggap data nyata | Konfirmasi harga, foto, kontak, serta testimoni sebelum publikasi |
| Styling tidak konsisten antarhalaman | Gunakan tema Tailwind, token shadcn/ui, dan komponen React bersama sesuai Figma |
| Data proyek lama tercampur | Buat database PostgreSQL khusus Salvora Kitchen dan periksa migrasi sebelum dijalankan |
| Kode pembayaran lama tidak sesuai kebutuhan | Audit dan adaptasi modul relevan, lalu uji ulang pada pesanan aplikasi baru |
| Scope melebar | Selesaikan P0 terlebih dahulu dan catat P1 sebagai pengembangan berikutnya |

## 21. Keputusan yang masih perlu ditetapkan

Draf ini sudah dapat digunakan sebagai dasar diskusi dan perancangan. Sebelum implementasi terkait dimulai, kelompok perlu menetapkan:

| Keputusan | Usulan awal atau kebutuhan |
|---|---|
| Nama resmi merek | Salvora Kitchen mengikuti desain |
| Akses katalog | Ditetapkan 23 Oktober 2026: katalog/detail publik; login diperlukan untuk keranjang dan transaksi |
| Kanal Midtrans | Penyedia sudah ditetapkan: Midtrans Snap Sandbox. Verifikasi kanal merchant; minimal satu transfer bank/VA sandbox diuji |
| Batas pembayaran | Ditutup BE-07: 60 menit sejak order dibuat, berlaku pada reservasi/Snap/UI tanpa perpanjangan retry |
| Wilayah layanan dan ongkir | Ditutup BE-07 untuk delivery manual awal: Kota Tanjungpinang, Kepulauan Riau, Rp10.000 per pesanan; luar cakupan ditolak |
| Data menu | Konfirmasi nama, harga, satuan, foto, dan stok |
| Penyelesaian pesanan | Admin setelah penerimaan barang dikonfirmasi |
| Ulasan | Satu per item pesanan; rating 1–5; komentar 10–1.000 karakter |
| Detail teknis yang belum dipilih | ORM/driver PostgreSQL, hosting, penyimpanan aset, penjadwal, dan versi paket; Next.js, PostgreSQL, Tailwind CSS, serta shadcn/ui sudah ditetapkan |
| Adaptasi LanggananKu | Pemeriksaan sumber awal selesai; tentukan modul yang diadaptasi dan jalankan audit serta pengujian runtime |
| Aset desain | Lengkapi foto produk, logo, banner, dan gambar pendukung dari Figma atau aset yang disepakati |
| Ambang stok menipis | Ditetapkan 23 Oktober 2026: 1–5 unit dari stok tersedia; 0 habis; >=6 normal |
| Format/ukuran foto | Ditetapkan 23 Oktober 2026: JPEG/PNG/WebP maksimum 2.000.000 byte; penyimpanan hosting tetap dipilih sebelum deployment unggahan |
| Kontak dan testimoni | Gunakan informasi resmi serta data yang diizinkan untuk ditampilkan |
| Tenggat dan penanggung jawab | Ditentukan berdasarkan jadwal Kelompok 11 |

## 22. Definition of Done

Versi awal dinyatakan selesai apabila:

1. Seluruh kebutuhan P0 tersedia dan dapat didemonstrasikan.
2. Alur pembeli dan admin berjalan sesuai hak akses.
3. Integrasi Midtrans Snap Sandbox berhasil diuji minimal pada satu kanal transfer bank/VA yang diaktifkan.
4. Perhitungan diskon, stok, dan status konsisten pada pengujian normal maupun bersamaan.
5. Callback berulang, gagal, terlambat, dan tidak valid ditangani sesuai ketentuan.
6. Ulasan hanya diterima dari pembelian yang memenuhi syarat.
7. Tampilan mengikuti arah desain dan dapat digunakan pada ukuran layar target.
8. Frontend React dan backend berada dalam satu proyek Next.js, menggunakan PostgreSQL dengan migrasi yang terdokumentasi.
9. Styling utama menggunakan Tailwind CSS; shadcn/ui disesuaikan dengan Figma, komponen bersama digunakan secara konsisten, dan pengecualian CSS khusus terdokumentasi.
10. Proposal, use case, RAT, activity, sequence, serta implementasi menggunakan aturan yang sama.
11. Panduan instalasi, konfigurasi sandbox, akun demo, dan skenario pengujian tersedia.
12. Tidak ada masalah kritis yang menyebabkan akses tanpa izin, salah total transaksi, kehilangan data, atau penggandaan pembayaran/pemrosesan.
13. Integrasi yang diadaptasi dari payment method telah diuji di aplikasi baru dan tidak mencampur data proyek lama.
14. Aset halaman dalam cakupan penyerahan telah diperiksa dan tidak memiliki tautan gambar rusak.
15. Database serta konfigurasi Salvora Kitchen terpisah dari LanggananKu; tidak ada fallback koneksi ke database lama.
16. Sukses pembayaran tidak membuat atau memperpanjang langganan; hanya menerapkan aturan pesanan produk.
17. Batas waktu pesanan, reservasi, transaksi Snap, dan UI konsisten; redirect browser tidak dapat memalsukan pembayaran sukses.
18. Desain dan implementasi mengikuti audit cakupan bagian 24; fitur yang ditunda tidak ditampilkan sebagai kontrol aktif yang tidak berfungsi.
19. Task P0 pada dokumen task backend ditutup dengan bukti pemeriksaan dan referensi kebutuhan; task yang belum diuji tidak dinyatakan selesai.

## 23. Acuan dokumen

Dokumen ini disusun dari materi yang diberikan pengguna dalam percakapan:

1. **PROPOSAL RANCANGAN PROJECT E-COMMERCE.pdf**, proposal Kelompok 11, 22 halaman.
2. Activity diagram terbaru **Checkout & Pembayaran**, dengan swimlane Bank, Sistem, dan Pembeli.
3. Activity diagram terbaru **Kelola Produk**, dengan swimlane Admin dan Sistem.
4. Activity diagram terbaru **Ulasan & Rating**, dengan swimlane Sistem dan Pembeli.
5. **Beranda pelanggan.png**, acuan visual Salvora Kitchen.
6. Ketentuan pengguna untuk menggunakan **React dan Tailwind CSS**, dengan pembatasan penggunaan CSS native/manual.
7. [File Figma Salvora Kitchen](https://www.figma.com/design/Mz9sFXvJbWMbAlgTY9AaaR/Untitled), khususnya [Beranda pelanggan](https://www.figma.com/design/Mz9sFXvJbWMbAlgTY9AaaR/Untitled?node-id=29-4), serta ekspor di `.Desain` dan aset di `.Desain/Assets`.
8. Keputusan diskusi lanjutan: **Next.js** untuk frontend/backend, **PostgreSQL** untuk database, **Tailwind CSS + shadcn/ui** untuk tampilan, dan adaptasi integrasi proyek **payment method** setelah pemeriksaan.
9. Pemeriksaan kode proyek **LanggananKu** pada 22 Oktober 2026: `package.json`, `prisma/schema.prisma`, modul Midtrans, layanan pembayaran, kebijakan status, webhook, dan koneksi database. Temuan ini merupakan pemeriksaan sumber, bukan hasil pengujian runtime.
10. Dokumentasi resmi Midtrans: [penanganan notifikasi](https://docs.midtrans.com/reference/handle-notifications), [siklus status transaksi](https://docs.midtrans.com/docs/transaction-status-cycle), dan [expiry sesi Snap](https://docs.midtrans.com/reference/expire-a-snap-session). Digunakan untuk memperjelas verifikasi server, status tidak berurutan, pengecualian pembayaran, dan penyelarasan masa berlaku.

Gambar acuan tidak disematkan sebagai tautan lokal sementara agar file Markdown tetap dapat dibagikan tanpa ketergantungan pada folder perangkat asal. Deskripsi desain, kebutuhan, dan penyesuaiannya telah dimuat dalam dokumen ini.

### Riwayat perubahan

| Versi | Tanggal | Perubahan |
|---|---|---|
| 1.1 | 20 Oktober 2026 | PRD lengkap dengan ketentuan React dan Tailwind CSS |
| 1.2 | 22 Oktober 2026 | Menetapkan Next.js, PostgreSQL, shadcn/ui, acuan Figma, aset bertahap, serta adaptasi proyek payment method; menyelaraskan arsitektur, pengujian, tahapan, dan Definition of Done |
| 1.3 | 22 Oktober 2026 | Menetapkan Midtrans Snap Sandbox berdasarkan sumber LanggananKu; memperjelas webhook, status, retry, referensi transaksi, expiry, pemisahan database, dan penggantian logika langganan |
| 1.4 | 22 Oktober 2026 | Menambahkan audit desain admin/pelanggan, FR-13/FR-14, prioritas fitur, UAT tambahan, dan pelaksanaan task backend yang terhubung ke PRD |
| 1.5 | 23 Oktober 2026 | Mengunci persetujuan pengguna pada BE-04: katalog/detail publik, stok menipis 1–5 tersedia, JPEG/PNG/WebP maksimal 2.000.000 byte; tanpa tambahan fitur |
| 1.6 | 23 Oktober 2026 | BE-06: menetapkan pembulatan diskon ke bawah sekali pada subtotal seluruh barang, maksimum Rp100.000; tanpa tambahan fitur |
| 1.7 | 23 Oktober 2026 | BE-07: menetapkan batas pembayaran 60 menit sejak order dibuat dan delivery manual awal Kota Tanjungpinang, Kepulauan Riau, Rp10.000 per pesanan; tanpa tambahan fitur |
| 1.8 | 23 Oktober 2026 | BE-11: konfirmasi penerimaan manual oleh admin, flag receiptConfirmed=true dan catatan wajib sebelum Selesai; tanpa penyelesaian otomatis |
| 1.9 | 23 Oktober 2026 | BE-12: pengguna menyetujui rating integer 1–5, komentar trim 10–1.000 karakter dan satu ulasan per item; tidak menambah moderasi/testimoni P1 |

## 24. Audit desain dan keputusan cakupan admin

Audit berdasarkan ekspor PNG pada `.Desain` yang diperiksa pada 22 Oktober 2026. Akses Figma langsung pada audit ini terkena batas pemakaian; perubahan yang belum diekspor belum diverifikasi. Catatan berikut menjadi acuan perilaku saat desain diterapkan. File Figma/PNG belum diubah oleh audit ini.

### 24.1 Prinsip penyelarasan

- PRD menentukan fitur dan aturan; Figma menentukan arah visual dan susunan antarmuka. Tombol atau menu pada gambar tidak otomatis mengesahkan fitur baru.
- Pertahankan identitas visual dan sesuaikan kontrol dengan kemampuan yang benar-benar tersedia.
- Utamakan katalog, voucher pembeli baru, pembayaran terverifikasi, pemenuhan, dan ulasan pembelian selesai.
- “Ada di use case” tidak berarti aturan backend sudah lengkap. Kelola diskon, laporan, dan moderasi disebut secara umum pada proposal, tetapi pengembangannya tetap mengikuti prioritas PRD.
- Jika kontrol belum masuk cakupan, sembunyikan dari navigasi versi awal; jangan membiarkan tombol palsu yang melaporkan berhasil tanpa penyimpanan.

### 24.2 Pemetaan halaman admin

| Desain | Keputusan versi awal | Penyesuaian wajib | Acuan |
|---|---|---|---|
| Dashboard | P0 ringkasan; P1 grafik/analitik | Definisikan metrik dan periode; ganti label pendapatan jika hanya menghitung pembayaran; jangan gunakan angka contoh | FR-13 |
| Kelola Produk | P0 | Pisahkan aktif/nonaktif dari ketersediaan; pencarian/filter/pagination; nonaktifkan produk historis | FR-09 |
| Tambah/Ubah Produk | P0 | Sidebar Kelola Produk, stok tanpa Rp, pilihan kategori tersimpan, validasi, tombol Simpan/Batal, status unggahan foto | FR-09 |
| Kategori Produk | P0 | Gunakan versi kartu sebagai acuan terisi; halaman kosong adalah keadaan tanpa data; jumlah produk dinamis | FR-09 |
| Pesanan | P0 | Nomor/tanggal pesanan, dua jenis status, detail multi-item, perubahan status terkontrol; tanpa hapus transaksi | FR-08/FR-10 |
| Ekspor Data Pesanan | Ditunda, kandidat P1 | Tentukan format, periode, kolom dan akses sebelum ditugaskan; jika dikerjakan sidebar tetap Pesanan | Belum ada FR ekspor |
| Promosi | P0 hanya sebagai Voucher Pembeli Baru | Hapus CRUD promo umum, minimum belanja dan beli 2 gratis 1; tampilkan aturan tetap serta penggunaan | FR-05/FR-13 |
| Pengaturan utama | Tidak menjadi modul generik P0 | Tampilkan hanya pengaturan yang benar-benar didukung; jangan membuat semua submenu karena ada pada desain | FR-14 |
| Profil Toko | Ditunda, kandidat P1 | Informasi awal dari konfigurasi; CRUD logo/kontak/jam operasional memerlukan FR tambahan | Belum ada FR CMS |
| Akun Admin | P0 profil dasar akun sendiri | Nama dan email sebagai informasi; hanya nama tampilan dapat diedit; atribut lain ditunda | FR-14 |
| Pembayaran | P0 pemantauan/informasi integrasi | Ganti COD/rekening manual/toggle dompet menjadi informasi Midtrans yang aman dan status transaksi | FR-07/FR-10 |
| Pengiriman | P0 delivery manual; pengaturan lanjut ditunda | Tarif/wilayah ditentukan sebelum checkout final; tanpa pickup atau gratis ongkir otomatis | FR-04/FR-06/FR-10 |
| Notifikasi | Preferensi ditunda, kandidat P1 | Toast umpan balik tersedia; pusat notifikasi dan kanal eksternal memerlukan aturan terpisah | Bagian 7/FR lanjutan |
| Moderasi Ulasan | P1 | Jika dikerjakan, tambahkan halaman dan alasan moderasi; tidak mengubah rating pembeli | FR-11/FR-12 |

Menu admin versi awal: **Dashboard, Produk, Kategori, Pesanan, Pembayaran, Voucher Pembeli Baru, Akun Saya, Logout**. Halaman pembayaran dapat menjadi tab pada Pesanan jika semua akses yang dibutuhkan tetap tersedia. Daftar ini tidak mewajibkan setiap menu memiliki modul penyimpanan tersendiri.

### 24.3 Koreksi transaksi, promosi, dan pengiriman

- Status pesanan bukan Aktif/Tidak Aktif. Kanal pembayaran berasal dari Midtrans, bukan teks Cash/Transfer/QRIS yang ditentukan manual.
- Kolom ID Pelanggan pada desain pesanan berisi nama; pisahkan nomor pesanan dari informasi pembeli.
- Ikon edit pesanan membuka detail/tindakan yang diizinkan; tidak memberi hak mengubah total transaksi historis.
- Tombol hapus transaksi dikeluarkan dari alur rutin. Keluhan atau kasus khusus dicatat tanpa menghilangkan audit pembayaran.
- Banner memakai “Diskon 20% untuk Pembeli Baru — Maksimal Rp100.000”, tanpa minimum Rp100.000 atau periode kampanye baru yang belum disetujui.
- COD dan transfer manual berada di luar P0. Checkbox DANA/OVO/GoPay tidak dianggap bukti integrasi kanal merchant.
- Preferensi pemberitahuan tidak boleh mematikan webhook, rekonsiliasi, perubahan status, atau audit data.
- Delivery manual tidak membutuhkan integrasi kurir. Tarif dan gratis ongkir pada gambar bukan sumber aturan transaksi. Kebijakan aktif adalah delivery seluruh Kota Tanjungpinang, Kepulauan Riau, Rp10.000 per pesanan sesuai keputusan terbaru; tarif Rp5.000, pickup, dan gratis ongkir bersyarat pada desain tidak diterapkan.
- Pickup menambah status Siap Diambil dan aturan penerimaan; tidak dibuat sebelum perubahan ruang lingkup disetujui.

### 24.4 Celah desain pelanggan dan data

- Registrasi wajib memiliki kata sandi dan konfirmasi sesuai FR-01. Jenis kelamin tidak diwajibkan karena belum memiliki kebutuhan bisnis.
- Alamat pengiriman dikelola terpisah dari formulir registrasi minimum dan harus dimiliki pembeli yang checkout.
- Checkbox Ingatkan Saya tidak diaktifkan sebelum aturan masa sesi ditetapkan; login P0 tetap dapat berjalan tanpa fitur tersebut.
- Ekspor Ulasan Dan Rating merupakan testimoni/kontak, bukan formulir ulasan terverifikasi. Tambahkan desain pemilihan item pesanan, rating 1–5, komentar, validasi, dan hasil Submit.
- Lengkapi desain keranjang, alamat, checkout, Snap/halaman pembayaran, riwayat/detail pesanan, serta transaksi Perlu Penanganan. Kekosongan desain tidak menghapus kebutuhan fungsionalnya.
- Risol, Cookies, Pastry, Dessert, nama, harga, dan foto di berbagai halaman harus berasal dari data yang konsisten. Kategori tambahan boleh menggunakan model kategori yang sama tanpa membuat jenis proses baru; daftar produk demo tetap perlu disepakati.
- Avatar contoh tidak menjadi alasan menambahkan sistem unggah foto pengguna pada P0.

### 24.5 Dampak ke backend dan database

P0 menggunakan entitas bagian 13. Dashboard menghitung data yang ada; tidak memerlukan tabel metrik dengan angka dummy. Pemantauan voucher menggunakan `discounts` dan relasinya ke pesanan. Data profil dasar menggunakan `users`.

Jangan membuat tabel promo umum, paket langganan, pengiriman pickup, pengaturan kanal pembayaran manual, atau preferensi notifikasi hanya untuk meniru desain. Jika kandidat tersebut disetujui kemudian, tetapkan aturan, migrasi, hak akses, dan UAT terlebih dahulu.

## 25. Pelaksanaan berbasis task dan pengendalian perubahan

Daftar pekerjaan backend disimpan pada [docs/TASKS-BACKEND.md](docs/TASKS-BACKEND.md). Dokumen task menerjemahkan PRD menjadi pekerjaan terukur; tidak menggantikan atau memperluas aturan PRD.

Tahap frontend menggunakan [docs/TASKS-FRONTEND.md](docs/TASKS-FRONTEND.md), dengan [validasi kesiapan backend 24 Oktober](docs/BE-VALIDATION-FOR-FE.md) dan [script FE-00](docs/prompts/FE-00.md). Penambahan rujukan task dan klarifikasi audit desain ini tidak mengubah aturan bisnis versi 1.9 atau kontrak API 0.13.

### 25.1 Cara menjalankan task

1. Baca versi PRD aktif dan bagian yang dirujuk task.
2. Periksa dependensi, keadaan kode, dan keputusan yang memengaruhi task.
3. Ambil satu task atau satu bagian task yang hasilnya dapat diuji. Task dapat diperkecil tanpa mengubah tujuan atau kehilangan kriteria penerimaan.
4. Implementasikan hasil dalam batas task; catat migrasi dan kontrak API yang berubah.
5. Jalankan pemeriksaan yang relevan, catat hasil aktual, dan perbaiki kegagalan sebelum menutup task.
6. Perbarui status serta catatan serah terima sehingga pekerjaan berikutnya dapat dilanjutkan tanpa mengulang analisis.

Status: **Belum dimulai → Dikerjakan → Ditinjau → Selesai**. Gunakan **Terhambat** hanya jika ada dependensi yang benar-benar menghalangi; tulis penyebab dan pekerjaan lain yang masih dapat dilanjutkan. Status ini adalah pencatatan proyek, bukan pembuatan chat/tugas otomatis dalam aplikasi.

### 25.2 Isi minimum setiap task

- ID, judul, prioritas, status, versi PRD acuan, dan penanggung jawab jika sudah ditetapkan.
- Referensi FR/bagian PRD, dependensi, hasil yang harus tersedia, dan batas pekerjaan.
- Kriteria selesai yang dapat dibuktikan serta UAT terkait.
- Keputusan/asumsi, hasil pemeriksaan, hambatan, dan catatan untuk task berikutnya.

### 25.3 Aturan perubahan

- Perbaikan rutin sesuai PRD dapat dilanjutkan tanpa persetujuan berulang.
- Fitur di luar PRD masuk daftar usulan; jangan otomatis dibuat karena muncul di Figma atau kode LanggananKu.
- Untuk perubahan aturan bisnis, catat masalah, usulan, dampak pada data/API/UI/pengujian, dan keputusan kelompok. Perbarui versi PRD sebelum task yang bergantung pada perubahan dikerjakan.
- Keputusan belum final pada bagian 21 hanya menghambat bagian yang bergantung padanya. Misalnya integrasi Midtrans dan checkout final menunggu expiry/ongkir, tetapi autentikasi dan katalog dapat dikerjakan.
- Setelah versi PRD berubah, tinjau task terbuka dan catat versi acuannya; jangan menganggap task lama otomatis sesuai.
- Backend selesai berarti kontrak API, aturan bisnis, migrasi, serta pemeriksaan relevan tersedia. Integrasi UI lengkap tetap memiliki tahap tersendiri; tes backend saja belum membuktikan seluruh PRD produk selesai.
