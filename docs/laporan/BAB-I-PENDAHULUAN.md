# BAB I
# PENDAHULUAN

## 1.1 Latar Belakang

Penjualan makanan melalui website memerlukan penyajian informasi produk dan pengelolaan transaksi yang saling terhubung. Pembeli membutuhkan informasi mengenai jenis produk, harga, ketersediaan, serta cara memperoleh pesanannya. Di sisi pengelola, data produk, stok, pembayaran, dan perkembangan pesanan perlu dicatat secara terstruktur agar informasi yang ditampilkan kepada pembeli sesuai dengan kondisi yang tersimpan dalam sistem.

Salvora Kitchen menjadi objek pengembangan website e-commerce oleh Kelompok 11 dalam proyek mata kuliah Pemrograman Web, Program Studi Teknik Informatika, Universitas Maritim Raja Ali Haji. Website ini berfokus pada penjualan camilan, dengan risol dan cookies sebagai kategori awal. Model layanan yang digunakan adalah Business-to-Consumer (B2C), yaitu penjualan produk dari satu toko kepada konsumen. Pengembangan diarahkan untuk menyediakan alur pemesanan yang menghubungkan pemilihan produk, pengelolaan keranjang, peninjauan biaya, pembayaran, dan pemenuhan pesanan melalui satu aplikasi.

Pengembangan berfokus pada tiga kebutuhan utama, yaitu pemberian voucher pembeli baru secara otomatis, checkout dan pembayaran yang terintegrasi, serta rating dan ulasan berdasarkan pembelian yang telah selesai. Pemberian voucher memerlukan pemeriksaan kelayakan agar satu akun tidak memperoleh atau menggunakan potongan secara berulang. Pembayaran memerlukan verifikasi status agar pencatatan pesanan sesuai dengan hasil transaksi. Sementara itu, pemberian ulasan perlu dibatasi berdasarkan kepemilikan dan penyelesaian pesanan agar setiap ulasan terhubung dengan pembelian yang tercatat.

Kebutuhan utama dalam alur tersebut adalah menjaga kesesuaian informasi antara pembeli dan pengelola. Harga dan ketersediaan produk dapat berubah sebelum pemesanan dikonfirmasi. Oleh karena itu, sistem perlu memeriksa kembali data produk, jumlah pembelian, serta stok pada saat checkout. Ringkasan biaya juga perlu memperlihatkan subtotal barang, potongan harga, ongkos kirim, dan total pembayaran agar pembeli dapat meninjaunya sebelum membuat pesanan. Data transaksi yang telah dikonfirmasi disimpan sebagai riwayat sehingga perubahan pada katalog tidak mengubah rincian pesanan sebelumnya.

Website Salvora Kitchen menyediakan katalog dan detail produk yang dapat diakses tanpa login. Untuk menggunakan keranjang dan melakukan pemesanan, pengunjung perlu masuk sebagai pembeli. Pembeli dapat mengelola alamat, memilih pengantaran atau pengambilan sendiri, serta melihat riwayat dan status pesanan. Pengantaran dibatasi pada Kota Tanjungpinang, Kepulauan Riau, dengan ongkos kirim Rp10.000 per pesanan. Pilihan ambil sendiri tersedia tanpa ongkos kirim, dengan pengambilan dilakukan setelah pesanan berstatus Siap diambil.

Selain alur pemesanan, website menerapkan voucher pembeli baru berupa diskon 20% dari subtotal barang dengan potongan maksimal Rp100.000. Voucher berlaku satu kali per akun yang memenuhi syarat dan tidak memotong ongkos kirim. Pembayaran diintegrasikan dengan Midtrans Snap pada lingkungan Sandbox untuk keperluan simulasi transaksi. Penentuan keberhasilan pembayaran dilakukan berdasarkan informasi yang diverifikasi oleh server, bukan berdasarkan unggahan bukti transfer atau persetujuan pembayaran secara manual oleh admin.

Pengelola toko menggunakan halaman admin untuk mengelola kategori, produk, foto produk, stok, dan pemenuhan pesanan. Halaman admin juga menyediakan ringkasan operasional, pemantauan pembayaran, dan informasi penggunaan voucher pembeli baru. Setelah pesanan selesai, pembeli dapat memberikan rating dan ulasan terhadap item yang dibelinya. Pembatasan tersebut menghubungkan ulasan dengan riwayat pembelian yang tercatat dalam sistem.

Website dikembangkan menggunakan React melalui Next.js untuk antarmuka pengguna, serta fasilitas server Next.js untuk API dan logika aplikasi. Tailwind CSS dan komponen shadcn/ui digunakan dalam penyusunan tampilan, sedangkan PostgreSQL digunakan untuk penyimpanan data dengan bantuan Prisma. Melalui pengembangan ini, konsep pemrograman web diterapkan pada pengelolaan data, autentikasi, pembatasan hak akses, transaksi, dan integrasi layanan pembayaran. Laporan disusun dengan mengacu pada fitur yang telah diimplementasikan agar pembahasan sesuai dengan website yang dikembangkan.

## 1.2 Rumusan Masalah

Berdasarkan latar belakang tersebut, rumusan masalah dalam proyek ini adalah sebagai berikut.

1. Bagaimana mengimplementasikan penerbitan voucher pembeli baru secara otomatis, perhitungan diskon yang sesuai ketentuan, dan pembatasan penggunaannya satu kali per akun yang memenuhi syarat?
2. Bagaimana mengintegrasikan checkout dengan Midtrans Snap Sandbox serta memperbarui status pembayaran dan pesanan berdasarkan hasil verifikasi server?
3. Bagaimana memastikan rating dan ulasan hanya dapat diberikan oleh pembeli terhadap item pada pesanan miliknya yang telah selesai?
4. Bagaimana membangun basis data dan antarmuka website yang menghubungkan ketiga fitur tersebut dengan katalog, keranjang, pilihan penerimaan pesanan, serta fasilitas pengelolaan admin sesuai hak aksesnya?

## 1.3 Tujuan

Tujuan pengembangan website e-commerce Salvora Kitchen adalah sebagai berikut.

1. Mengimplementasikan voucher otomatis bagi pembeli baru yang memenuhi syarat, dengan potongan 20% dari subtotal barang, maksimal Rp100.000, dan penggunaan satu kali per akun.
2. Mengintegrasikan checkout dan Midtrans Snap Sandbox untuk meninjau biaya, membuat pesanan, memproses simulasi pembayaran, serta mencatat perubahan status berdasarkan verifikasi server.
3. Mengimplementasikan rating dan ulasan berdasarkan kepemilikan item pesanan yang telah selesai, dengan pembatasan satu ulasan untuk setiap item pesanan.
4. Membangun basis data dan antarmuka yang mendukung ketiga fitur inti beserta katalog publik, keranjang, alamat atau kontak pengambilan, riwayat pesanan, serta pengelolaan kategori, produk, stok, dan pemenuhan pesanan oleh admin.

## 1.4 Manfaat

### 1.4.1 Bagi Pembeli

Website menyediakan sarana untuk melihat informasi produk, memilih camilan, mengatur jumlah pembelian, dan meninjau biaya dalam satu alur pemesanan. Pembeli dapat memilih pengantaran sesuai wilayah layanan atau pengambilan sendiri, melihat status pesanan, serta memberikan ulasan setelah pesanan selesai. Informasi voucher dan rincian biaya membantu pembeli memahami total yang perlu dibayarkan pada simulasi transaksi.

### 1.4.2 Bagi Pengelola Salvora Kitchen

Website menyediakan sarana pengelolaan kategori, produk, foto, dan stok yang terhubung dengan katalog pelanggan. Daftar pesanan dan rincian pembayaran membantu pengelola memeriksa transaksi serta mencatat perkembangan pemenuhan pesanan. Ringkasan operasional dan informasi voucher dapat digunakan sebagai bahan pemantauan aktivitas yang tercatat di dalam aplikasi.

### 1.4.3 Bagi Tim Pengembang

Proyek ini menjadi sarana penerapan materi Pemrograman Web, khususnya pengembangan antarmuka berbasis komponen, pengolahan data melalui API, penggunaan basis data relasional, autentikasi, otorisasi, dan integrasi layanan eksternal. Pengembangan juga memberikan pengalaman dalam menjaga konsistensi data antara keranjang, pesanan, stok, voucher, dan pembayaran, serta menyelaraskan dokumentasi dengan implementasi.

## 1.5 Batasan Masalah

Agar pembahasan sesuai dengan implementasi website, batasan masalah proyek ditetapkan sebagai berikut.

1. **Objek dan model layanan.** Sistem merupakan website e-commerce untuk satu toko, yaitu Salvora Kitchen, dengan model B2C dan kategori awal risol serta cookies. Sistem tidak menyediakan fasilitas marketplace bagi banyak penjual.

2. **Pengguna dan akses.** Sistem memiliki dua peran akun, yaitu pembeli dan admin. Pengunjung tanpa akun dapat mengakses beranda, katalog, detail produk, dan ulasan publik. Keranjang, alamat, checkout, pembayaran, riwayat pesanan, dan pengiriman ulasan memerlukan akun pembeli. Registrasi publik menghasilkan akun pembeli, sedangkan akun admin disediakan melalui mekanisme internal.

3. **Katalog dan keranjang.** Katalog menyediakan filter kategori dan pembagian halaman; filter rasa tidak termasuk fitur yang diimplementasikan. Pembeli dapat menambahkan produk, mengubah jumlah, serta menghapus item keranjang. Harga dan ketersediaan diperiksa kembali pada proses checkout; penambahan ke keranjang belum mencadangkan stok.

4. **Voucher pembeli baru.** Voucher diterbitkan otomatis saat registrasi atau login bagi akun pembeli yang memenuhi syarat dan belum memiliki voucher. Login ulang tidak menerbitkan voucher tambahan atau mengembalikan voucher yang telah digunakan. Potongan sebesar 20% dihitung dari subtotal seluruh barang, dibulatkan ke bawah ke Rupiah penuh, dan dibatasi maksimal Rp100.000. Voucher digunakan satu kali per akun, tidak memotong ongkos kirim, dan tidak mencakup pengelolaan promosi umum dengan aturan yang dapat diubah oleh admin.

5. **Penerimaan pesanan.** Pembeli dapat memilih pengantaran manual atau ambil sendiri. Pengantaran hanya melayani Kota Tanjungpinang, Kepulauan Riau, dengan ongkos kirim tetap Rp10.000 per pesanan. Pengambilan sendiri tidak dikenai ongkos kirim dan menggunakan nama serta nomor telepon pengambil. Lokasi dan waktu pengambilan dikonfirmasikan dengan toko di luar mekanisme penjadwalan aplikasi. Sistem tidak terintegrasi dengan ekspedisi atau pelacakan lokasi kurir secara langsung.

6. **Checkout dan pembayaran.** Ringkasan biaya dihitung oleh server dan ditinjau pembeli sebelum pesanan dikonfirmasi. Batas waktu pembayaran adalah 60 menit sejak pesanan dibuat. Pembayaran menggunakan Midtrans Snap Sandbox untuk simulasi, tanpa perpindahan uang sungguhan. Sistem tidak menyediakan COD, unggah bukti transfer, atau persetujuan pembayaran manual oleh admin. Ketersediaan kanal pembayaran mengikuti konfigurasi layanan Sandbox.

7. **Stok dan pencatatan transaksi.** Stok dicadangkan saat pesanan berhasil dibuat dan pemrosesan stok serta voucher mengikuti hasil verifikasi pembayaran. Rincian barang, harga, biaya, dan data penerima disimpan pada pesanan agar riwayat tetap terjaga ketika data katalog atau alamat berubah. Status pembayaran dibedakan dari status pemenuhan pesanan.

8. **Pemenuhan pesanan.** Admin mencatat perkembangan pesanan yang pembayarannya telah memenuhi ketentuan sistem. Pesanan yang diantar mengikuti tahap Diproses, Sedang diantar, dan Selesai. Pesanan ambil sendiri mengikuti tahap Diproses, Siap diambil, dan Selesai. Penetapan status Selesai membutuhkan konfirmasi penerimaan atau pengambilan secara manual oleh admin beserta catatan; aplikasi tidak menyelesaikan pesanan secara otomatis hanya karena pembayaran berhasil.

9. **Rating dan ulasan.** Ulasan diberikan oleh pembeli terhadap item pada pesanan miliknya yang berstatus Selesai. Setiap item pesanan hanya dapat memperoleh satu ulasan dengan rating bilangan bulat 1–5 dan komentar sepanjang 10–1.000 karakter setelah spasi di awal dan akhir dibersihkan. Pembahasan tidak mencakup moderasi, pengubahan, atau penghapusan ulasan oleh pengguna.

10. **Fasilitas admin.** Cakupan pengelolaan meliputi kategori, produk, foto, stok, pesanan, catatan internal, pemantauan pembayaran, informasi voucher, dan perubahan nama tampilan akun admin sendiri. Dashboard berisi ringkasan pesanan dan kondisi stok, bukan laporan akuntansi, perhitungan laba, atau ekspor laporan keuangan.

11. **Fitur di luar cakupan.** Sistem tidak menyediakan penentuan alamat melalui pin peta, pengelolaan lokasi toko melalui peta, unggah foto profil pembeli, chat penjual, program afiliasi, maupun retur dan pengembalian dana otomatis. Fitur yang hanya tercantum dalam rancangan awal tidak diperlakukan sebagai fasilitas yang tersedia pada website.

12. **Teknologi dan lingkungan.** Implementasi menggunakan Next.js, React, Tailwind CSS, shadcn/ui, PostgreSQL, dan Prisma. Pembahasan berfokus pada website yang dikembangkan dalam proyek dan integrasi pembayaran Sandbox. Keberadaan fitur tidak dianggap sebagai bukti kesiapan operasional produksi atau kelulusan seluruh pengujian antarmuka. Data demonstrasi tidak diperlakukan sebagai bukti penjualan nyata.
