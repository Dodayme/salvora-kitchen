# Menjalankan Salvora Kitchen di Windows

## Persiapan

- Pasang Node.js 24 (minimal 24.21.0, sebelum versi 25), sesuai `package.json`.
- Pasang PostgreSQL 18. Helper memakai `C:\Program Files\PostgreSQL\18\bin`.
- Pasang Git jika ingin memakai perintah clone. Alternatif: unduh ZIP dari GitHub dan ekstrak.

## Instalasi pertama

Buka PowerShell pada folder tempat menyimpan proyek:

```powershell
git clone https://github.com/Dodayme/salvora-kitchen.git
cd salvora-kitchen
npm.cmd ci
npm.cmd run db:local
npm.cmd run db:generate
npm.cmd run db:validate
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run db:check
npm.cmd run dev
```

Jalankan perintah satu per satu. Jika ada yang gagal, selesaikan error tersebut sebelum melanjutkan. Untuk unduhan ZIP, buka terminal langsung di folder yang berisi `package.json` dan mulai dari `npm.cmd ci`.

Buka http://localhost:3000 dan biarkan terminal tetap berjalan. Tekan Ctrl+C untuk menghentikan server web.

`db:local` membuat database lokal baru beserta `.env.local` secara otomatis. Jangan menyalin `.env.local` atau folder `.local` dari komputer lain, dan jangan membuat `.env.local` sebelum menjalankan helper pada instalasi baru. Data awal berasal dari katalog demo, bukan database pemilik repositori.

Jika PostgreSQL dipasang di lokasi lain, atur lokasi binary sebelum `db:local` dan setiap kali membuka terminal baru untuk menjalankan aplikasi:

```powershell
$env:SALVORA_POSTGRES_BIN = 'D:\PostgreSQL\18\bin'
```

Ganti contoh lokasi tersebut dengan lokasi instalasimu. Port database khusus proyek adalah 55433; pastikan tidak dipakai aplikasi lain.

## Akun admin dan pembeli

Untuk membuat admin lokal baru, jalankan pada terminal lain di folder proyek:

```powershell
npm.cmd run db:admin
```

Kredensial admin baru tersimpan di `.local/admin-demo.json`. Berkas ini bersifat privat dan tidak diunggah ke GitHub. Akun pembeli dapat dibuat melalui halaman registrasi web.

## Pemakaian berikutnya

```powershell
npm.cmd run dev
```

Pemeriksaan startup akan menyalakan database lokal milik proyek jika diperlukan. Instalasi dan pengisian data awal tidak perlu diulang setiap hari.

## Pembayaran

Pembayaran memerlukan key Midtrans Sandbox milikmu di `.env.local`: `MIDTRANS_SERVER_KEY`, `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`, serta `PAYMENT_EXPIRY_MINUTES="60"`. Biarkan `MIDTRANS_IS_PRODUCTION="false"`. Jangan unggah key ke GitHub. Notifikasi pembayaran otomatis memerlukan alamat webhook HTTPS yang dapat diakses Midtrans; server localhost saja belum cukup. Lihat [panduan pembayaran](PAYMENTS.md) dan [webhook](WEBHOOKS.md).

Jika PowerShell memblokir `npm.ps1`, gunakan `npm.cmd` seperti contoh di atas. Panduan database lebih lengkap tersedia di [DATABASE.md](DATABASE.md).
