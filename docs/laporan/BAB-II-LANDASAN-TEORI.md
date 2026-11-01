# BAB II
# LANDASAN TEORI

## 2.1 E-Commerce

### 2.1.1 Pengertian E-Commerce

E-commerce merupakan kegiatan penjualan atau pembelian barang dan jasa melalui jaringan komputer dengan metode yang dirancang untuk menerima atau menempatkan pesanan. Penentuan transaksi sebagai e-commerce terutama berkaitan dengan cara pemesanannya; pembayaran dan penyerahan barang tidak harus berlangsung secara daring. Pengertian ini memungkinkan pemesanan melalui website disertai pengantaran barang atau pengambilan langsung oleh pembeli. ([OECD, *Understanding E-Commerce*](https://www.oecd.org/en/publications/unpacking-e-commerce_23561431-en/full-report/component-5.html))

Salvora Kitchen menerapkan pemesanan camilan melalui website. Pembeli memilih produk, menentukan jumlah, meninjau biaya, dan membuat pesanan melalui aplikasi. Penerimaan barang dapat dilakukan melalui pengantaran manual atau pengambilan sendiri. Pembayaran pada proyek menggunakan lingkungan simulasi, sehingga transaksi yang dibahas merupakan transaksi pengujian aplikasi.

### 2.1.2 Model Business-to-Consumer

Business-to-Consumer (B2C) menggambarkan hubungan penjualan dari pelaku usaha kepada konsumen akhir. Pada proyek ini, model B2C diwujudkan melalui satu toko, yaitu Salvora Kitchen, yang mengelola katalog dan menerima pesanan pembeli. Admin bertindak sebagai pengelola toko, sedangkan pembeli menggunakan fasilitas pemesanan. Aplikasi tidak menyediakan pendaftaran toko atau penjualan oleh banyak penjual.

### 2.1.3 Komponen E-Commerce pada Proyek

Komponen website Salvora Kitchen saling terhubung untuk mendukung proses belanja.

| Komponen | Fungsi dalam aplikasi |
|---|---|
| Katalog | Menampilkan kategori, produk, harga, ketersediaan, dan detail produk |
| Keranjang | Menyimpan pilihan produk dan jumlah sebelum pemesanan |
| Checkout | Memvalidasi pilihan pembeli dan menyajikan rincian biaya sebelum konfirmasi |
| Pembayaran | Memproses simulasi pembayaran dan mencatat status terverifikasi |
| Pengelolaan pesanan | Menyimpan riwayat serta perkembangan pemenuhan pesanan |
| Rating dan ulasan | Menampung penilaian pembeli atas item pesanan yang telah selesai |

Keterhubungan tersebut menjadi dasar tiga fitur inti proyek, yaitu voucher pembeli baru, checkout dan pembayaran terintegrasi, serta ulasan berdasarkan pembelian selesai.

## 2.2 Aplikasi Web dan Arsitektur Client-Server

### 2.2.1 Komunikasi Client-Server

Aplikasi web diakses melalui browser sebagai client yang berkomunikasi dengan server. HTTP mengatur pertukaran pesan berupa permintaan (*request*) dan tanggapan (*response*). Client meminta suatu sumber daya atau mengirim data, kemudian server memberikan respons yang memuat hasil pemrosesan. ([MDN, *Overview of HTTP*](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview))

Pada Salvora Kitchen, browser menampilkan katalog dan formulir, sedangkan server memeriksa sesi, hak akses, harga, stok, dan aturan transaksi. PostgreSQL menyimpan data aplikasi. Browser tidak menentukan sendiri harga final atau keberhasilan pembayaran; masukan pengguna diperiksa kembali pada server sebelum menghasilkan perubahan data.

### 2.2.2 React dan Komponen Antarmuka

React menyusun antarmuka dari komponen yang memiliki tampilan dan logika. Data dapat diteruskan antarkomponen melalui *props*, sementara *state* merepresentasikan keadaan yang memengaruhi tampilan. Interaksi pengguna ditangani melalui kejadian, seperti perubahan masukan dan penekanan tombol. ([React, *Quick Start*](https://react.dev/learn))

Dalam proyek, komponen digunakan untuk kartu produk, formulir, keranjang, ringkasan checkout, dan halaman admin. Komponen bersama membantu menjaga konsistensi tombol, label status, dialog, serta tampilan ketika data sedang dimuat atau tidak tersedia.

### 2.2.3 Next.js dan Route Handlers

Next.js menyediakan kerangka pengembangan aplikasi React dengan App Router. Server Components mendukung pekerjaan pada sisi server, sedangkan Client Components digunakan ketika antarmuka memerlukan interaksi, state, atau API browser. Pembagian ini membantu menempatkan pekerjaan sesuai lingkungan eksekusinya. ([Next.js, *Server and Client Components*](https://nextjs.org/docs/app/getting-started/server-and-client-components))

Route Handlers memungkinkan pengembang menangani permintaan HTTP pada suatu rute melalui berkas `route.ts` atau `route.js`. Fasilitas ini digunakan untuk membentuk endpoint aplikasi. ([Next.js, *Route Handlers*](https://nextjs.org/docs/app/getting-started/route-handlers))

Salvora Kitchen menempatkan frontend dan backend dalam satu proyek Next.js. Halaman dan komponen menyusun antarmuka, Route Handlers menerima permintaan API, layanan memproses aturan bisnis, dan lapisan akses data berkomunikasi dengan PostgreSQL. Uraian arsitektur proyek mengikuti pemisahan tersebut tanpa mengasumsikan bahwa aplikasi menggunakan susunan MVC klasik.

### 2.2.4 API dan Pertukaran Data

Application Programming Interface (API) menyediakan antarmuka bagi komponen perangkat lunak untuk berkomunikasi. API internal Salvora Kitchen menggunakan HTTP dan pertukaran data JSON untuk sebagian besar operasi, seperti membaca produk, mengubah keranjang, dan membuat pesanan. Unggahan foto produk menggunakan pengiriman berkas.

Pemisahan API dari tampilan memungkinkan server menerapkan aturan yang sama meskipun permintaan berasal dari halaman berbeda. Sebagai contoh, penambahan produk dari katalog maupun halaman detail tetap melalui validasi produk dan stok pada layanan keranjang.

## 2.3 Autentikasi, Otorisasi, dan Manajemen Sesi

### 2.3.1 Autentikasi dan Penyimpanan Kata Sandi

Autentikasi merupakan pemeriksaan identitas pengguna. Pada proyek ini, pengguna memasukkan email dan kata sandi. Kata sandi disimpan dalam bentuk hash menggunakan bcrypt melalui pustaka bcryptjs. Ketika login, masukan dibandingkan dengan hash yang tersimpan.

Hash kata sandi merupakan hasil transformasi satu arah, berbeda dari enkripsi yang dirancang untuk dapat dibalik menggunakan kunci. Penyimpanan hash membantu melindungi kata sandi asli, tetapi tidak berarti seluruh risiko keamanan akun telah dihilangkan. ([OWASP, *Password Storage Cheat Sheet*](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html))

### 2.3.2 Otorisasi Berdasarkan Peran dan Kepemilikan

Otorisasi menentukan apakah pengguna boleh menjalankan suatu tindakan atau mengakses data tertentu. Pemeriksaan izin perlu dilakukan pada setiap permintaan yang memerlukan perlindungan, bukan hanya melalui penyembunyian menu pada antarmuka. ([OWASP, *Authorization Cheat Sheet*](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html))

Salvora Kitchen menggunakan peran pembeli dan admin. Pembeli mengelola keranjang, alamat, pesanan, pembayaran, dan ulasannya sendiri. Admin mengelola katalog dan pemenuhan pesanan serta memantau transaksi. Selain peran, server memeriksa kepemilikan data agar seorang pembeli tidak mengakses atau mengubah pesanan pembeli lain.

### 2.3.3 Manajemen Sesi

Sesi menghubungkan permintaan pengguna dengan identitas yang telah diautentikasi. Pengelolaan sesi mencakup pembuatan identitas sesi, pengiriman melalui cookie, pembatasan masa berlaku, dan pencabutan saat logout. Atribut cookie seperti `HttpOnly`, `Secure`, dan `SameSite` membantu membatasi cara cookie diakses atau dikirim. ([OWASP, *Session Management Cheat Sheet*](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html))

Implementasi Salvora Kitchen menggunakan token sesi acak. Server menyimpan digest token bersama identitas pengguna dan waktu kedaluwarsa, lalu memeriksa sesi pada permintaan berikutnya. Login merotasi sesi yang digantikan, sedangkan logout mencabut sesi. Pembuatan sesi saat registrasi atau login juga menjalankan pemeriksaan kelayakan voucher pembeli baru.

## 2.4 Voucher Diskon dan Perhitungan Transaksi

### 2.4.1 Voucher Pembeli Baru

Voucher merupakan hak memperoleh potongan harga berdasarkan ketentuan tertentu. Dalam Salvora Kitchen, voucher pembeli baru adalah aturan bisnis khusus proyek, bukan ketentuan umum seluruh website e-commerce. Voucher diterbitkan otomatis bagi akun pembeli yang memenuhi syarat dan belum memiliki voucher.

Kelayakan tidak hanya didasarkan pada jumlah login. Sistem memeriksa penanda pembelian pertama serta riwayat pembayaran yang relevan. Login ulang tidak menghasilkan voucher tambahan dan tidak mengembalikan hak pembelian pertama setelah voucher digunakan.

### 2.4.2 Rumus Subtotal, Diskon, dan Total Pembayaran

Perhitungan biaya pada proyek menggunakan Rupiah dalam bilangan bulat. Misalkan `hᵢ` adalah harga satuan barang ke-i, `qᵢ` adalah jumlah barang, `S` adalah subtotal seluruh barang, `D` adalah diskon, dan `O` adalah ongkos kirim. Aturan perhitungannya adalah:

```text
S = Σ(hᵢ × qᵢ)

D = min(floor(20% × S), 100.000), jika voucher memenuhi syarat
D = 0, jika tidak ada voucher yang memenuhi syarat

Total pembayaran = S − D + O
```

Fungsi `floor` menyatakan pembulatan ke bawah. Diskon dihitung sekali dari subtotal seluruh barang, tidak dihitung per item dan tidak mencakup ongkos kirim. Pengantaran manual dalam wilayah layanan dikenai ongkir Rp10.000, sedangkan ambil sendiri berongkir Rp0. Rumus dan nominal ini merupakan kebijakan implementasi Salvora Kitchen.

| Subtotal barang | Diskon yang berlaku | Ongkir | Total pembayaran |
|---|---|---|---|
| Rp50.000 | Rp10.000 | Rp10.000 | Rp50.000 |
| Rp50.000 | Rp10.000 | Rp0 | Rp40.000 |
| Rp800.000 | Rp100.000 | Rp10.000 | Rp710.000 |
| Rp50.000 tanpa voucher | Rp0 | Rp10.000 | Rp60.000 |

Angka pada tabel merupakan contoh perhitungan, bukan data penjualan toko.

### 2.4.3 Pengendalian Penggunaan Voucher

Sistem membedakan voucher tersedia, dicadangkan, dan telah digunakan. Pencadangan mengikat voucher pada pesanan yang sedang menunggu penyelesaian pembayaran. Voucher dinyatakan digunakan setelah pembayaran berhasil diverifikasi dan diterapkan pada pesanan.

Pembedaan tersebut membantu mencegah voucher yang sama dipakai pada beberapa pesanan aktif. Jika pembayaran tidak dapat dilanjutkan, pelepasan reservasi mengikuti pemeriksaan seluruh percobaan pembayaran. Kegagalan satu percobaan tidak otomatis membuktikan bahwa semua percobaan pada pesanan tersebut telah berakhir.

## 2.5 Checkout dan Pembayaran melalui Midtrans Snap Sandbox

### 2.5.1 Checkout dan Peninjauan Pesanan

Checkout merupakan tahap pemeriksaan akhir sebelum pembeli membuat pesanan. Dalam proyek ini, server memeriksa isi keranjang, ketersediaan produk, stok, kelayakan voucher, serta alamat pengantaran atau kontak pengambilan. Server kemudian menyediakan ringkasan biaya untuk ditinjau pembeli.

Ringkasan tersebut disebut *quote*. Quote memiliki masa berlaku dan belum mencadangkan stok. Ketika pembeli mengonfirmasi, server memeriksa kembali data untuk memastikan ringkasan masih sesuai. Pesanan yang berhasil dibuat menyimpan rincian transaksi dan mencadangkan stok. Dengan demikian, melihat ringkasan checkout dibedakan dari keberhasilan pembuatan pesanan.

### 2.5.2 Payment Gateway dan Midtrans Snap

Payment gateway menjadi penghubung aplikasi toko dengan layanan pemrosesan pembayaran. Pada integrasi Snap, backend memperoleh token transaksi, frontend menampilkan halaman pembayaran, pembeli mengikuti proses pembayaran, dan backend menangani pembaruan status. ([Midtrans, *Integration Guide*](https://docs.midtrans.com/docs/snap-snap-integration-guide))

Salvora Kitchen berkomunikasi dengan Midtrans, bukan mengintegrasikan API setiap bank secara langsung. Nominal pembayaran berasal dari rincian pesanan yang disimpan server. Lingkungan yang digunakan adalah Sandbox untuk menguji integrasi tanpa transaksi uang sungguhan. Ketersediaan pilihan pembayaran mengikuti konfigurasi layanan Sandbox; aplikasi tidak menganggap seluruh kanal otomatis tersedia.

### 2.5.3 Webhook dan Verifikasi Status

Webhook merupakan notifikasi HTTP yang dikirim layanan eksternal ke server aplikasi ketika status transaksi berubah. Midtrans mendokumentasikan pemeriksaan keaslian notifikasi dan pengambilan status transaksi melalui API sebagai bagian penanganan pembayaran. Notifikasi dapat diterima lebih dari sekali sehingga pemrosesannya perlu memperhatikan pengulangan. ([Midtrans, *HTTP(S) Notification / Webhooks*](https://docs.midtrans.com/docs/https-notification-webhooks))

Dalam implementasi proyek, server memverifikasi informasi pembayaran dan mencocokkannya dengan transaksi yang tercatat. Pengalihan browser ke halaman selesai tidak digunakan sebagai bukti tunggal pembayaran sukses. Pemeriksaan status melalui server juga digunakan untuk rekonsiliasi ketika hasil pembayaran belum dapat dipastikan. Admin memantau transaksi, tetapi tidak menyetujui pembayaran melalui unggahan bukti transfer.

### 2.5.4 Idempotensi dan Penanganan Pengulangan

Idempotensi pada proses bisnis berarti pengulangan permintaan yang sama tidak menimbulkan efek bisnis tambahan. Pada Salvora Kitchen, konfirmasi pesanan menggunakan kunci identifikasi permintaan agar pengiriman ulang setelah gangguan jaringan dapat mengembalikan pesanan yang sama.

Prinsip serupa diterapkan pada hasil pembayaran. Notifikasi berulang tidak boleh menggandakan pengurangan stok atau penggunaan voucher. Sistem menyimpan catatan pembayaran dan penerapannya untuk membedakan hasil yang baru diterima dari hasil yang telah diproses.

### 2.5.5 Status Pembayaran dan Status Pesanan

Status pembayaran menjelaskan keadaan transaksi keuangan, sedangkan status pesanan menjelaskan perkembangan pemenuhan barang. Keduanya memiliki tujuan berbeda. Pada aplikasi, pembayaran yang berhasil dan telah diterapkan memungkinkan pesanan diproses, tetapi tidak langsung menyatakan barang telah diterima pembeli.

| Aspek | Contoh keadaan pada aplikasi |
|---|---|
| Pembayaran | Menunggu, Belum Terkonfirmasi, Sukses, Gagal, Dibatalkan, Kedaluwarsa |
| Pesanan | Menunggu Pembayaran, Diproses, Sedang diantar, Siap diambil, Selesai, Kedaluwarsa, Perlu Penanganan |

Batas pembayaran ditetapkan 60 menit sejak pesanan dibuat. Tenggat yang terlewati tidak dengan sendirinya menjadi bukti bahwa pembayaran tidak mungkin berhasil; pelepasan stok dan voucher mengikuti verifikasi transaksi. Pesanan diantar atau diambil sendiri diselesaikan oleh admin setelah konfirmasi penerimaan atau pengambilan dicatat.

## 2.6 Rating dan Ulasan Berdasarkan Pembelian

### 2.6.1 Pengertian Rating dan Ulasan

Rating adalah penilaian numerik, sedangkan ulasan merupakan komentar tertulis pengguna terhadap produk. Pada Salvora Kitchen, keduanya dihubungkan dengan item pesanan yang telah selesai. Hubungan tersebut menjadi dasar pemeriksaan bahwa pengirim memiliki pembelian yang sesuai sebelum penilaiannya disimpan.

Validasi pembelian membuktikan keterkaitan ulasan dengan transaksi dalam aplikasi. Validasi ini tidak membuktikan bahwa isi pendapat pembeli selalu objektif atau benar, sehingga istilah ulasan terverifikasi merujuk pada pemeriksaan pembeliannya.

### 2.6.2 Validasi dan Pembatasan Ulasan

Aturan ulasan dalam proyek meliputi sesi pembeli yang valid, kepemilikan item pesanan, status pesanan Selesai, dan belum adanya ulasan pada item tersebut. Rating berupa bilangan bulat 1–5. Komentar harus sepanjang 10–1.000 karakter setelah spasi di awal dan akhir dibersihkan.

Kepemilikan ditelusuri melalui hubungan item pesanan, pesanan, dan pengguna. Satu item pesanan hanya memiliki satu ulasan, meskipun jumlah barang pada item tersebut lebih dari satu. Pembelian produk yang sama pada item dari pesanan lain dapat memperoleh ulasan tersendiri apabila memenuhi persyaratan. Ketentuan ini diterapkan pada server saat pengiriman ulasan.

## 2.7 Unified Modeling Language

Unified Modeling Language (UML) merupakan bahasa pemodelan untuk menjelaskan struktur dan perilaku sistem. UML membantu menyampaikan kebutuhan serta interaksi perangkat lunak melalui notasi yang terdefinisi. Acuan spesifikasinya diterbitkan oleh Object Management Group. ([OMG, *Unified Modeling Language 2.5.1*](https://www.omg.org/spec/UML/2.5.1))

### 2.7.1 Use Case Diagram

Use case diagram menjelaskan layanan sistem dari sudut pandang aktor. Aktor dapat berupa pengguna atau sistem eksternal. Relasi *include* menyatakan penyertaan perilaku use case lain, sedangkan *extend* menyatakan perluasan perilaku pada kondisi tertentu.

Untuk Salvora Kitchen, pemodelan perlu membedakan pengunjung, pembeli, admin, dan Midtrans sebagai layanan eksternal. Katalog publik tidak disamakan dengan transaksi yang memerlukan login. Fungsi pengelolaan admin juga dipisahkan dari tindakan pembeli.

### 2.7.2 Activity Diagram

Activity diagram menggambarkan aliran aktivitas, keputusan, serta awal dan akhir suatu proses. Pembagian *swimlane* menunjukkan pihak yang bertanggung jawab terhadap aktivitas.

Dalam proyek, diagram ini relevan untuk menjelaskan checkout, verifikasi pembayaran, pengelolaan produk atau pesanan, serta pemberian ulasan. Percabangan perlu mengikuti aturan yang tersedia, seperti pilihan diantar atau ambil sendiri dan pemeriksaan kelayakan ulasan.

### 2.7.3 Sequence Diagram

Sequence diagram menggambarkan urutan pertukaran pesan antarpeserta melalui *lifeline*. Fragmen seperti `alt` menunjukkan alternatif alur berdasarkan kondisi, sedangkan `opt` menunjukkan bagian interaksi yang dijalankan secara bersyarat.

Pemodelan pembayaran Salvora Kitchen perlu memperlihatkan interaksi pembeli, antarmuka, server, basis data, dan Midtrans. Notifikasi Midtrans ke server dibedakan dari pengalihan browser. Detail diagram disusun pada bab perancangan berdasarkan implementasi, sehingga diagram awal yang memuat verifikasi manual tidak menjadi dasar untuk mengklaim fitur tersebut tersedia.

## 2.8 Basis Data Relasional, PostgreSQL, dan Prisma

### 2.8.1 Basis Data dan Integritas Relasi

Basis data relasional menyusun data dalam tabel yang saling berhubungan. Primary key mengidentifikasi baris secara unik, sedangkan foreign key menghubungkan data dengan baris pada tabel yang dirujuk. Batasan `UNIQUE` mencegah duplikasi nilai tertentu dan `CHECK` membatasi nilai berdasarkan kondisi. PostgreSQL menyediakan batasan tersebut untuk menjaga integritas data. ([PostgreSQL, *Constraints*](https://www.postgresql.org/docs/18/ddl-constraints.html))

Pada Salvora Kitchen, hubungan pesanan dan produk dijembatani oleh item pesanan. Satu pesanan dapat berisi beberapa item, dan satu produk dapat muncul dalam banyak pesanan. Batasan unik digunakan antara lain untuk satu voucher per akun serta satu ulasan per item pesanan.

Relasi Antar Tabel (RAT) merupakan representasi struktur data dan hubungan antartabel yang digunakan dalam tugas proyek. RAT perlu memperlihatkan kunci, kardinalitas, dan hubungan sesuai skema aktual; keberadaannya dibedakan dari diagram perilaku UML.

### 2.8.2 Transaksi Basis Data

Transaksi basis data menggabungkan beberapa operasi menjadi satu kesatuan yang seluruhnya diterapkan atau dibatalkan. `COMMIT` menetapkan hasil transaksi, sedangkan `ROLLBACK` membatalkan perubahan yang belum disahkan. Prinsip ini menghindari penyimpanan hasil sebagian ketika salah satu langkah gagal. ([PostgreSQL, *Transactions*](https://www.postgresql.org/docs/current/tutorial-transactions.html))

Pembuatan pesanan pada proyek melibatkan penyimpanan item, pencadangan stok dan voucher, serta perubahan keranjang. Operasi tersebut perlu konsisten. Penguncian data dan pemeriksaan ulang juga digunakan ketika beberapa permintaan bersaing terhadap stok atau voucher yang sama.

### 2.8.3 Prisma dan Migrasi

Prisma ORM menyediakan akses basis data bagi aplikasi Node.js dan TypeScript. Prisma Client menyediakan antarmuka akses data dengan dukungan tipe, sedangkan Prisma Migrate mengelola perubahan skema melalui migrasi. ([Prisma, *Prisma ORM 7*](https://www.prisma.io/docs/orm/v7))

Salvora Kitchen menggunakan Prisma bersama PostgreSQL. Skema mendefinisikan model data dan relasinya, sedangkan migrasi mencatat perubahan struktur basis data. Penggunaan ORM tetap disertai validasi aturan bisnis pada layanan aplikasi; definisi relasi saja tidak menentukan apakah suatu pesanan boleh diselesaikan atau suatu ulasan boleh disimpan.

### 2.8.4 Snapshot Transaksi dan Reservasi Stok

Snapshot transaksi adalah salinan data yang disimpan pada saat transaksi dibuat. Dalam proyek, nama barang, harga satuan, jumlah, diskon, ongkir, dan informasi penerima disimpan pada pesanan. Perubahan harga produk atau alamat aktif tidak mengubah rincian historis tersebut.

Reservasi stok membedakan stok fisik dari jumlah yang sedang dicadangkan untuk pesanan. Aturan aplikasi menghitung stok tersedia sebagai berikut.

```text
Stok tersedia = stok fisik − stok yang dicadangkan
```

Pencadangan dilakukan ketika pesanan berhasil dibuat. Penambahan ke keranjang dan pembacaan quote belum mencadangkan stok. Pemrosesan pembayaran kemudian menentukan penerapan atau pelepasan reservasi sesuai hasil verifikasi. Pendekatan ini mendukung konsistensi ketersediaan ketika beberapa pembeli memesan produk yang sama.

## 2.9 Antarmuka Pengguna dan Desain Responsif

### 2.9.1 Antarmuka Pengguna

Antarmuka pengguna merupakan bagian aplikasi yang menampilkan informasi dan menerima tindakan pengguna. Pada Salvora Kitchen, antarmuka menghubungkan katalog, formulir akun, keranjang, checkout, pembayaran, dan pengelolaan admin.

Kebutuhan antarmuka proyek mencakup istilah yang konsisten, rincian biaya yang jelas, label status yang mudah dibedakan, dan umpan balik terhadap tindakan. Keadaan memuat data, data kosong, masukan tidak valid, serta kegagalan permintaan perlu ditampilkan agar pengguna mengetahui langkah yang dapat dilakukan. Nilai pada dashboard dan katalog berasal dari data aplikasi, bukan angka yang hanya terdapat pada mockup.

### 2.9.2 Tailwind CSS

Tailwind CSS menggunakan kelas utilitas untuk menyusun tampilan, seperti jarak, warna, ukuran, dan tata letak. Penggabungan utilitas memungkinkan gaya diterapkan pada elemen antarmuka. ([Tailwind CSS, *Styling with Utility Classes*](https://tailwindcss.com/docs/styling-with-utility-classes))

Fitur responsif Tailwind menerapkan variasi gaya pada breakpoint tertentu sehingga susunan tampilan dapat menyesuaikan ukuran layar. ([Tailwind CSS, *Responsive Design*](https://tailwindcss.com/docs/responsive-design))

Dalam proyek, Tailwind digunakan untuk tata letak katalog, formulir, dan halaman admin. Tema warna serta tipografi membentuk identitas visual Salvora Kitchen. Penggunaan kelas responsif merupakan bagian implementasi; kelayakan tampilan tetap perlu dibuktikan melalui pemeriksaan pada ukuran layar yang relevan.

### 2.9.3 shadcn/ui

shadcn/ui menyediakan komponen dengan kode sumber yang dapat dimiliki dan disesuaikan dalam proyek. Pendekatan ini memberi pengembang kendali terhadap tampilan serta perilaku komponen. ([shadcn/ui, *Introduction*](https://ui.shadcn.com/docs))

Salvora Kitchen menggunakan komponen tersebut untuk elemen seperti tombol, masukan, dialog, tabel, dan penanda status. Penyesuaian dilakukan agar komponen sesuai dengan kebutuhan formulir dan identitas toko. Ketersediaan komponen tidak otomatis membuktikan seluruh antarmuka telah lulus pengujian kegunaan atau aksesibilitas; hasil pengujian dibahas terpisah dari landasan teori.

---

Sumber daring pada bab ini diakses pada 1 November 2026. Uraian mengenai nominal diskon, ongkir, tenggat pembayaran, hak akses, dan pembatasan ulasan merupakan aturan implementasi Salvora Kitchen yang diselaraskan dengan Bab I, bukan aturan umum dari penyedia teknologi.
