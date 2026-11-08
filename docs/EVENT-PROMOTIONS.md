# Promosi event

Admin membuka /admin/promosi untuk membuat diskon persentase 1–99%, batas potongan Rupiah, dan waktu mulai/akhir WIB. Penerima dapat seluruh pembeli atau maksimal 200 email akun BUYER terdaftar. Daftar email divalidasi seluruhnya sebelum promosi disimpan. Admin dapat mengaktifkan/menonaktifkan event.

Berlaku berulang pada interval mulai inklusif, akhir eksklusif berdasarkan jam database. Tidak ada diskon ongkir atau penumpukan: potongan terbesar dipilih; pada hasil sama voucher pembeli baru diprioritaskan. Voucher pembeli baru tidak direservasi jika event dipakai. Pesanan menyimpan referensi event dan jumlah potongan sebagai snapshot; perubahan status event tidak mengubah pesanan yang sudah dibuat. Perubahan promo sebelum konfirmasi memerlukan ringkasan checkout baru.

Mutasi API /api/admin/promotions memerlukan sesi ADMIN dan Origin aplikasi. Harga final dihitung ulang server, bukan nilai dari browser. Penerima disimpan sebagai ID akun, bukan alamat email. Migrasi menambah tabel EventPromotion dan referensi Order.eventPromotionId serta memperbarui constraint nominal pesanan.
