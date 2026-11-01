# BAB III
# METODE PENGEMBANGAN DAN ANALISIS SISTEM

## 3.1 Gambaran Umum Sistem

Salvora Kitchen merupakan website e-commerce dengan model Business-to-Consumer (B2C) untuk penjualan camilan dari satu toko kepada konsumen. Kategori awal yang digunakan adalah risol dan cookies. Website menghubungkan penyajian katalog, keranjang, pemesanan, pembayaran, pemenuhan pesanan, dan ulasan dalam satu aplikasi.

Sistem memiliki dua peran akun, yaitu pembeli dan admin. Pengunjung tanpa login dapat melihat beranda, katalog, detail produk, serta ulasan publik. Pembeli menggunakan akun untuk mengelola keranjang dan alamat, melakukan checkout dan pembayaran, melihat riwayat pesanan, serta memberikan ulasan. Admin mengelola kategori, produk, foto, stok, dan pemenuhan pesanan serta memantau pembayaran dan voucher.

Tiga fitur inti yang menjadi fokus pengembangan adalah sebagai berikut.

1. **Voucher pembeli baru.** Sistem menerbitkan voucher secara otomatis bagi akun yang memenuhi syarat, dengan potongan 20% dari subtotal barang, maksimal Rp100.000, dan penggunaan satu kali per akun.
2. **Checkout dan pembayaran terintegrasi.** Sistem menghitung rincian biaya, menyimpan pesanan, dan menyediakan pembayaran melalui Midtrans Snap Sandbox. Status pembayaran ditentukan melalui verifikasi server.
3. **Rating dan ulasan pembelian selesai.** Pembeli hanya dapat memberikan ulasan untuk item pada pesanan miliknya yang telah selesai, dengan pembatasan satu ulasan per item pesanan.

Pembeli dapat memilih pengantaran manual di Kota Tanjungpinang, Kepulauan Riau, dengan ongkir Rp10.000 per pesanan, atau mengambil sendiri tanpa ongkir. Pengelolaan penerimaan dilakukan oleh admin sesuai metode yang dipilih. Seluruh pembayaran dalam cakupan proyek menggunakan lingkungan Sandbox dan tidak memindahkan uang sungguhan.

Antarmuka menggunakan React melalui Next.js, dengan Tailwind CSS dan shadcn/ui untuk penyusunan tampilan. API dan logika bisnis berjalan pada server Next.js, sedangkan data disimpan dalam PostgreSQL melalui Prisma. Informasi harga, stok, voucher, izin pengguna, dan hasil pembayaran diperiksa pada server agar keputusan transaksi tidak bergantung pada data yang dikirim browser.

## 3.2 Metode Pengembangan

### 3.2.1 Kerangka Pengembangan

Proposal awal menetapkan Waterfall sebagai kerangka tahapan pengembangan, meliputi analisis kebutuhan, perancangan, implementasi, pengujian, dan penyerahan. Kerangka tersebut digunakan untuk mengelompokkan kegiatan dan keluaran proyek dalam laporan.

Pelaksanaan yang tercatat dalam dokumentasi proyek dibagi menjadi pekerjaan backend dan frontend berdasarkan fitur serta dependensinya. Pemeriksaan dan perbaikan dilakukan pada setiap bagian yang dikerjakan. Dengan demikian, penggunaan kerangka Waterfall dalam laporan tidak dimaksudkan sebagai klaim bahwa seluruh kebutuhan telah tetap sejak awal atau setiap tahap selesai sepenuhnya tanpa peninjauan ulang.

Perubahan kebutuhan perlu dicatat dan diselaraskan dengan implementasi. Salah satu contohnya adalah opsi ambil sendiri, yang belum termasuk cakupan PRD awal tetapi telah tersedia pada kode aplikasi. Pembahasan laporan mengikuti kemampuan aplikasi yang dapat ditelusuri pada implementasi tersebut.

### 3.2.2 Tahapan Pengembangan

| Tahap | Kegiatan dalam proyek | Keluaran yang digunakan |
|---|---|---|
| Analisis kebutuhan | Menetapkan aktor, ruang lingkup, aturan voucher, pembayaran, penerimaan pesanan, dan ulasan | Proposal, PRD, catatan keputusan, serta kebutuhan sistem yang diselaraskan |
| Perancangan sistem | Menyusun hubungan data, alur proses, interaksi antarkomponen, dan rancangan antarmuka | Use case, RAT, activity diagram, sequence diagram, rancangan UI, serta kontrak API |
| Implementasi | Membangun autentikasi, katalog, transaksi, integrasi pembayaran, ulasan, dan modul admin | Kode aplikasi Next.js, komponen antarmuka, layanan bisnis, skema dan migrasi PostgreSQL |
| Pengujian dan perbaikan | Memeriksa perhitungan, validasi, hak akses, integrasi data, pembayaran, dan interaksi antarmuka | Pengujian otomatis, catatan pemeriksaan, perbaikan, serta daftar keterbatasan |
| Penyusunan laporan dan penyerahan | Menyelaraskan uraian proyek dengan aplikasi serta menyiapkan panduan penggunaan dan demonstrasi | Laporan proyek, panduan menjalankan aplikasi, dan bahan demo |

Keberadaan suatu keluaran tidak otomatis menyatakan seluruh tahap telah selesai. Diagram awal masih perlu diselaraskan dengan implementasi, sedangkan penerimaan antarmuka secara menyeluruh mengikuti bukti pemeriksaan yang tersedia.

### 3.2.3 Pengendalian Perubahan dan Verifikasi

Pekerjaan proyek diuraikan menjadi bagian yang dapat diperiksa, seperti autentikasi, katalog, keranjang, checkout, pembayaran, dan pengelolaan admin. Setiap bagian memiliki batas pekerjaan, dependensi, dan kriteria penerimaan. Hasil pemeriksaan dibedakan antara fungsi yang telah diuji, pengamatan terbatas, dan bagian yang masih memerlukan verifikasi.

Pengujian mencakup logika aplikasi, integrasi HTTP, interaksi dengan PostgreSQL pada lingkungan pengujian, serta pemeriksaan browser untuk bagian yang terdokumentasi. Pengujian integrasi pembayaran Sandbox dibedakan dari pengujian dengan data pembayaran sintetis. Hasil satu jenis pengujian tidak digunakan untuk mengklaim kelulusan jenis pengujian lain.

Dokumentasi verifikasi frontend yang tersedia masih mencatat keterbatasan pemeriksaan lintas halaman, keadaan antarmuka, dan pembayaran melalui UI. Oleh karena itu, bab ini menjelaskan metode serta kebutuhan sistem tanpa menyatakan bahwa seluruh pengujian produk dan kesiapan produksi telah selesai.

## 3.3 Metode Pengumpulan Data dan Kebutuhan

### 3.3.1 Studi Dokumen Proyek

Analisis kebutuhan menggunakan proposal rancangan, dokumen progres, PRD, catatan keputusan, kontrak API, serta dokumentasi backend dan frontend. Proposal memberikan konteks akademik dan fokus awal proyek, sedangkan dokumentasi implementasi menjelaskan perkembangan aturan dan cakupan pengerjaan.

Isi dokumen dibandingkan untuk menemukan perbedaan. Sebagai contoh, proposal rancangan memuat alur pembayaran otomatis sekaligus unggah bukti transfer dan persetujuan admin. Perbedaan tersebut diselesaikan dalam laporan dengan merujuk pada implementasi Midtrans Snap Sandbox yang digunakan aplikasi.

### 3.3.2 Studi Dokumentasi Teknis

Dokumentasi resmi teknologi digunakan untuk menjelaskan konsep dan mekanisme yang mendasari aplikasi. Sumber tersebut meliputi React, Next.js, Tailwind CSS, shadcn/ui, PostgreSQL, Prisma, dan Midtrans. Dasar teori dan tautan rujukan teknis dijabarkan pada Bab II.

Studi dokumentasi mendukung penjelasan seperti pemisahan client dan server, penanganan API, penyimpanan data, serta verifikasi notifikasi pembayaran. Aturan khusus toko, seperti nominal ongkir dan besar diskon, tetap berasal dari kebutuhan proyek.

### 3.3.3 Penelaahan Desain dan Implementasi

Use case, RAT, activity diagram, sequence diagram, serta rancangan UI dalam dokumen awal digunakan untuk memahami alur yang direncanakan. Selanjutnya, alur tersebut dicocokkan dengan halaman, komponen, layanan, validator, dan skema basis data yang telah tersedia.

Pencocokan ini membedakan fitur yang telah diimplementasikan dari fitur yang baru tercantum pada desain. Maps, filter rasa, moderasi ulasan, promosi umum, dan laporan produk terlaris tidak dimasukkan sebagai kemampuan website karena tidak termasuk implementasi yang menjadi cakupan laporan.

### 3.3.4 Penelaahan Bukti Pengujian

Laporan pengujian dan kode pengujian digunakan sebagai sumber untuk memahami perilaku yang diperiksa, seperti penolakan akses tanpa izin, batas diskon, pembuatan pesanan berulang, dan validasi ulasan. Penelaahan dokumen pengujian tidak disamakan dengan pelaksanaan ulang pengujian.

Uraian pengumpulan kebutuhan dalam laporan dibatasi pada sumber yang dapat ditelusuri. Wawancara pelanggan, survei pengguna, observasi usaha secara langsung, serta konsultasi dosen tidak dinyatakan sebagai kegiatan yang telah dilakukan tanpa catatan pendukung.

## 3.4 Analisis Kebutuhan Sistem

### 3.4.1 Identifikasi Aktor dan Hak Akses

| Aktor | Peran dalam sistem | Batas akses |
|---|---|---|
| Pengunjung | Melihat beranda, kategori, katalog, detail produk, dan ulasan publik | Perlu login sebagai pembeli untuk bertransaksi atau mengirim ulasan |
| Pembeli | Mengelola keranjang dan alamat, checkout, membayar, melihat pesanan, serta memberikan ulasan | Hanya mengakses data pribadi dan transaksi miliknya; tidak menjalankan fungsi admin |
| Admin | Mengelola kategori, produk, foto, stok, dan pemenuhan pesanan; memantau pembayaran, voucher, dan dashboard | Tidak menetapkan pembayaran sukses secara manual atau mengubah nominal transaksi historis |
| Midtrans Snap Sandbox | Menyediakan antarmuka pembayaran, notifikasi transaksi, dan layanan pemeriksaan status | Berinteraksi melalui integrasi server; tidak menjadi akun pengguna toko |

Proses otomatis, seperti perhitungan diskon, reservasi stok, dan pembaruan pembayaran, merupakan tanggung jawab internal sistem. Proses tersebut dibedakan dari aktor eksternal pada pemodelan use case.

### 3.4.2 Kebutuhan Fungsional

Kebutuhan fungsional berikut merumuskan perilaku yang tercakup dalam implementasi. Kode KF digunakan sebagai identitas kebutuhan pada laporan ini; nomor pada proposal lama tidak dipakai sebagai pemetaan langsung karena cakupannya telah diselaraskan.

| Kode | Kebutuhan fungsional | Pengguna atau pemicu |
|---|---|---|
| KF-01 | Sistem menyediakan registrasi pembeli, login, logout, dan pengenalan sesi sesuai peran | Pengunjung, pembeli, admin |
| KF-02 | Sistem menerbitkan satu voucher bagi pembeli baru yang memenuhi syarat pada registrasi atau login | Proses autentikasi pembeli |
| KF-03 | Sistem menampilkan katalog dan detail produk, filter kategori, serta pembagian halaman tanpa mewajibkan login | Pengunjung, pembeli |
| KF-04 | Sistem menyediakan penambahan produk ke keranjang, perubahan jumlah, dan penghapusan item | Pembeli |
| KF-05 | Sistem menyediakan penambahan, pembacaan, pengubahan, dan penghapusan alamat milik pembeli | Pembeli |
| KF-06 | Sistem menyediakan pilihan diantar atau ambil sendiri beserta alamat atau kontak yang diperlukan | Pembeli |
| KF-07 | Sistem memvalidasi data checkout dan menampilkan ringkasan subtotal, diskon, ongkir, serta total dari server | Pembeli |
| KF-08 | Sistem membuat pesanan setelah konfirmasi, menyimpan rincian historis, dan mencadangkan stok serta voucher yang digunakan | Pembeli |
| KF-09 | Sistem menyediakan instruksi pembayaran Midtrans Snap Sandbox untuk pesanan milik pembeli yang masih memenuhi syarat | Pembeli |
| KF-10 | Sistem memverifikasi notifikasi dan memeriksa status pembayaran, kemudian menerapkan hasil secara konsisten | Notifikasi Midtrans atau proses pemeriksaan server |
| KF-11 | Sistem menampilkan riwayat dan detail pesanan pembeli, status pembayaran, serta perkembangan pemenuhan | Pembeli |
| KF-12 | Sistem menerima rating dan ulasan untuk item pada pesanan milik pembeli yang telah selesai | Pembeli |
| KF-13 | Sistem menampilkan ulasan publik, jumlah ulasan, dan rata-rata rating produk | Pengunjung, pembeli |
| KF-14 | Sistem menyediakan pengelolaan nama dan status aktif kategori serta daftar kategori | Admin |
| KF-15 | Sistem menyediakan pengelolaan data produk, kategori produk, foto, harga, dan status aktif produk | Admin |
| KF-16 | Sistem menyediakan perubahan stok fisik dengan pemeriksaan versi data dan jumlah stok yang telah dicadangkan | Admin |
| KF-17 | Sistem menampilkan daftar dan detail pesanan, filter, serta pencatatan status pemenuhan dan catatan internal | Admin |
| KF-18 | Sistem menampilkan daftar percobaan pembayaran dan keterkaitannya dengan pesanan | Admin |
| KF-19 | Sistem menampilkan ringkasan pesanan berdasarkan periode serta kondisi stok saat ini pada dashboard | Admin |
| KF-20 | Sistem menampilkan aturan tetap voucher, status voucher, pemilik, dan relasi pesanannya | Admin |
| KF-21 | Sistem menyediakan pembacaan profil akun admin sendiri dan pengubahan nama tampilannya | Admin |

Pengelolaan produk historis menggunakan penonaktifan untuk menjaga riwayat transaksi. Pemantauan voucher tidak menyediakan perubahan persentase diskon atau pembuatan kampanye promosi umum. Pengelolaan akun admin sendiri tidak mencakup pengubahan email, peran, atau akun admin lain.

### 3.4.3 Kebutuhan Nonfungsional

Kebutuhan nonfungsional menjelaskan kualitas yang harus dijaga oleh sistem. Cara pemeriksaan pada tabel merupakan acuan evaluasi, bukan pernyataan bahwa seluruh pemeriksaan telah lulus.

| Kode | Aspek | Kebutuhan dan cara pemeriksaan |
|---|---|---|
| KN-01 | Keamanan akun | Kata sandi disimpan sebagai hash, sesi diperiksa oleh server, dan logout mencabut sesi; diperiksa melalui skenario autentikasi |
| KN-02 | Otorisasi dan privasi | Akses dibatasi berdasarkan peran dan kepemilikan; permintaan ke data pembeli lain harus ditolak |
| KN-03 | Validasi masukan | Server memeriksa tipe, panjang, nilai, dan field yang diizinkan; data tidak valid tidak menghasilkan perubahan transaksi |
| KN-04 | Integritas transaksi | Pembuatan pesanan, reservasi, dan penerapan pembayaran harus konsisten; kegagalan tidak menyimpan sebagian perubahan bisnis |
| KN-05 | Ketahanan terhadap pengulangan | Pengiriman ulang konfirmasi dan notifikasi pembayaran tidak menggandakan pesanan, penggunaan voucher, atau pengurangan stok |
| KN-06 | Keamanan foto produk | Unggahan dibatasi menurut jenis, isi, dan ukuran berkas; berkas tidak valid ditolak sebelum digunakan sebagai foto produk |
| KN-07 | Kejelasan antarmuka | Formulir, rincian biaya, status, serta keadaan loading, kosong, dan gagal memiliki informasi yang dapat dipahami |
| KN-08 | Responsivitas | Susunan halaman menyesuaikan layar; pemeriksaan dilakukan pada tampilan sempit, sedang, dan lebar, termasuk kontrol dan konten panjang |
| KN-09 | Pengelolaan daftar | Katalog, pesanan, ulasan, dan daftar admin menggunakan pembagian halaman sesuai kebutuhan agar data tidak harus ditampilkan sekaligus |
| KN-10 | Pemeliharaan | Halaman, komponen, adapter API, layanan bisnis, dan akses basis data dipisahkan; perubahan skema dicatat melalui migrasi |
| KN-11 | Keterlacakan | Riwayat status dan catatan pembayaran mendukung penelusuran transaksi; catatan privat admin tidak ditampilkan kepada pembeli |
| KN-12 | Pemisahan lingkungan | Data pengujian dipisahkan dari data pengembangan, dan pembayaran proyek menggunakan konfigurasi Sandbox |

Target waktu muat, kapasitas pengguna bersamaan, dan ketersediaan layanan produksi tidak ditetapkan sebagai angka yang telah dicapai karena belum didukung hasil pengukuran pada cakupan laporan ini.

### 3.4.4 Kebutuhan Teknologi dan Data

| Bagian | Teknologi atau data yang digunakan | Peran |
|---|---|---|
| Antarmuka | React, Tailwind CSS, shadcn/ui | Menampilkan halaman dan menangani interaksi pengguna |
| Aplikasi dan API | Next.js dan TypeScript | Menjalankan halaman, endpoint, validasi, serta logika server |
| Basis data | PostgreSQL | Menyimpan pengguna, katalog, transaksi, dan riwayat |
| Akses dan migrasi data | Prisma | Mendefinisikan model, mengakses data, dan mengelola perubahan skema |
| Pembayaran | Midtrans Snap Sandbox | Menyediakan simulasi pembayaran dan pemeriksaan status |
| Data operasional | Akun, alamat, kategori, produk, foto, keranjang, voucher, pesanan, pembayaran, reservasi stok, dan ulasan | Mendukung alur transaksi serta pengelolaan toko |

Struktur tabel dan relasinya dijelaskan lebih lanjut pada bab perancangan. Foto, harga, dan stok yang ditandai sebagai data demo tidak diperlakukan sebagai data usaha resmi atau bukti transaksi nyata.

## 3.5 Aturan Bisnis

Aturan berikut menyelaraskan proses dalam website dan menjadi acuan penyusunan diagram. Kode AB berlaku untuk laporan ini dan menggantikan penggunaan nomor aturan lama yang masih menjelaskan pembayaran manual.

### 3.5.1 Akun, Produk, dan Stok

| Kode | Aturan bisnis |
|---|---|
| AB-01 | Registrasi publik menghasilkan akun pembeli. Akun admin dibuat melalui mekanisme internal, bukan pilihan peran pada formulir registrasi |
| AB-02 | Katalog dan detail produk dapat dibaca tanpa login. Keranjang, checkout, pembayaran, dan pengiriman ulasan memerlukan sesi pembeli yang valid |
| AB-03 | Produk dan kategori harus aktif agar produk dapat dibeli. Harga dan ketersediaan diperiksa kembali oleh server pada proses transaksi |
| AB-04 | Stok tersedia dihitung dari stok fisik dikurangi stok yang dicadangkan. Stok tersedia 0 berarti habis, 1–5 berarti menipis, dan minimal 6 berarti tersedia normal |
| AB-05 | Keranjang dan quote tidak mencadangkan stok. Reservasi dibuat ketika konfirmasi pesanan berhasil |
| AB-06 | Perubahan stok fisik oleh admin tidak boleh lebih kecil daripada stok yang sedang dicadangkan. Perubahan dengan versi data usang ditolak agar admin meninjau data terbaru |
| AB-07 | Foto produk menerima JPEG, PNG, atau WebP dengan ukuran maksimal 2.000.000 byte serta pemeriksaan isi berkas |

### 3.5.2 Voucher dan Perhitungan Biaya

| Kode | Aturan bisnis |
|---|---|
| AB-08 | Pembeli yang memenuhi syarat dan belum memiliki voucher memperoleh satu voucher pada registrasi atau login. Login ulang tidak menerbitkan voucher tambahan |
| AB-09 | Diskon adalah nilai terkecil antara 20% dari subtotal seluruh barang yang dibulatkan ke bawah dan Rp100.000. Jika tidak ada voucher yang memenuhi syarat, diskon bernilai nol |
| AB-10 | Total pembayaran adalah subtotal barang dikurangi diskon kemudian ditambah ongkir. Diskon tidak memotong ongkir dan tidak ditumpuk dengan voucher lain |
| AB-11 | Voucher yang dipakai pada pesanan dicadangkan terlebih dahulu. Status digunakan diterapkan setelah pembayaran berhasil diverifikasi dan diterapkan pada pesanan |
| AB-12 | Satu voucher tidak dapat dicadangkan untuk beberapa pesanan sekaligus. Pelepasan reservasi mengikuti pemeriksaan transaksi, bukan semata-mata kegagalan satu percobaan pembayaran |

### 3.5.3 Checkout dan Cara Menerima Pesanan

| Kode | Aturan bisnis |
|---|---|
| AB-13 | Pengantaran manual hanya melayani Kota Tanjungpinang, Kepulauan Riau, dengan ongkir tetap Rp10.000 per pesanan. Alamat di luar cakupan ditolak untuk checkout pengantaran |
| AB-14 | Ambil sendiri berongkir Rp0 dan menggunakan nama serta nomor telepon pengambil. Pembeli menunggu status Siap diambil dan mengonfirmasi lokasi serta waktu pengambilan dengan toko |
| AB-15 | Quote berlaku selama 5 menit. Jika data penting berubah atau quote kedaluwarsa sebelum konfirmasi, pembeli perlu meminta dan meninjau ringkasan baru |
| AB-16 | Pesanan menyimpan salinan nama barang, harga, jumlah, rincian biaya, dan informasi penerima. Perubahan katalog atau alamat aktif tidak mengubah rincian historis pesanan |
| AB-17 | Pengiriman ulang konfirmasi dengan kunci dan input yang sama mengembalikan pesanan yang sama. Kunci yang sama untuk input berbeda ditolak |

### 3.5.4 Pembayaran dan Pemenuhan Pesanan

| Kode | Aturan bisnis |
|---|---|
| AB-18 | Pembayaran menggunakan Midtrans Snap Sandbox. Nominal berasal dari pesanan yang tersimpan; tidak ada unggah bukti transfer atau persetujuan pembayaran manual oleh admin |
| AB-19 | Batas pembayaran adalah 60 menit sejak pesanan dibuat. Percobaan pembayaran ulang tidak memperpanjang tenggat pesanan |
| AB-20 | Keberhasilan pembayaran ditentukan melalui verifikasi server. Parameter pada halaman pengalihan browser tidak menjadi bukti tunggal pembayaran sukses |
| AB-21 | Notifikasi atau hasil pemeriksaan berulang tidak boleh menggandakan penerapan pembayaran, pengurangan stok, dan penggunaan voucher |
| AB-22 | Hasil pembayaran yang belum pasti perlu diperiksa kembali. Reservasi tidak dilepas hanya karena hitung mundur antarmuka telah mencapai nol |
| AB-23 | Pesanan dengan pembayaran sukses yang telah diterapkan dapat diproses sesuai syarat pemenuhan. Pembayaran berhasil tidak langsung mengubah pesanan menjadi Selesai |
| AB-24 | Untuk pengantaran, alur pemenuhan adalah Diproses → Sedang diantar → Selesai. Untuk ambil sendiri, alurnya adalah Diproses → Siap diambil → Selesai |
| AB-25 | Admin menetapkan Selesai setelah mengonfirmasi penerimaan atau pengambilan dan mengisi catatan. Transisi yang melompati tahap atau memakai status lama ditolak |
| AB-26 | Kasus pembayaran yang memerlukan pemeriksaan khusus ditandai Perlu Penanganan. Admin dapat mencatat tindak lanjut internal, tetapi tidak memiliki fasilitas refund otomatis atau pemaksaan pembayaran sukses |

### 3.5.5 Ulasan dan Informasi Admin

| Kode | Aturan bisnis |
|---|---|
| AB-27 | Ulasan hanya diterima dari pembeli pemilik item pesanan yang berstatus Selesai. Kelayakan diperiksa kembali saat ulasan dikirim |
| AB-28 | Setiap item pesanan hanya dapat memiliki satu ulasan. Rating berupa bilangan bulat 1–5 dan komentar sepanjang 10–1.000 karakter setelah spasi awal dan akhir dibersihkan |
| AB-29 | Ulasan publik menampilkan penilaian, komentar, nama tampilan, dan waktu penulisan tanpa membuka email, alamat, atau data pembayaran pembeli |
| AB-30 | Dashboard menyajikan ringkasan pesanan berdasarkan periode pembuatan pesanan dan inventaris saat ini. Ringkasan tersebut tidak dianggap sebagai laporan laba atau akuntansi |
| AB-31 | Halaman voucher admin memantau aturan tetap dan penggunaan voucher. Halaman akun admin hanya mengizinkan perubahan nama tampilan akun sendiri |

## 3.6 Alur Proses Bisnis

### 3.6.1 Registrasi, Login, dan Penerbitan Voucher

1. Pengunjung mendaftar dengan nama, email, kata sandi, dan konfirmasi kata sandi, atau login menggunakan akun yang telah tersedia.
2. Server memvalidasi masukan dan memeriksa identitas pengguna. Registrasi publik membuat akun pembeli.
3. Sistem membuat sesi dan mengenali peran akun.
4. Untuk pembeli, sistem memeriksa kelayakan pembelian pertama dan keberadaan voucher. Voucher diterbitkan hanya jika ketentuannya terpenuhi.
5. Antarmuka menyediakan navigasi sesuai peran. Pembeli dapat melanjutkan belanja, sedangkan admin mengakses halaman pengelolaan.
6. Apabila validasi atau autentikasi gagal, sistem menampilkan pesan yang sesuai tanpa memberikan akses akun.

### 3.6.2 Pemilihan Produk dan Pengelolaan Keranjang

1. Pengunjung membuka katalog dan dapat memilih kategori atau melihat detail produk serta ulasan.
2. Pembeli yang telah login memilih produk dan jumlah untuk ditambahkan ke keranjang.
3. Server memeriksa produk, status kategori, jumlah, dan stok tersedia.
4. Keranjang menampilkan item dan harga terkini. Pembeli dapat mengubah jumlah atau menghapus item.
5. Item yang tidak lagi tersedia perlu ditinjau sebelum checkout. Penyimpanan item pada keranjang belum menjamin stok telah diperoleh.

### 3.6.3 Checkout dan Pembuatan Pesanan

1. Pembeli membuka checkout dari keranjang dan memilih cara menerima pesanan.
2. Untuk pengantaran, pembeli memilih alamat miliknya. Untuk ambil sendiri, pembeli mengisi nama serta nomor telepon pengambil.
3. Server memeriksa isi keranjang, produk, stok, data penerima, cakupan pengantaran, dan kelayakan voucher.
4. Sistem membuat quote berisi rincian barang, subtotal, diskon, ongkir, dan total pembayaran.
5. Pembeli meninjau ringkasan dan memberikan persetujuan sebelum mengonfirmasi pesanan.
6. Server memeriksa ulang data. Jika ringkasan berubah atau kedaluwarsa, konfirmasi ditolak dan ringkasan perlu diperbarui.
7. Jika valid, sistem menyimpan pesanan berstatus Menunggu Pembayaran, mencadangkan stok dan voucher yang digunakan, mencatat riwayat awal, serta mengeluarkan item yang telah dikonfirmasi dari keranjang.
8. Jika respons terputus setelah penyimpanan, mekanisme pemulihan menggunakan identitas konfirmasi yang sama untuk memperoleh hasil pesanan tanpa membuat pesanan ganda.

### 3.6.4 Pembayaran dan Pemeriksaan Status

1. Pembeli membuka halaman pembayaran untuk pesanan miliknya.
2. Server memeriksa status pesanan, tenggat, dan percobaan pembayaran yang telah tercatat sebelum menyediakan instruksi Snap.
3. Pembeli mengikuti proses pembayaran pada antarmuka Midtrans Sandbox.
4. Server menerima notifikasi atau melakukan pemeriksaan status melalui layanan Midtrans, lalu memverifikasi informasi terhadap transaksi yang tersimpan.
5. Pembayaran sukses yang memenuhi ketentuan diterapkan pada pesanan secara konsisten, termasuk konsumsi reservasi stok dan penggunaan voucher yang terkait.
6. Status yang belum pasti diperiksa kembali. Pembayaran gagal atau kedaluwarsa ditangani berdasarkan keadaan seluruh percobaan, sehingga percobaan ulang dan pelepasan reservasi tidak dilakukan secara sembarang.
7. Pembeli membaca hasil melalui informasi server pada halaman pembayaran atau detail pesanan. Pembayaran yang memerlukan pemeriksaan khusus ditampilkan sesuai statusnya.

### 3.6.5 Pengelolaan Katalog dan Stok oleh Admin

1. Admin login dan membuka halaman kategori atau produk.
2. Admin menambah atau mengubah data yang diperlukan, termasuk kategori, nama, deskripsi, harga, status aktif, dan foto produk.
3. Server memeriksa kelengkapan data serta validitas unggahan foto sebelum menyimpan perubahan.
4. Perubahan stok dilakukan dengan pemeriksaan versi data dan jumlah stok yang sedang dicadangkan.
5. Jika terjadi konflik data, admin perlu memuat ulang dan meninjau informasi terbaru.
6. Produk yang perlu dikeluarkan dari katalog dapat dinonaktifkan dengan tetap mempertahankan rincian transaksi historis.

### 3.6.6 Pemenuhan dan Penyelesaian Pesanan

1. Admin membuka daftar pesanan, memilih pesanan, dan memeriksa detail serta keadaan pembayarannya.
2. Sistem hanya menawarkan transisi pemenuhan yang diizinkan berdasarkan status dan bukti pembayaran.
3. Untuk pengantaran, admin mencatat perubahan dari Diproses menjadi Sedang diantar. Untuk ambil sendiri, admin mencatat perubahan dari Diproses menjadi Siap diambil.
4. Setelah penerimaan atau pengambilan dikonfirmasi secara manual, admin memberikan konfirmasi dan mengisi catatan untuk menyelesaikan pesanan.
5. Sistem memeriksa status terkini, menyimpan perubahan, dan mencatat riwayat. Pembeli dapat melihat perkembangan status pada detail pesanannya.
6. Catatan internal dan identitas pelaku admin tetap terbatas pada halaman admin. Aplikasi tidak menganggap komunikasi manual di luar website sebagai percakapan yang telah diverifikasi secara otomatis.

### 3.6.7 Pemberian Rating dan Ulasan

1. Pembeli membuka riwayat pesanan dan memilih pesanan berstatus Selesai.
2. Pembeli memilih item yang belum diulas, lalu mengisi rating dan komentar.
3. Server memeriksa sesi, kepemilikan item, status pesanan, keberadaan ulasan sebelumnya, serta validitas nilai dan komentar.
4. Jika seluruh syarat terpenuhi, sistem menyimpan satu ulasan untuk item tersebut.
5. Ulasan dapat ditampilkan pada detail produk yang masih tersedia secara publik, bersama jumlah ulasan dan rata-rata rating.
6. Jika item bukan milik pembeli, pesanan belum selesai, atau item telah diulas, permintaan ditolak tanpa membuat ulasan baru.

Alur dan aturan pada bab ini menjadi dasar penyusunan use case, RAT, activity diagram, sequence diagram, dan uraian antarmuka pada bab perancangan. Diagram diselaraskan dengan proses aktual, terutama integrasi Midtrans, pilihan penerimaan pesanan, serta hubungan ulasan dengan item pesanan.
