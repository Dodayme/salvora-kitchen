# Rencana penerimaan browser/provider FE-06

25 Oktober 2026. **Rencana, belum dijalankan.** [Hasil FE-06](FE06-PAYMENT-VERIFICATION.md) membedakan mock, HTTP test dan provider nyata. Izin transaksi BE-14 sebelumnya sudah digunakan; tidak diasumsikan sebagai izin transaksi FE-06 baru.

## Sasaran konkret

Satu checkout fixture baru pada `salvora_kitchen_test:55433`: barang Rp5.000 − voucher Rp1.000 + delivery Rp10.000 = **Rp14.000**. Satu order, satu attempt Snap Sandbox baru melalui UI `/pembayaran/[orderId]`, satu simulasi VA yang tersedia di merchant (BNI jika tersedia). Tidak ada uang produksi atau memakai referensi lama.

Frontend/code dan tes guard/mock sudah tersedia. Harness kosong-key aman sudah lulus. **Harness live UI dan endpoint HTTPS baru belum dijalankan/disiapkan**; rencana ini bukan klaim kesiapan runtime live. Sebelum tindakan provider/publik, diperlukan persetujuan pengguna untuk satu transaksi tersebut, webhook HTTPS sementara, serta keterlibatan memilih VA dan simulator.

## Urutan setelah izin

1. Verifikasi ulang target test melalui URL dan identitas SQL; catat fingerprint baseline dan cari bukti/proof baru yang mungkin sudah dibuat agar tidak menduplikasi pekerjaan. Provider proof lama tetap tidak diubah.
2. Siapkan fixture account/category/product/address/order khusus run dan server frontend/API test dengan konfigurasi Sandbox. Key dibaca lokal, tidak dikirim ke chat/log/manifest publik. Pastikan browser dapat dipakai atau pengguna siap mengoperasikan UI; jangan membuat charge jika interaksi belum siap.
3. Siapkan listener webhook HTTPS sementara untuk backend test, dengan signature/referensi/nominal/provider status tervalidasi. Ekspos hanya jalur yang diperlukan. Pastikan origin aplikasi/finish dan penyimpanan tab konsisten: finish harus dapat kembali ke origin UI yang sama; jangan menganggap sessionStorage lintas origin tersedia. Jika listener webhook terpisah, override notifikasi dan konfigurasi kedua proses harus diverifikasi dahulu. Tidak mengubah `.env`, task, merchant global atau database dev secara diam-diam.
4. Uji endpoint/guard tanpa transaksi dahulu. Catat alamat HTTPS sementara secara lokal tanpa kredensial. Jelaskan navigasi UI kepada pengguna dan periksa nominal **dari quote server** sebelum konfirmasi.
5. Pengguna/agent yang diotorisasi membuka UI fixture, mengonfirmasi order, menyiapkan SDK dan meminta **satu** instruksi baru lewat tombol. Bukti backend token-only tidak menggantikan langkah ini. Jika hasil request belum pasti, hentikan charge baru dan periksa attempt yang sama.
6. Pengguna memilih VA dan menjalankan simulator Sandbox. SDK callback/close hanya memicu GET lokal. Periksa hasil webhook dan SQL read-only serta GET status provider yang relevan bila diperlukan untuk verifikasi referensi run tersebut; tidak menjalankan worker dev/manual atau memaksakan status.
7. Uji reload/finish pada tab/origin yang sama, sesi hilang dan tombol reconcile/cooldown; jangan menambah charge untuk menguji ulang state yang cukup memakai mock. Korelasikan order/payment/webhook/application/reservasi/voucher dan pastikan tepat sekali.
8. Simpan laporan tersanitasi dan screenshot aman. Hentikan server/tunnel test. **Pertahankan fixture/proof provider yang sudah dibuat**, termasuk yang masih dapat dibayar/belum pasti; jangan memakai cleanup harness kosong-key pada run live. Cleanup provider hanya dengan review terpisah atas keadaan terminal.

## Batas persetujuan

Persetujuan yang diperlukan menyebut satu transaksi Sandbox Rp14.000, database test, webhook HTTPS sementara dan interaksi simulator. Izin ini tidak mencakup pembayaran produksi, charge tambahan, reset database, perubahan task/keamanan Windows, penghapusan proof lama atau perubahan merchant global. Bila webhook/browser belum siap, tidak membuat transaksi dan FE-06 tetap Ditinjau.
