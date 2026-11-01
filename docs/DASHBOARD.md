# BE-13 — Dashboard operasional dan pemantauan voucher

**Pembaruan frontend 25 Oktober 2026:** [FE-08](FE08-ADMIN-DASHBOARD-VERIFICATION.md) menyediakan `/admin`, periode WIB, status pesanan/inventaris server dan layout admin. 359 unit/regresi serta HTTP/PostgreSQL test lulus; status **Ditinjau** karena browser/drawer/responsif belum diuji. Service/kontrak backend tidak diubah. Voucher UI/profil edit tetap FE-11; catatan bukti BE-13 di bawah tetap historis dan terpisah dari penerimaan UI.

Status terbaru 23 Oktober 2026: **Selesai untuk backend**. PostgreSQL membuktikan batas waktu/stok, total/status, pagination/relasi dan RepeatableRead concurrent; HTTP Next.js nyata menambah pemeriksaan sesi/role/dashboard/vouchers/policy. Rujukan [BE14-RECONCILIATION.md](BE14-RECONCILIATION.md). Cluster 55433 sudah merespons dan tick kosong terverifikasi; bagian bukti awal dan gap di bawah dipertahankan sebagai histori. Perilaku FR-13 tetap, kontrak aktif 0.13/PRD 1.9. BE-12 bukan dependensi BE-13; penerimaan provider/deployment terpisah.

## Endpoint

Semua endpoint GET khusus ADMIN, memakai sesi aplikasi, respons no-store dan Vary: Cookie. Anonim mendapat 401, BUYER 403. Query duplikat/asing atau nilai invalid mendapat 422. Tidak ada operasi tulis, panggilan gateway, rekonsiliasi, reset voucher atau perubahan konfigurasi penjadwal.

| Endpoint | Query | Respons data |
|---|---|---|
| /api/admin/dashboard | from dan to wajib, timestamp UTC | Ringkasan periode dan inventaris saat ini |
| /api/admin/vouchers | page/pageSize, status opsional AVAILABLE/RESERVED/USED | Daftar voucher; pagination pada meta.pagination |
| /api/admin/voucher-policy | Tidak ada | Aturan tetap NEW_BUYER, percentage=20, maxDiscount=100000, oncePerAccount=true |

Contoh periode: `/api/admin/dashboard?from=2026-10-01T00:00:00Z&to=2026-11-01T00:00:00Z`. Frontend mengubah batas periode pilihan pengguna menjadi UTC sebelum mengirim. Rentang inklusif pada from, eksklusif pada to; from harus lebih kecil dari to. Tidak ada rentang bawaan tersembunyi.

## Definisi metrik

| Field | Definisi |
|---|---|
| period | Batas UTC yang sudah dinormalisasi |
| orderCount | Jumlah pesanan berdasarkan order.createdAt dalam periode |
| ordersByStatus | Status terkini pesanan dalam periode createdAt yang sama; seluruh enam status dikirim, termasuk hitungan nol |
| latestOrders | Maksimal 10 pesanan terbaru dari periode yang sama, createdAt menurun lalu id menurun; DTO ringkasan BE-11 |
| activeProductCount | Jumlah produk dengan isActive=true saat dibaca, termasuk stok nol dan produk dengan kategori nonaktif; tidak dipengaruhi periode pesanan |
| inventoryScope | CURRENT_ALL_PRODUCTS: stok saat ini dari seluruh produk, termasuk produk nonaktif; bukan riwayat stok pada periode |
| lowStockThreshold | 5, memakai konstanta katalog BE-04 |
| lowStockCount / outOfStockCount | Jumlah seluruh produk dengan stok tersedia 1–5 / tepat 0 |
| lowStockProducts / outOfStockProducts | Maksimal 10 StockSummary per kelompok; stok tersedia meningkat, lalu nama dan id meningkat |
| listLimit | 10; batas daftar ringkas, bukan batas perhitungan jumlah |

StockSummary memuat `id, name, isActive, isDemo, physicalStock, reservedStock, availableStock`. Stok tersedia dihitung oleh PostgreSQL sebagai physicalStock − reservedStock, bukan stok fisik saja. Produk nonaktif tetap ditampilkan agar admin dapat memantau inventaris, dengan isActive yang jelas. Untuk daftar stok lengkap, gunakan endpoint katalog admin BE-04 dengan filter availability dan pagination. Tidak ada filter kategori aktif yang diam-diam mengubah jumlah produk aktif.

Semua kueri dashboard berjalan dalam satu transaksi RepeatableRead untuk snapshot yang konsisten. orderCount dijumlahkan dari kelompok status yang sama. Periode ini bukan periode perubahan status, bukan paidAt dan bukan laporan keuangan. Tidak menambahkan metrik pelanggan/nilai pembayaran opsional, laba, grafik, ranking atau data contoh Figma. Status pembayaran ringkas dan semua attempt mengikuti semantik BE-11; pending baru tidak menyembunyikan sukses/refund. Ringkasan tidak memuat alamat, telepon, token, signature atau raw event.

## Pemantauan voucher

Pagination bawaan page=1/pageSize=20, maksimal 100 per halaman, urutan createdAt menurun lalu id menurun. Filter status menggunakan status yang tersimpan. Daftar dan total dibaca dalam satu transaksi RepeatableRead.

Setiap baris memuat field voucher whitelist, createdAt/usedAt, reservedOrderId, usedOrderId, owner `{id,name}`, reservedOrder/usedOrder `{id,number}` atau null, dan orderNumber (pesanan penggunaan, jika tidak ada pesanan reservasi). Email, hash kata sandi, sesi, alamat dan data pembayaran tidak disertakan. Pemilik/relasi diambil dari database, bukan input browser.

Status AVAILABLE bukan janji kelayakan checkout. Pembacaan tidak menerbitkan voucher, menghitung ulang kelayakan, melepas reservasi kadaluwarsa atau mengembalikan USED ke AVAILABLE. Bila cluster/job belum pulih, reservasi yang lewat tenggat tetap mengikuti status tersimpan sampai proses pembayaran yang berwenang memverifikasinya. Penanda demo produk tetap tersedia; respons tidak memasukkan angka fixture ke runtime.

Aturan tetap 20% maksimum Rp100.000 sekali per akun sesuai BE-06. Respons policy hanya baca; pengujian memeriksa kesesuaiannya dengan kalkulator checkout. Tidak ada CRUD promo umum, edit kebijakan, perubahan nominal transaksi, penghapusan riwayat atau reset manual.

## Bukti dan batas penerimaan

Pemeriksaan aman BE-13: 87 tes unit/fondasi lulus (12 baru BE-13), typecheck, lint dan build lulus. Tes baru meliputi validasi UTC/rentang/pagination, izin, periode sama, status kosong, total, kueri stok dengan reservasi, batas daftar versus hitungan, DTO aman, relasi/status voucher, policy, headers, duplikat query serta sanitasi respons error. Service dan handler memakai mock Prisma; inspeksi SQL tidak membuktikan hasil eksekusi PostgreSQL.

Belum dijalankan: pengujian database dan HTTP nyata. Sebelum menutup BE-13, gunakan database pengujian terisolasi dan fixture khusus setelah pemulihan diizinkan secara terpisah. Buktikan:

- Pesanan tepat pada from masuk dan tepat pada to tidak masuk; total = penjumlahan seluruh status dan daftar terbaru berada pada periode yang sama.
- Produk aktif stok nol tetap dihitung; stok tersedia 0/1/5/6 dan reservasi parsial/penuh masuk kelompok yang benar; produk nonaktif serta kategori nonaktif mengikuti definisi di atas.
- Lebih dari 10 produk tetap menghasilkan hitungan penuh dan hanya 10 baris; katalog berhalaman dapat membuka sisanya.
- Voucher AVAILABLE/RESERVED/USED dengan relasi pesanan dan owner cocok data aktual, pagination stabil dan endpoint tidak menulis/mengubah kelayakan walaupun deadline terlewati.
- HTTP anon/buyer/admin, kebocoran data, keadaan kosong dan konsistensi snapshot saat checkout/webhook berubah bersamaan.

Tidak menyalakan PostgreSQL, memakai port 5432 sebagai pengganti, menjalankan worker manual atau mengubah Scheduled Task. Hasil historis BE-10 tidak menyatakan tick saat ini berhasil. Rujukan operasional tetap [PAYMENT-WORKER-DIAGNOSTICS.md](PAYMENT-WORKER-DIAGNOSTICS.md).
