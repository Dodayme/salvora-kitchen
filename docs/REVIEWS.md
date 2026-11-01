# BE-12 — Rating dan ulasan terverifikasi

Status terbaru 23 Oktober 2026: **Selesai untuk backend**. 19-suite PostgreSQL membuktikan unique/concurrent/rollback, owner/completed, repeat purchase, agregasi dan refund race; HTTP Next.js/cookie nyata membuktikan daftar publik/privasi serta role dan 201/409. Lihat [BE14-RECONCILIATION.md](BE14-RECONCILIATION.md). Catatan unit/mock dan gap pada bagian bukti awal di bawah bersifat historis. Acuan PRD 1.9 FR-11, kontrak 0.13; aturan 1–5, trim 10–1.000 dan satu ulasan per item tetap. Tidak ada moderasi/edit/hapus/testimoni P1.

## Kontrak endpoint

| Endpoint | Akses | Perilaku |
|---|---|---|
| POST /api/order-items/{orderItemId}/review | BUYER pemilik + sesi + Origin valid | JSON `{rating,comment}`, 201 Review |
| GET /api/products/{productId}/reviews | Publik, tanpa sesi | Review[] pada data; meta.pagination dan meta.ratingSummary |

Review hanya memuat `id, productId, rating, comment, author:{displayName}, createdAt`. Identitas publik berasal dari nama tampilan akun saat dibaca. Email, alamat, telepon, ID pemilik/pesanan/item, sesi dan data pembayaran tidak dimasukkan ke DTO. Komentar adalah teks bebas pembeli: frontend wajib merendernya sebagai teks, tidak memakai HTML mentah; pembeli tetap dapat mengetik informasi pribadi dalam komentarnya sendiri.

POST menolak field tambahan termasuk productId, userId, orderId dan author. Server menurunkan produk/pembeli dari relasi item → pesanan → akun. Rating harus number integer 1–5, bukan string. Komentar ditrim sebelum pengecekan 10–1.000 karakter; karakter kontrol selain tab/baris baru ditolak. **Koreksi dokumentasi 25 Oktober 2026:** Zod 4.6.7 terpasang menghitung Unicode code points pada min/max string, bukan unit UTF-16 seperti tertulis sebelumnya. FE-07 menyelaraskan penghitung UI dan membuktikan batas 9/1.000/1.001 emoji lewat HTTP; validator/backend tidak diubah. Tidak ada perkalian hak ulasan berdasarkan jumlah unit.

GET memakai pagination standar 1/20, maksimal 100 per halaman. Query duplikat/asing ditolak. Urutan createdAt menurun lalu id menurun. Produk atau kategori nonaktif/tidak ada menghasilkan 404 sesuai katalog publik. Produk tanpa ulasan menghasilkan data kosong, averageRating=null dan reviewCount=0. Halaman di luar hasil tetap kosong tanpa memindahkan halaman.

meta.ratingSummary `{averageRating,reviewCount}` mencakup semua ulasan produk, bukan hanya satu halaman. Daftar, jumlah dan rata-rata dibaca dalam satu transaksi RepeatableRead. Katalog BE-04 sudah menghitung rata-rata/count langsung dari Rating → OrderItem; tidak memerlukan cache maupun kolom rating tambahan. Tidak ada angka dummy atau pembulatan rating tersimpan.

## Pemeriksaan saat Submit

Service memeriksa sesi/peran, memvalidasi input, lalu melakukan lookup item yang dibatasi pemilik. Item asing/tidak ada menghasilkan 404. Di dalam transaksi, lock diperoleh berurutan User → Order seperti pemenuhan dan webhook; kepemilikan serta status item diperiksa ulang setelah lock. Hanya pesanan COMPLETED yang boleh disimpan. Data create hanya orderItemId, rating dan comment; createdAt berasal dari default database.

Unique constraint Rating.orderItemId dari BE-02 menjadi pengaman terakhir submit ganda. Pemeriksaan existing dan konflik P2002 memberi 409 REVIEW_EXISTS; status selain COMPLETED memberi 409 ORDER_NOT_COMPLETED. Konflik serialisasi P2034 memberi 503 REVIEW_BUSY dengan Retry-After. Tidak ada perubahan stok, voucher, pesanan, pembayaran atau status penerimaan. Skema dan dependensi tidak berubah.

Pembelian produk sama pada item dari pesanan lain dapat diulas lagi. Produk nonaktif tidak menghapus hak pembeli atas item selesai, tetapi daftar publik tetap mengikuti visibilitas katalog. Ulasan yang sudah tersimpan tidak otomatis dihapus/disembunyikan jika status pesanan kemudian menjadi NEEDS_ATTENTION akibat refund/reversal; aturan PRD memvalidasi Selesai saat Submit. Katalog dan daftar memakai populasi ulasan tersimpan yang sama. Tidak ada moderasi otomatis yang diperkenalkan.

Respons menggunakan no-store; mutasi juga Vary: Cookie. Error database tak dikenal dipetakan ke pesan umum tanpa log/output mentah. Nama/komentar ditampilkan sebagai data pengguna, bukan bukti komunikasi penerimaan atau jaminan pembayaran provider.

## Bukti dan batas

- npm.cmd test: 103 tes unit/fondasi lulus dalam 12 berkas; 16 baru BE-12.
- npm.cmd run typecheck: lulus.
- npm.cmd run lint: lulus.
- npm.cmd run build: lulus termasuk dua route BE-12.

Tes memakai Prisma/handler mock: owner/role/Origin, status diperiksa ulang setelah lock, batas input, existing/unique conflict, pembelian ulang, DTO aman, product visibility, pagination/count/average, keadaan kosong, headers dan sanitasi error. Mock tidak membuktikan eksekusi SQL, rollback, unique constraint nyata atau konkurensi. Tes katalog yang sudah ada tetap menjadi regresi; tidak diklaim sebagai bukti agregasi ulasan baru di PostgreSQL.

Sebelum BE-12 ditutup, setelah pemulihan mendapat persetujuan terpisah, gunakan database test terisolasi dan gateway mock untuk membuktikan: dua submit bersamaan menghasilkan tepat satu baris; rollback ketika insert gagal; race refund/webhook dengan Submit dan status diperiksa setelah lock; item asing/belum selesai melalui HTTP; produk sama pada dua order; batas komentar; average/count katalog dan daftar cocok setelah insert; visibilitas produk/kategori; serta metadata pagination/snapshot konsisten. Gunakan fixture khusus dan cleanup terarah, tanpa data pelanggan nyata.

PostgreSQL 55433 tetap tidak dinyalakan, port 5432 tidak menjadi fallback, Scheduled Task tetap tanpa perubahan dan worker tidak dijalankan manual. Tidak ada gateway call. BE-11/BE-12/BE-13 tetap Ditinjau selama pembuktian PostgreSQL/HTTP tertunda; ini bukan pemulihan worker pembayaran. Lihat [PAYMENT-WORKER-DIAGNOSTICS.md](PAYMENT-WORKER-DIAGNOSTICS.md).
