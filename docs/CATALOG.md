# Kategori, produk, stok dan foto — BE-04

Frontend admin FE-09 (25 Oktober 2026): /admin/kategori dan /admin/produk memakai kontrak ini tanpa mengubah service. Implementasi/unit/HTTP test lulus, penerimaan browser masih Ditinjau. Lihat [FE09-CATALOG-VERIFICATION.md](FE09-CATALOG-VERIFICATION.md) untuk perilaku upload, versi stok, isolasi/cleanup dan batas bukti.

Tanggal: 23 Oktober 2026. Acuan: **PRD 1.5**, FR-02/FR-09 dan BE-04. Pengguna menetapkan katalog/detail publik, stok menipis 1–5 unit tersedia, serta input foto JPEG/PNG/WebP maksimum 2.000.000 byte. Keranjang/transaksi tetap wajib login pada task berikutnya.

## Endpoint tersedia

| Operasi | Path dan perilaku |
|---|---|
| Katalog publik | `GET /api/categories`, `GET /api/products`, `GET /api/products/{productId}`; tanpa login, hanya kategori/produk aktif |
| Kategori admin | `GET/POST /api/admin/categories`, `PATCH/DELETE /api/admin/categories/{categoryId}`; write memerlukan ADMIN dan Origin valid |
| Produk admin | `GET/POST /api/admin/products`, `GET/PATCH /api/admin/products/{productId}`; termasuk produk nonaktif dan stok internal |
| Stok admin | `PUT /api/admin/products/{productId}/stock` dengan `{physicalStock,expectedUpdatedAt}` |
| Unggah | `POST /api/admin/product-photos`, multipart dengan tepat satu field `file`; ADMIN + Origin |
| Baca foto | `GET /api/product-photos/{photoId}`; binary WebP, publik hanya jika dipakai produk dan kategori aktif; admin dapat preview foto pending/nonaktif |

Seluruh respons JSON memakai envelope dan Cache-Control no-store. Baca foto adalah pengecualian binary yang disengaja: Content-Type image/webp, X-Content-Type-Options nosniff, Content-Disposition inline dengan nama tetap, no-store dan Vary Cookie. Error foto tetap envelope JSON. Tidak ada direktori uploads di public atau akses file berdasarkan nama/path yang dikirim client.

### Katalog dan data admin

DTO publik menampilkan id, kategori {id,name}, nama, deskripsi, harga, imageUrl nullable, isActive, isDemo, availableStock, availability, averageRating nullable, reviewCount. Tidak menampilkan physicalStock/reservedStock, photoKey, createdById, hash foto atau path storage. Admin juga mendapat physicalStock, reservedStock, photoId, createdAt/updatedAt. Produk tanpa ulasan menghasilkan averageRating null dan reviewCount 0; rata-rata dihitung dari Rating tersimpan lewat OrderItem, bukan angka seed/dummy. Pembuatan ulasan tetap BE-12.

Kategori berasal dari tabel yang sama untuk admin/pelanggan. productCount pelanggan hanya produk aktif pada kategori aktif yang terlihat; admin menghitung seluruh produk di kategori itu. Kategori nonaktif menyembunyikan produk di katalog tanpa mengubah flag isActive setiap produk. Produk aktif dengan stok habis tetap tampil. Produk/nonaktif kategori pada detail publik menghasilkan 404; admin masih dapat membacanya melalui jalur admin.

Pagination memakai page/pageSize (default 1/20, maksimum 100.000/100) dengan urutan nama ASC lalu id ASC. Count dan data dibaca pada transaksi REPEATABLE READ yang sama. Halaman kosong/out-of-range mengembalikan [] beserta total yang benar. Query berulang/tidak didukung ditolak 422.

- Publik: produk hanya menerima categoryId opsional; kategori hanya pagination. Pencarian/pengurutan lanjutan pelanggan tetap P1.
- Admin kategori: q (nama, maksimum 100 karakter), isActive=true/false, pagination.
- Admin produk: q, categoryId, isActive, availability=AVAILABLE/LOW/OUT_OF_STOCK, pagination. Pencarian produk adalah substring case-insensitive dengan wildcard `%`, `_`, dan backslash diperlakukan literal. Semua query SQL memakai parameter binding.

### Perubahan data

POST kategori meminta name (trim 1–100 karakter) dan isActive boolean. PATCH menerima subset nonkosong dari keduanya. Nama unik sesuai unique constraint yang ada; bentrok 409 RESOURCE_EXISTS. DELETE kategori terpakai ditolak 409 RESOURCE_IN_USE oleh FK; kategori kosong dapat dihapus dan missing menghasilkan 404. Tidak menghapus produk untuk memaksa penghapusan kategori.

POST produk meminta categoryId, name (trim 1–150), description (trim 1–5.000), price integer positif, physicalStock integer nonnegatif, isActive boolean, photoId opsional/null. Batas integer 2.147.483.647. Kategori/foto harus record tersimpan yang valid; ID tidak ada ditolak 422 pada field terkait. PATCH menerima subset nonkosong field metadata tersebut **tanpa physicalStock**. Stok diubah melalui PUT khusus. price/stock pecahan, negatif, overflow, field internal reservedStock/isDemo/photoKey/imageUrl atau path arbitrary ditolak.

Tidak ada DELETE produk rutin: gunakan isActive=false, termasuk produk yang sudah memiliki riwayat. Nama/harga/foto/status katalog dapat diubah tanpa mengubah snapshot OrderItem atau total/alamat order historis. Field foto yang tidak dikirim mempertahankan foto; photoId=null melepas referensi foto. imageUrl/photoKey diturunkan server dari metadata, bukan dipercayai dari browser.

Foto nullable mendukung seed/data yang masih dilengkapi selama pengembangan; frontend harus memberi keadaan gambar belum tersedia, bukan URL palsu. Lengkapi foto/data resmi sebelum penyerahan produk final sesuai PRD bagian 7; nama/harga demo tidak otomatis menjadi data operasional toko.

## Integritas stok

Stok tersedia = physicalStock − reservedStock. Status terpisah dari flag isActive:

| Stok tersedia | availability |
|---:|---|
| 0 | OUT_OF_STOCK |
| 1–5 | LOW |
| >=6 | AVAILABLE |

PUT stok mewajibkan expectedUpdatedAt dari pembacaan admin terakhir. UPDATE atomik hanya berhasil jika versi masih sama dan physicalStock baru >= reservedStock. Timestamp versi dibuat meningkat minimal 1 ms, termasuk dua edit pada milidetik yang sama. Versi berubah menghasilkan 409 RESOURCE_VERSION_CONFLICT; stok kurang dari reservasi menghasilkan 409 STOCK_RESERVED; missing menghasilkan 404. Frontend harus muat ulang untuk konflik, bukan mengulangi secara buta dengan nilai lama.

Update metadata memakai lock baris dan juga menaikkan versi. CHECK DB tetap menjaga 0 <= reservedStock <= physicalStock. BE-07 wajib memperbarui counter/StockReservation secara atomik serta versi produk pada reservasi, pembayaran dan pelepasan. BE-04 menguji lantai reservasi dan dua edit bersamaan, tetapi belum membuktikan workflow checkout/reservasi BE-07 tersedia. Stok habis ditolak dari keranjang ketika BE-05 dibuat; katalog hanya menampilkan ketersediaannya.

## Unggahan dan penyimpanan foto

Dipilih **adapter filesystem privat persisten untuk lokal**:

- Development: `.local/uploads/product-photos` di workspace, diabaikan Git.
- Test: `.local/uploads/product-photos-test` (suite service memakai subfolder fixture UUID); tidak memakai file dev.
- Production: wajib PRODUCT_PHOTO_STORAGE_DIR **absolute**, di luar public, pada volume persisten; wajib PRODUCT_PHOTO_STORAGE_PERSISTENT=true. Tanpa konfigurasi tersebut, upload/read foto gagal aman 503 PHOTO_STORAGE_NOT_CONFIGURED. Tidak ada default production ke filesystem sementara.

Pemilihan volume/hosting atau adapter object storage untuk deployment masih harus dilakukan sebelum demo hosting unggahan diterima. Memasang env flag bukan bukti bahwa volume provider benar-benar persisten. Upload lokal sudah dapat dipakai tanpa akun/provider eksternal. Konfigurasi path adalah input operator server, tidak pernah body user.

Alur upload:

1. Validasi sesi ADMIN dan Origin sebelum membaca file. Body multipart dibatasi pada byte stream aktual hingga 2.000.000 + 65.536 byte overhead; bukan hanya header Content-Length. Tolak field tambahan/duplikat; file sendiri maksimum 2.000.000 byte.
2. Cocokkan MIME JPEG/PNG/WebP dengan format isi, decode penuh memakai **sharp 0.35.5**, reject rusak/animasi/dimensi >20 juta piksel. Nama dan ekstensi file pengguna tidak menentukan path atau format.
3. Terapkan orientasi foto, buang metadata melalui encode WebP quality 85, dan periksa output tetap <=2.000.000 byte. Batas piksel adalah pembatas resource teknis; tidak menambah tipe produk/fitur bisnis.
4. Simpan key UUID buatan server (`<uuid>.webp`) dengan write exclusive. Tabel ProductPhoto menyimpan key, contentType, ukuran, dimensi, sha256 dan pembuat; return hanya photoId dan URL aplikasi. Gagal menyimpan metadata DB mencoba membuang hanya file baru yang dibuatnya.
5. Foto pending dapat dipreview admin. Saat photoId dipasang pada produk/kategori aktif, publik dapat mengaksesnya. Setelah dilepas atau produk/kategori nonaktif, akses publik foto menjadi 404; admin masih bisa preview. ID/key invalid tidak dapat menjadi path traversal.

Sumber teknis: [sharp constructor/pixel limits](https://sharp.pixelplumbing.com/api-constructor/) dan [output/metadata](https://sharp.pixelplumbing.com/api-output/). Ukuran file, isi/MIME dan akses diuji secara lokal; bukan pemindaian malware atau bukti deployment hosting.

Tidak ada penghapusan foto otomatis saat foto produk diganti: file dapat masih direferensikan produk lain atau perlu dipertahankan. Crash antara file write dan insert DB dapat menyisakan orphan, meskipun kegagalan normal diuji cleanup-nya. Garbage collection/retensi harus memeriksa referensi dan umur upload, bukan menghapus seluruh folder; job tersebut belum dibuat. Tidak ada unggahan avatar/CMS.

## Migrasi, backup dan hasil verifikasi

Migrasi tambahan `202610230002_product_photos` hanya menambah ProductPhoto, Product.photoId nullable, indeks, FK dan CHECK metadata foto. Kolom imageUrl/photoKey lama dipertahankan; tidak menghapus data. Berlaku pada dev/test Salvora melalui migrate deploy. Model ProductPhoto adalah metadata aset FR-09, bukan modul P1 baru. Migrasi BE-02 tidak diedit.

Backup foto harus menyertai backup PostgreSQL: **pg_dump saja tidak membawa file foto**. Cadangkan DB dan volume upload privat dengan referensi key tetap sama; pertahankan checksum/metadata. Pulihkan DB serta file ke volume privat yang ditetapkan, lalu periksa akses, jumlah/key dan sha256 sebelum menerima deployment. Bila snapshot konsisten tidak tersedia, hentikan sementara mutation upload/katalog saat membuat pasangan backup. Retensi/restore volume hosting belum diuji atau dijadwalkan melalui BE-04.

```powershell
npm.cmd run db:local
npm.cmd run db:generate
npm.cmd run db:migrate
npm.cmd test
npm.cmd run test:db
npm.cmd run build
npm.cmd run test:http:catalog
```

Bukti aktual BE-04: 28 tes unit/fondasi + 31 tes PostgreSQL, lint/typecheck dan production build lulus; HTTP katalog/foto, HTTP auth dan smoke fondasi lulus. HTTP katalog memakai fixture baru pada test DB dengan secret/cookie sendiri dan direktori test. Akun/produk/kategori/order/foto fixture dibersihkan secara spesifik, tanpa reset/drop database, recursive delete folder, atau membaca kredensial admin pribadi.

Cakupan tes meliputi publik/aktif/habis, rating aktual/kosong, count/pagination/filter, validasi dan peran/Origin, FK kategori, snapshot pesanan, stok di bawah reservasi dan konflik versi bersamaan, format foto/byte body/MIME korup/path, file pending/publik serta cleanup kegagalan metadata. Audit dependensi runtime melaporkan 0 kerentanan; temuan tooling dev lama tetap tercatat pada DECISIONS. Kesesuaian UI Figma, upload pada volume hosting, target performa, checkout/stok BE-07 dan ulasan BE-12 tetap membutuhkan verifikasi task berikutnya.
