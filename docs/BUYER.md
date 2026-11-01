# Alamat dan keranjang — BE-05

Mengacu pada PRD 1.5 FR-03/FR-04 dan [kontrak API v0.4](API-CONTRACT.md). Backend tersedia; UI pemilihan alamat dan keranjang belum dibuat.

## Akses dan alamat

Seluruh endpoint hanya untuk BUYER dari sesi server. Anonymous 401, admin 403. Mutasi wajib Origin sama dengan URL aplikasi. Payload strict menolak userId, cartId, harga dan field tambahan. Respons sukses/error no-store dan Vary Cookie. ID alamat/item asing dan tidak ditemukan sama-sama 404, tanpa mengungkap pemilik.

GET /api/addresses memberi daftar milik sendiri dengan pagination. POST membuat alamat, PATCH mengubah subset nonkosong, DELETE menerima JSON `{}` dan mengembalikan null. Pemilihan alamat dilakukan frontend dari daftar ini; validasi ulang addressId serta penyalinan snapshot saat checkout adalah BE-07.

Alamat wajib recipientName 1–100, phone 6–32 karakter (angka, spasi, kurung, tanda hubung, + opsional di awal), addressLine 1–2.000, city/province 1–100. Semua teks di-trim dan menolak NUL. postalCode opsional/null, jika diisi 1–16; notes opsional/null, jika diisi 1–1.000. PATCH null mengosongkan field opsional. Tidak menetapkan wilayah layanan atau mewajibkan kode pos sebelum O-02 diputuskan. Tidak memverifikasi nomor telepon atau menyimpulkan bahwa alamat pasti dapat dilayani.

Alamat hidup tidak direferensikan order; order menyimpan snapshot tersendiri. Uji PostgreSQL membuat order fixture dengan salinan alamat, mengubah/menghapus alamat melalui layanan, lalu memastikan snapshot tetap sama. Ini membuktikan isolasi snapshot, belum membuktikan endpoint checkout yang belum tersedia.

## Keranjang

GET /api/cart hanya membaca. Sebelum mutasi pertama: `{id:null,items:[],subtotal:0}`; keranjang persisten dibuat atomik saat penambahan pertama berhasil. Setelah item terakhir dihapus, id keranjang tetap ada, items kosong dan subtotal 0. Tidak ada reservasi atau perubahan physicalStock/reservedStock dari operasi keranjang.

POST /api/cart/items menerima productId dan quantity integer positif <=2.147.483.647, menambahkan jumlah ke baris produk yang sama, respons 201 Cart. PATCH item menerima quantity absolut. Transaksi mengunci baris User milik pembeli sebelum membuat/mengubah cart, sehingga penambahan pertama bersamaan tidak menciptakan cart ganda atau kehilangan penambahan. Unique cart.userId dan cartId/productId dari BE-02 tetap digunakan. Pemeriksaan produk/kategori/stok memakai shared row lock sampai commit; pembeli lain tetap dapat memasukkan produk sama ke keranjang. Ini bukan jaminan memperoleh stok saat checkout.

Penambahan/perubahan menolak produk/kategori nonaktif (409 PRODUCT_UNAVAILABLE), referensi produk tidak ditemukan (404), atau jumlah akhir melebihi physicalStock-reservedStock (409 INSUFFICIENT_STOCK). Jumlah nol/negatif/pecahan/string ditolak 422, bukan perintah hapus. GET memakai nama, foto, harga, serta stok terkini; item yang sudah tidak tersedia tetap tampil dengan isAvailable=false. isAvailable juga false jika jumlah tersimpan melebihi stok tersedia. Field tersebut tidak menjamin ketersediaan di masa berikutnya. Tidak ada harga lama tersimpan pada CartItem, sehingga frontend harus menampilkan nilai terkini; perbandingan quote dan konfirmasi harga menyusul BE-07.

Aritmetika perkalian/penjumlahan memakai BigInt dan dikonversi ke number hanya dalam batas INTEGER Rupiah 2.147.483.647. Mutasi yang melampaui subtotal baris/keranjang di-rollback dengan 409 CART_TOTAL_LIMIT. Jika kenaikan harga kemudian membuat keranjang lama melewati batas, GET juga mengembalikan kode tersebut. Pembeli dapat menurunkan jumlah hingga seluruh subtotal valid atau menghapus item yang diketahui dari tampilan sebelumnya.

DELETE /api/cart/items/{cartItemId} menerima `{}` dan mengembalikan 200 `data:null`; frontend kemudian GET keranjang. Kontrak v0.4 menyelaraskan ini dengan pola delete umum dan memungkinkan penghapusan tetap berhasil saat subtotal barang tersisa melewati batas akibat kenaikan harga. Produk nonaktif/habis tetap dapat dihapus. Kegagalan validasi item tidak menghapus data apa pun.

## Bukti dan serah terima

Tidak ada migrasi, dependensi paket baru, atau konfigurasi baru. Dev/test tetap database khusus Salvora, tanpa fallback LanggananKu. Tidak ada salinan akun/sesi lama, perubahan kode/database LanggananKu, ongkir, pickup, voucher atau pembayaran baru.

Perintah verifikasi:

```powershell
npm.cmd test
npm.cmd run test:db
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:http:buyer
npm.cmd run test:http
```

Hasil aktual: 31 tes unit/fondasi dan 41 tes PostgreSQL lulus, lint/typecheck/build serta HTTP pembeli dan smoke fondasi lulus. Tes BE-05 mencakup ownership, snapshot, pagination/DTO, penambahan bersamaan, stok setelah reservasi, harga terkini, nonaktif/habis, nominal/rollback/penghapusan, sesi/role/Origin serta header privat. Skrip HTTP menjalankan hasil build dengan akun/secret acak, database test dan server sementara; fixture spesifik dibersihkan. Tes lokal ini belum membuktikan UI/browser, TLS hosting, kapasitas produksi atau alur checkout/pembayaran.

BE-06 dapat mengisi hook voucher yang sudah ada. BE-07 wajib menolak keranjang kosong, memvalidasi ulang pemilik alamat/produk/harga/stok, menetapkan urutan lock konsisten (termasuk User sebelum memutasi cart), serta menyalin snapshot dan membuat reservasi atomik. Keputusan ongkir/wilayah dan expiry tetap menjadi gerbang task terkait, bukan diisi diam-diam pada BE-05.
