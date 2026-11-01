# Catatan penyusunan Bab I

Tanggal pemeriksaan: 1 November 2026. Dokumen ini merupakan catatan kerja, **bukan bagian naskah Bab I**.

## Status sumber

Naskah [BAB-I-PENDAHULUAN.md](BAB-I-PENDAHULUAN.md) disusun dari dokumentasi proyek dan pemeriksaan kode halaman, komponen, layanan, serta aturan transaksi. Setelah pengguna mengirim kedua proposal, seluruh teks pada 33 halaman dibaca dan seluruh halaman diagram serta acuan UI diperiksa secara visual. Struktur 1.1–1.5 sesuai dengan Bab I proposal rancangan: latar belakang, rumusan masalah, tujuan, manfaat, dan batasan masalah.

Sumber asli yang kini tersedia:

- **P1 — PROPOSAL PROGRESS 1 WEBSITE E-commers (1).pdf**, 11 halaman, berlokasi di `C:/Users/basti/Downloads/PROPOSAL PROGRESS 1 WEBSITE E-commers (1).pdf`.
- **P2 — PROPOSAL RANCANGAN PROJECT E-COMMERCE.pdf**, 22 halaman, berlokasi di `C:/Users/basti/Downloads/PROPOSAL RANCANGAN PROJECT E-COMMERCE.pdf`.

Nomor halaman dalam catatan ini adalah urutan halaman PDF, termasuk sampul. P1 halaman 2 memuat arahan desain dengan urutan Use Case, RAT, Activity Diagram, Sequence Diagram, dan UI. Arahan tersebut dicatat sebagai konteks tugas perancangan, bukan perintah untuk mengubah aplikasi atau menambahkan semua fitur dalam proposal. Kedua dokumen belum memuat rubrik penilaian atau ketentuan format laporan akhir lengkap. Tautan Figma pada P1 dicatat sebagai rujukan desain; gambar yang diperiksa adalah yang disematkan dalam PDF, bukan kondisi terbaru file Figma.

Pemeriksaan HTTP ke web lokal tidak berhasil karena akses socket dibatasi lingkungan. Kesesuaian fitur pada penyusunan ini didasarkan pada kode implementasi dan dokumentasi verifikasi terdahulu, bukan pengujian ulang website secara langsung. Tidak ada perubahan kode aplikasi, database, konfigurasi pembayaran, atau status penerimaan proyek.

## Acuan dan pencocokan utama

| Pembahasan | Sumber dokumentasi | Bukti implementasi |
|---|---|---|
| Identitas, kategori awal, lingkup proyek | [PRD](../../PRD-Salvora-Kitchen.md), [README](../../README.md) | `src/components/catalog/storefront.tsx`, `prisma/seed-catalog.ts` |
| Autentikasi, pembeli, admin | [AUTH](../AUTH.md), [laporan FE-02](../FE02-AUTH-VERIFICATION.md) | `src/app/login`, `src/app/register`, `src/components/auth`, `src/services/auth.ts` |
| Katalog, kategori, detail | [CATALOG](../CATALOG.md), [laporan FE-03](../FE03-CATALOG-VERIFICATION.md) | `src/app/menu`, `src/components/catalog/storefront.tsx`, `src/components/catalog/product-detail.tsx` |
| Keranjang dan alamat | [BUYER](../BUYER.md), [laporan FE-04](../FE04-BUYER-VERIFICATION.md) | `src/app/keranjang`, `src/app/alamat`, `src/components/buyer` |
| Diskon 20%, maksimum Rp100.000 | [VOUCHERS](../VOUCHERS.md) | `src/services/vouchers.ts`, `src/services/pricing.ts`, `src/lib/pricing/money.ts` |
| Delivery dan pickup | [CHECKOUT](../CHECKOUT.md), dengan koreksi berdasarkan kode terbaru | `src/components/checkout/checkout-screen.tsx`, `src/services/checkout.ts`, `src/lib/checkout/validation.ts`, `src/lib/checkout/policy.ts` |
| Pemenuhan dan penerimaan | [ORDERS](../ORDERS.md), dengan koreksi label dan pickup berdasarkan kode | `src/components/admin/order-screens.tsx`, `src/lib/orders/fulfillment.ts`, `src/lib/contracts/status.ts` |
| Midtrans Sandbox dan batas bukti | [PAYMENTS](../PAYMENTS.md), [WEBHOOKS](../WEBHOOKS.md), [RECONCILIATION](../RECONCILIATION.md), [penerimaan backend](../BE14-RECONCILIATION.md) | `src/app/pembayaran`, `src/app/api/webhooks/midtrans`, `src/services/payments.ts` |
| Ulasan pembelian selesai | [REVIEWS](../REVIEWS.md), [laporan FE-07](../FE07-ORDERS-VERIFICATION.md) | `src/app/api/order-items/[orderItemId]/review`, `src/services/reviews.ts` |
| Dashboard dan admin | [DASHBOARD](../DASHBOARD.md), laporan [FE-08](../FE08-ADMIN-DASHBOARD-VERIFICATION.md), [FE-09](../FE09-CATALOG-VERIFICATION.md), [FE-10](../FE10-ORDERS-VERIFICATION.md), [FE-11](../FE11-ACCOUNT-VOUCHER-VERIFICATION.md) | `src/app/admin`, `src/components/admin` |
| Teknologi dan batas penerimaan | [UI-FOUNDATION](../UI-FOUNDATION.md), [DATABASE](../DATABASE.md), [FE-VERIFICATION](../FE-VERIFICATION.md) | `package.json`, `prisma/schema.prisma` |

## Koreksi terhadap materi lama

1. Nama merek di website adalah **Salvora Kitchen**, meskipun nama folder proyek memakai “Salvara Kitchen”. Naskah mengikuti merek pada website.
2. PRD 1.9 dan dokumen backend awal masih mengecualikan pickup. Kode terbaru sudah memiliki pilihan pickup, ongkir nol, kontak pengambil, status `READY_FOR_PICKUP`, dan transisi admin. Bab I memasukkan fitur ini berdasarkan implementasi tersebut.
3. Label `SHIPPED` pada website adalah **Sedang diantar**. Naskah memakai label antarmuka yang berlaku saat diperiksa.
4. “API bank”, unggah bukti transfer, dan validasi pembayaran manual tidak dipakai sebagai uraian implementasi. Integrasi yang digunakan adalah Midtrans Snap Sandbox dengan verifikasi server.
5. Dashboard tidak dinyatakan sebagai laporan keuangan. Desain lama yang memuat grafik, ekspor, promosi umum, atau pengaturan tambahan tidak menjadi bukti bahwa fitur tersebut tersedia.
6. Tidak dibuat klaim wawancara, survei, angka peningkatan penjualan, riwayat usaha, transaksi produksi, atau kelulusan seluruh pengujian. Manfaat dinyatakan sebagai kegunaan fasilitas aplikasi.
7. P2 halaman 9 menempatkan metode Waterfall pada Bab III. Bab I tidak ditambah subbab metode. Pernyataan proposal tentang observasi, konsultasi dosen, dan urutan tahap tidak dijadikan bukti bahwa seluruh kegiatan tersebut telah terlaksana.

## Hasil pembacaan kedua proposal dan diagram

| Sumber | Temuan | Keputusan untuk laporan |
|---|---|---|
| P1 hlm. 1; P2 hlm. 1 | Identitas Kelompok 11, mata kuliah Pemrograman Web, Program Studi Teknik Informatika, Universitas Maritim Raja Ali Haji, tahun 2026 | Konteks akademik ditambahkan pada latar belakang tanpa mengarang profil usaha |
| P2 hlm. 2–3 dan 9 | Tiga fokus: voucher pembeli baru, pembayaran terintegrasi, ulasan pembelian selesai | Rumusan masalah dan tujuan dibuat empat pasang: tiga fitur inti dan satu integrasi basis data/antarmuka pendukung |
| P1 hlm. 2–3; P2 hlm. 13 | Fitur/use case mencakup moderasi ulasan, laporan penjualan, kelola diskon, ubah profil; P1 juga memuat maps dan filter rasa | Tidak mengklaim moderasi, analitik produk terlaris, promo umum, pin peta, filter rasa, atau profil pembeli lengkap. Pemantauan voucher dan dashboard dijelaskan sesuai implementasi |
| P1 hlm. 4; P2 hlm. 14 | RAT memuat koordinat alamat, `flavour`, rating langsung ke user/produk; penjelasan P1 menyatakan satu order satu payment dan satu user banyak discount | Skema aktual tidak memakai koordinat/rasa. `Discount.userId` unik, satu order memiliki beberapa attempt pembayaran, dan `Rating.orderItemId` unik. Kepemilikan ulasan ditelusuri melalui item → order → user |
| P1 hlm. 4; P2 hlm. 14 | Order merujuk alamat tersimpan | Implementasi menyimpan salinan data penerima pada order; pengubahan/penghapusan alamat aktif tidak mengganti riwayat order |
| P1 hlm. 5 dan 8; P2 hlm. 19 | Activity/sequence gateway masih memakai aktor Bank/API Bank dan cabang sukses/gagal sederhana | Gunakan Midtrans Snap Sandbox; bedakan notifikasi server dari redirect browser, tambahkan pemeriksaan status dan hasil belum pasti pada diagram bab berikutnya |
| P2 hlm. 10–12, 16–17, dan 22 | KF-08–10, aturan bisnis, sequence, dan kesimpulan memakai unggah bukti transfer serta persetujuan admin | Bertentangan dengan alur gateway pada bagian lain proposal dan kode web. Tidak dimasukkan sebagai fitur pada Bab I; sequence manual perlu diganti saat menyusun bab perancangan |
| P1 hlm. 6; P2 hlm. 20 | Activity admin menawarkan perubahan Dikirim/Selesai, menghitung ulang final price, dan mengirim notifikasi | Kode mempertahankan nominal order, membatasi transisi secara berurutan, serta mewajibkan konfirmasi penerimaan dan catatan saat Selesai. Tambahkan cabang pickup. Tidak mengklaim notifikasi eksternal |
| P1 hlm. 7 dan 9; P2 hlm. 18 dan 21 | Activity/sequence ulasan memakai validasi pembelian; activity menyebut `order_items.user_id` | Prinsip pembelian selesai dipertahankan. Pada kode, user berada di order, bukan item. Validasi diulang saat submit, termasuk penolakan ulasan kedua untuk item sama |
| P1 hlm. 8; P2 hlm. 15 | Sequence login menerbitkan voucher pembeli baru | Kode juga menerbitkan saat registrasi membentuk sesi. Kelayakan dan keberadaan voucher diperiksa; login ulang tidak membuat voucher baru |
| P2 hlm. 11 | Harga akhir hanya total belanja dikurangi diskon | Rumus aktual: subtotal barang − diskon + ongkir. Diskon tidak termasuk ongkir; pickup berongkir nol |
| P1 hlm. 10–11; P2 hlm. 21 | P1 memuat acuan warna/typografi dan landing page dengan produk terlaris, testimoni serta formulir kontak. P2 bagian 4.5 dan 4.6 hanya judul | Tidak menganggap mockup sebagai bukti fitur berjalan atau judul kosong sebagai uraian implementasi. Gunakan komponen web aktual untuk klaim fitur |

## Dampak pada Bab I dan pekerjaan berikutnya

Bab I tetap berisi pendahuluan, tanpa menyisipkan diagram atau kesimpulan pengujian. Tiga fitur inti ditegaskan kembali sesuai proposal, tetapi terminologi, batas diskon, pilihan penerimaan, hak akses, dan proses pembayaran mengikuti kode web. Tujuan ditulis sebagai pengembangan/implementasi, bukan sekadar menghasilkan proposal rancangan.

Pada bab berikutnya, use case, RAT, activity, dan sequence perlu disusun ulang berdasarkan implementasi. Pemeriksaan diagram sumber telah dilakukan, tetapi diagram PDF asli belum diedit dan belum dinyatakan konsisten dengan aplikasi. Ketentuan format laporan akhir tambahan dari dosen, jika ada, masih perlu dicocokkan ketika tersedia.
