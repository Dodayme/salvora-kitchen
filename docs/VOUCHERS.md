# Voucher pembeli baru dan perhitungan harga — BE-06

Frontend admin FE-11 (25 Oktober 2026): daftar voucher, policy tetap dan link relasi tersedia tanpa mutasi voucher. [FE11-ACCOUNT-VOUCHER-VERIFICATION.md](FE11-ACCOUNT-VOUCHER-VERIFICATION.md) mencatat unit/API/test DB lulus dan browser belum teruji; status Ditinjau. Dokumen backend di bawah mempertahankan sejarah implementasinya.

Status: **BE-06 selesai untuk penerbitan/pembacaan voucher dan perhitungan harga server**. Acuan PRD 1.6 FR-05, bagian 9 dan 11. O-10 ditutup setelah pengguna menyetujui penetapan aturan sesuai kebutuhan bisnis: pembulatan ke bawah ke Rupiah penuh. Persentase tetap 20%, maksimal Rp100.000, satu kali, tanpa minimum belanja tambahan atau penumpukan.

## Penerbitan dan akses

Registrasi membuat sesi pertama dan menjalankan hook yang sama dengan login. Transaksi mengunci User **sebelum** membuat sesi agar pemeriksaan foreign key sesi tidak menyebabkan deadlock saat beberapa login pertama bersamaan. Hook membaca role dan isFirstPurchase dari database, bukan salinan user sebelum transaksi. Selain flag, adanya PaymentApplication atau status pembayaran SUCCESS/REFUNDED/PARTIALLY_REFUNDED/REVERSED mencegah kelayakan baru. Pembayaran pending/gagal/expired/cancelled saja tidak membuktikan pembelian berhasil.

Jika akun BUYER masih memenuhi syarat, upsert Discount berdasarkan userId membuat satu voucher AVAILABLE. Unique userId di database dan lock akun menjaga idempotensi lintas login bersamaan. Voucher yang telah ada, termasuk RESERVED/USED dan referensinya, tidak direset. Login tidak mengubah isFirstPurchase, menghabiskan voucher, membuat order atau menghubungi Midtrans. Kegagalan hook merollback akun baru/sesi/voucher dan pencabutan sesi sebelumnya secara atomik.

GET /api/me/voucher hanya untuk BUYER dari sesi, tanpa target userId/voucherId dari browser. Respons `{voucher:null}` jika belum diterbitkan, atau whitelist id/type/percentage/maxDiscount/status/reservedOrderId/usedAt. Tidak menyertakan userId, usedOrderId, email atau data sesi. GET tidak menerbitkan, menggunakan atau melepas voucher. Respons sukses/error no-store dan Vary Cookie; anonymous 401, admin 403. Status voucher adalah keadaan penyimpanan, bukan janji kelayakan pada checkout berikutnya.

## Perhitungan final

`readPricingInputs(tx,principal)` menyiapkan input dari cart akun dan Product di database: harga terkini, jumlah, subtotal baris dan subtotal keseluruhan. Menolak keranjang kosong, produk/kategori nonaktif serta jumlah di atas physicalStock-reservedStock. Voucher kandidat hanya milik akun, AVAILABLE dan masih memenuhi syarat pembelian pertama. RESERVED/USED tidak menjadi kandidat baru. Gunakan transaksi dengan snapshot konsisten; saat membuat pesanan, BE-07 wajib memeriksa ulang di bawah lock. Fungsi ini tidak mereservasi/mengubah data dan belum menjadi endpoint quote.

`productSubtotal` dan `payableTotal` memakai BigInt sebelum konversi aman ke number, nominal integer Rupiah maksimum 2.147.483.647. Input unitPrice/quantity positif, ongkir/diskon nonnegatif; perkalian dan total melampaui batas ditolak 409 PRICE_TOTAL_LIMIT. Total = subtotal barang - diskon barang + ongkir. Nilai diskon harus ditentukan kebijakan server, bukan JSON browser.

`newBuyerDiscount(subtotal,eligible)` menghitung `min(floor(subtotal × 20 / 100), 100000)` memakai BigInt. Pembulatan hanya sekali setelah semua subtotal barang dijumlahkan. Tanpa voucher layak diskon nol; tidak ada minimum tambahan. Subtotal Rp1–Rp4 tetap memenuhi aturan tetapi hasil pembulatan diskonnya Rp0, bukan alasan menolak keranjang. Cap mulai subtotal Rp500.000; subtotal Rp499.999 memberi diskon Rp99.999. Harga barang dan ongkir tidak dibulatkan oleh helper diskon.

`priceBuyerCart(tx,principal,shippingFee)` menggabungkan input database dan kebijakan final menjadi items/subtotal/discount/shippingFee/total/currency serta voucher `{id,discount}` atau null. Ongkir wajib argumen eksplisit dari kebijakan server; tidak ada default Rp0 atau wilayah layanan baru. Caller memakai transaksi konsisten, lalu BE-07 harus memvalidasi ulang saat konfirmasi. Fungsi ini tidak menerbitkan/mencadangkan/menghabiskan voucher atau stok. Kandidat voucher tetap disertakan jika layak meskipun pembulatan menghasilkan Rp0; tidak menambah batas minimum belanja.

Contoh subtotal Rp10.003 dengan ongkir fixture Rp10.000 menghasilkan diskon Rp2.000 dan total Rp18.003. Dua barang Rp10.003 dan Rp10.004 menghasilkan subtotal Rp20.007, diskon Rp4.001, bukan jumlah diskon yang dibulatkan per item. Helper total tidak memilih tarif atau memastikan wilayah dapat dilayani; angka ongkir pada tes hanya fixture. BE-07 akan memakai hasil harga server untuk quote dan order; browser tidak boleh menentukan harga, diskon, persentase, voucher pemilik lain atau total. Cart BE-05 tetap menampilkan subtotal barang, bukan total checkout dengan voucher.

## Kontrak status untuk task berikutnya

| Perubahan | Pemilik implementasi | Syarat |
|---|---|---|
| Tidak ada → AVAILABLE | BE-06, tersedia | Login berhasil/registrasi bersesi, BUYER belum pernah membayar dan belum diterbitkan voucher |
| AVAILABLE → RESERVED | BE-07, tersedia | Lock User terlebih dahulu, lalu stok/kategori dan voucher dalam urutan konsisten; periksa kelayakan lagi dan ikat hanya satu order milik akun dalam transaksi yang sama |
| RESERVED → USED | BE-09, belum tersedia | Pembayaran sukses terverifikasi dan penerapan order atomik/idempoten; isi usedOrderId/usedAt dan kosongkan reservedOrderId |
| RESERVED → AVAILABLE | BE-10, belum tersedia | Semua percobaan dipastikan tidak dapat menghasilkan pembayaran, lepas referensi atomik; timeout/gagal satu percobaan tidak cukup |
| USED tetap USED | BE-09/BE-10 | Login, refund dan reversal tidak menerbitkan ulang atau mengembalikan voucher otomatis |

BE-09 harus mengubah isFirstPurchase menjadi false pada setiap pembayaran pesanan sukses, termasuk pesanan tanpa voucher. Semua penerapan pembayaran yang bersaing dengan login wajib mengunci User terlebih dahulu; keberadaan lock BE-06 tidak membuktikan alur pembayaran yang belum diimplementasikan aman. Retry pembayaran order yang sama memakai reservasi/snapshot yang sama. Constraint unique/referensi/status BE-02 tetap menjaga satu voucher per akun dan satu order reservasi, tanpa migrasi baru. Uji perebutan voucher saat checkout, penggunaan sukses dan pelepasan nyata ditutup bersama BE-07/BE-09/BE-10.

## Verifikasi

Tes PostgreSQL menguji penerbitan registrasi, login ulang, empat login pertama bersamaan, admin/pembeli lama, riwayat sukses/refund/reversal dan application, pending/gagal, state RESERVED/USED tidak berubah, read milik sendiri tanpa efek samping, rollback akun/sesi/voucher, serta harga cart sendiri/harga terkini/stok/kandidat voucher. Harga akhir diuji memakai data database: diskon otomatis, cap, pembulatan, ongkir tetap, voucher reserved/tidak layak/tidak ada menghasilkan diskon nol, serta tanpa mutasi stok/voucher. Unit aritmetika menguji contoh PRD, pecahan Rupiah, pembulatan pada subtotal keseluruhan, subtotal kecil tanpa minimum tambahan, batas cap/integer, input invalid dan overflow.

HTTP auth/voucher lulus pada server hasil build dengan cookie sesi nyata dan DB test khusus: voucher setelah registrasi, id tetap saat login ulang, whitelist/header privat, anonymous/admin ditolak. Regresi HTTP alamat/keranjang dan katalog/foto juga lulus. Fixture berupa akun/secret baru, dibersihkan spesifik; tidak memakai admin pribadi atau database LanggananKu. Tidak ada dependensi/konfigurasi/migrasi baru. Tidak ada bukti checkout, Snap, webhook atau penjadwal dari hasil tes ini.

Hasil akhir: **38 tes unit/fondasi + 51 tes PostgreSQL**, lint/typecheck/build lulus. HTTP auth/voucher, katalog/foto, alamat/keranjang dan smoke fondasi lulus pada pengerjaan BE-06. Rumus harga final dibuktikan oleh tes unit dan PostgreSQL, belum endpoint quote/checkout. Reservasi/penggunaan/pelepasan voucher tetap ditutup bersama task dependennya.

Pembaruan BE-07: quote/order dan reservasi voucher/stok sudah tersedia dan diuji, termasuk satu voucher pada satu order aktif, rollback serta replay tanpa reservasi ganda. Harga server kini dipakai endpoint checkout; penggunaan/pelepasan tetap BE-09/BE-10. Detail [CHECKOUT.md](CHECKOUT.md).
