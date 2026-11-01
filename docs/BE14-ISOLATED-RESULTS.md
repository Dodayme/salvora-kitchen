# BE-14 — Hasil pengujian PostgreSQL terisolasi

**Status akhir 24 Oktober:** BE-14 diterima untuk backend setelah BNI VA Sandbox nyata Rp14.000 settlement/webhook/status/application terverifikasi, migrasi/seed/restore database kosong dan HTTP/regresi dilengkapi. Ketiga fixture provider lama tetap dipertahankan; fixture baru sukses juga dipertahankan. Catatan mismatch regresi pertama yang terpisah dari 19 tes ini tetap dicatat, tidak dinyatakan pulih. Hasil 19 tes di bawah merupakan histori run asli, bukan seluruh bukti BE-14 atau penerimaan frontend/deployment. Rujukan akhir: [BE14-RECONCILIATION.md](BE14-RECONCILIATION.md).

**Rekonsiliasi sesudah laporan 13:50 WIB:** cakupan 19 tes di bawah telah dicocokkan dengan sumber dan tidak diulang tanpa alasan. Tambahan HTTP Next.js nyata, regresi 108, schema dump/restore, dua tick otomatis dan perubahan status BE tersedia pada [BE14-RECONCILIATION.md](BE14-RECONCILIATION.md). BE-11–BE-13 kini Selesai backend; BE-14 tetap Dikerjakan. Laporan ini mempertahankan hasil run aslinya, bukan berarti semua pekerjaan lanjutan belum dilakukan.

**Tambahan berizin berikutnya:** fresh database Prisma deploy/seed/isolasi role/dump/restore lulus 15:36 WIB, target sementara dibersihkan dan dev/test fingerprint cocok. Uji provider baru disetujui, satu token/proof unik siap, simulasi VA belum terbukti. Selisih retensi pada regresi lama pertama (terpisah dari 19 tes ini) tetap dijelaskan dalam laporan rekonsiliasi, tidak ditutupi oleh run bersih berikutnya.

Tanggal: 23 Oktober 2026. Pengguna meminta pengujian BE-11–BE-13, konkurensi, rollback dan alur sampai ulasan memakai gateway mock, dengan fixture provider lama dipertahankan. Laporan tambahan ini tidak mengubah status task/dokumen utama secara otomatis.

## Hasil aktual

| Pemeriksaan | Hasil |
|---|---|
| `node --import tsx scripts/verify-be14-database.mjs` | **19 tes PostgreSQL lulus, 0 gagal** |
| Fingerprint sebelum/sesudah | **VERIFIED_UNCHANGED** untuk seluruh 19 tabel domain yang diperiksa, termasuk Payment, PaymentEvent, Order, Session dan RateLimit |
| `npm.cmd test` | **103 tes unit/fondasi lulus** dalam 12 berkas; tidak termasuk 19 tes PostgreSQL |
| `npm.cmd run typecheck` | Lulus |
| `npm.cmd run lint` | Lulus tanpa warning |

Percobaan runner di sandbox ditolak EACCES saat koneksi, sebelum test berjalan. Pengulangan di luar sandbox dengan izin lulus 17 tes; setelah penambahan dua tes snapshot, pengulangan akhir lulus 19 tes dengan fingerprint tetap sama. Tidak mengulang pengujian setelah hasil akhir tersebut karena tidak ada perubahan kode/test berikutnya.

Target koneksi divalidasi sebelum test: **salvora_kitchen_test**, loopback, port **55433**. Identitas database dan port diperiksa kembali melalui SQL. Runner menuntut dua migrasi proyek sudah tercatat selesai; tidak menerapkan migrasi, menjalankan seed, membuat/menghapus database atau mereset tabel. DATABASE_URL subprocess dipetakan hanya ke TEST_DATABASE_URL, dengan NODE_ENV=test. Tidak mengubah file environment pengguna atau mengakses database dev sebagai fallback.

## Kasus yang dibuktikan

1. Akun baru melalui service registrasi/sesi/voucher → alamat/cart → quote/order/idempotency replay → Snap mock → verifikasi status/signature mock dan penerapan pembayaran → kirim → konfirmasi manual Selesai → ulasan → agregasi katalog dan pemantauan voucher/dashboard. Efek stok serta PaymentApplication sekali diperiksa.
2. Owner scope, filter pembayaran/kanal, snapshot historis setelah perubahan katalog/alamat serta privasi catatan admin memakai data PostgreSQL.
3. Pengiriman belum dibayar, transisi ilegal dan penyelesaian tanpa konfirmasi ditolak tanpa status salah.
4. Dua pengiriman concurrent menghasilkan tepat satu transisi/history.
5. Kegagalan penulisan history merollback status pengiriman; percobaan berikutnya dapat berhasil.
6. Catatan concurrent tersimpan keduanya tanpa perubahan status/nominal.
7. Ulasan item asing/belum Selesai dan rating/komentar invalid ditolak saat penyimpanan.
8. Dua Submit concurrent menghasilkan satu ulasan dan satu REVIEW_EXISTS; insert langsung duplikat juga ditolak unique constraint PostgreSQL P2002.
9. Error yang sengaja disuntikkan setelah INSERT Rating merollback baris dan agregasi; canReview tetap benar.
10. Produk sama pada dua pesanan dapat memiliki dua ulasan; rata-rata/count daftar dan katalog cocok, dengan pagination dan komentar batas 1.000 karakter.
11. Race refund mock versus pengiriman berakhir NEEDS_ATTENTION, tanpa penerapan atau pengurangan stok ganda.
12. Race refund mock versus ulasan memberi hasil serial yang diizinkan: ulasan tersimpan sebelum refund, atau ditolak setelah refund. Submit setelah refund ditolak.
13. Dashboard memakai from inklusif/to eksklusif; jumlah status cocok total dan latest berada pada periode sama.
14. Inventaris menghitung stok tersedia 0/1/5/6 dari fisik−reservasi, termasuk produk/kategori nonaktif sesuai definisi admin; produk aktif stok nol tetap dihitung.
15. Lebih dari 10 produk stok menipis memberi jumlah penuh dengan cuplikan 10.
16. Status voucher RESERVED/USED, owner/relasi pesanan, count/pagination dan tidak adanya perubahan data saat dibaca sesuai database.
17. Dashboard RepeatableRead tetap memakai snapshot awal ketika order dan stok benar-benar berubah melalui koneksi lain di tengah pembacaan; pembacaan berikutnya melihat perubahan.
18. Count dan halaman voucher tetap konsisten ketika voucher baru benar-benar diterbitkan di tengah pembacaan; pembacaan berikutnya melihat jumlah baru.
19. Handler Request/Response dengan database nyata memeriksa role, Origin, no-store dan daftar ulasan publik. Ini bukan pengujian jaringan Next.js penuh.

## Retensi dan batas keamanan

Gateway Snap/Get Status disuntikkan sebagai mock; tidak ada request HTTP Midtrans. Fetch pada proses test dipasang guard yang akan gagal bila dipanggil, dan diverifikasi tidak pernah dipanggil. Callback pada test adalah payload fixture yang ditandatangani dengan key tiruan khusus test, bukan webhook provider nyata.

Fixture memakai akun/produk/kategori/referensi baru beridentitas acak per run. Cleanup hanya menarget ID yang dibuat run ini, termasuk limiter HMAC dengan secret acak khusus run; tidak menggunakan reset/truncate atau pembersihan global. Fingerprint jumlah dan hash seluruh baris pada 19 tabel domain sebelum/sesudah cocok, sehingga data provider lama dan baris domain lain yang telah ada tidak berubah pada kedua run yang berhasil. Isi baris sensitif tidak dicetak; fingerprint dihitung di PostgreSQL dan dibandingkan hanya di memori.

Runner menahan stdout/stderr mentah test runner/driver, hanya menampilkan ringkasan aman. Jika kelak muncul MISMATCH_REQUIRES_REVIEW, jangan menghapus data global untuk memaksa hasil cocok; periksa hanya fixture run yang gagal. Fingerprint adalah pemeriksaan retensi baris pada dua snapshot, bukan backup atau pembuktian seluruh keadaan fisik/schema server.

Scheduled Task, interval, status task, launcher, backup/rollback dan database dev tidak diubah. Worker/rekonsiliasi tidak dijalankan manual. Tidak menyalakan/mematikan cluster atau mengaktifkan task. Tidak mengulang build karena perubahan hanya menambah test, runner dan laporan ini, tanpa perubahan kode aplikasi.

## File tambahan dan cara menjalankan ulang

- `tests/database/be14-integration.test.ts`: 19 tes di atas; ekstensi Prisma digunakan untuk fault injection/sinkronisasi, bukan pengganti database.
- `scripts/verify-be14-database.mjs`: guard target/schema, subprocess test, sanitasi output dan fingerprint retensi. Tidak mengubah package scripts atau runner lama.
- Dokumen ini: bukti untuk diteruskan ke chat utama.

Jalankan hanya setelah database test sudah tersedia dan akses disetujui:

```powershell
node --import tsx scripts/verify-be14-database.mjs
```

Runner dapat menulis/menghapus fixture test yang dibuat sendiri, sehingga bukan perintah read-only. Hindari menjalankannya bersamaan dengan proses lain yang sedang menulis ke database test: fingerprint global akan mendeteksi perubahan tersebut sebagai mismatch. Tidak membuka atau membayar fixture provider lama.

## Pekerjaan BE-14 yang belum ditutup

Bagian ini menggambarkan gap **ketika laporan 13:50 dibuat**. Gap regresi lama, HTTP jaringan dan tick kosong kini mendapat bukti lanjutan; backup/restore schema fixture terbukti namun DB kosong baru belum. VA provider dan UI/deployment masih terbuka. Jangan memakai paragraf historis berikut sebagai status terbaru; laporan rekonsiliasi juga memuat satu mismatch fingerprint pada run regresi pertama yang terpisah dari 19 tes awal.

Hasil ini menutup gap pengujian service/handler PostgreSQL yang disebut di atas, tetapi tidak menyatakan BE-14 atau seluruh produk selesai. Belum dilakukan dalam pekerjaan ini: regresi seluruh suite PostgreSQL lama, HTTP melalui server Next.js nyata beserta cookie browser, migrasi pada database kosong baru, backup/restore terisolasi, tick worker otomatis setelah task diaktifkan kembali, VA Sandbox lunas/webhook provider nyata, hosting/volume/job server serta UAT frontend/Figma/responsif. Penentuan status akhir BE-11–BE-14 diserahkan ke chat utama berdasarkan gabungan bukti dan kriteria yang masih terbuka.
