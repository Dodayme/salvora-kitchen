# FE-11 — Voucher tetap dan akun admin sendiri

25 Oktober 2026. PRD 1.9 FR-13/FR-14, API 0.13, [VOUCHERS](VOUCHERS.md), [task frontend](TASKS-FRONTEND.md).

**Status: Ditinjau.** Implementasi, 437 unit/regresi dan tujuh kelompok HTTP/PostgreSQL test lulus. Interaksi browser, keyboard/fokus, cancel dialog dan responsif belum terbukti. Izin kontrol Chrome timeout pada FE-10 di sesi yang sama; tidak mengulang permintaan kontrol tanpa perubahan kondisi. FE-05–FE-10 tetap sesuai status sebelumnya. FE-12 menjadi tahap penerimaan lintas halaman, bukan penutupan otomatis gap tersebut.

## Perilaku dan perubahan

| Bagian | Perilaku |
|---|---|
| `/admin/voucher` | Aturan server diskon 20%, maksimal Rp100.000, sekali per akun pembeli baru; daftar readonly dengan pemilik, status, waktu dan link pesanan terkait |
| Daftar voucher | Filter AVAILABLE/RESERVED/USED, pagination 10, jumlah total server, loading/error/retry/kosong dan kembali ke halaman 1. Filter diubah → halaman 1 dan data lama disembunyikan selama pembacaan baru |
| Kebijakan | GET terpisah; aturan gagal dimuat tidak diganti angka contoh. Decoder menolak kebijakan di luar kontrak tetap. Tidak ada Tambah Promo, edit/hapus/reset voucher, minimum belanja baru atau beli 2 gratis 1 |
| Relasi | Tampilkan reservedOrder atau usedOrder dari DTO beserta nomor/link. Status Tersedia bukan jaminan kelayakan checkout. Client hanya menyimpan nama pemilik yang diperlukan, tanpa email/ID pemilik |
| `/admin/akun` | GET akun admin sendiri. Email/peran berupa teks informasi; hanya nama yang dapat diubah melalui dialog. Tidak menambah avatar upload, username, telepon atau password |
| Simpan nama | PATCH hanya `{name}`, trim 2–100 Unicode code points sesuai Zod terpasang. ID akun dibandingkan dengan sesi; tidak mengirim target ID/email/role. Setelah respons sah, GET profil dan background GET sesi mengonfirmasi nama di halaman/header |
| Pending/error | Shared action lock mencegah submit ganda/penutupan saat pending. Batal sebelum submit membuang draft. 422 tetap dapat diperbaiki, 429 mengikuti cooldown, respons jaringan/protokol/5xx belum pasti memerlukan GET ulang tanpa replay otomatis |

Profil memakai gate ADMIN, latest read dan useAccountRequest yang sudah ada: 401 membersihkan sesi, pergantian akun/role membuang tampilan privat. Header tidak diberi nama dari draft browser. Nama dirender sebagai teks React. Endpoint tidak memiliki expectedUpdatedAt; task ini tidak mengklaim penguncian versi untuk edit nama bersamaan atau menambah aturan backend baru.

Perbaikan kecil pada decoder sesi: batas nama sebelumnya memakai panjang UTF-16, sehingga nama 100 emoji yang sah di API akan ditolak saat sesi dibaca ulang. Kini batas memakai `Array.from(name).length`, sejalan dengan code points Zod. Validasi profil memakai aturan server, tidak mengubah service/schema/auth policy. Form registrasi bukan bagian perubahan ini.

Sumber visual yang dibaca: `.Desain/Promosi.png` dan `.Desain/Pengaturan -_ Akun Admin - Admin.png`. Tema peach/kartu putih/judul serif dipertahankan; tabel promosi umum diganti voucher tetap, field akun dibatasi kontrak, gambar kucing contoh diganti ikon akun. Tidak memakai screenshot sebagai aset atau mengklaim kesamaan render. Figma tidak dipanggil ulang setelah limit FE-00.

Berkas:

- `src/lib/admin-client/account-model.ts`: policy/DTO whitelist, relasi voucher, query/status, payload nama dan decoder akun ADMIN dengan ID yang diharapkan.
- `src/components/admin/account-screens.tsx`: voucher readonly dan profil sendiri/dialog nama.
- `src/app/admin/voucher/page.tsx`, `src/app/admin/akun/page.tsx`: route voucher baru dan penggantian profil sesi readonly dengan GET/PATCH profil asli.
- `src/components/admin/admin-shell.tsx`: mengaktifkan menu voucher; seluruh menu P0 kini memiliki halaman implementasi.
- `src/lib/auth-client/model.ts`: panjang nama Unicode pada decoder sesi.
- `tests/admin-account-client.test.ts`: 22 tes baru.
- `scripts/verify-admin-account-client.mjs`: HTTP/test DB terisolasi, fixture scoped, pemeriksaan nama/sesi/relasi dan cleanup.

Tidak mengubah service/API/backend, aturan voucher, migrasi/schema, dependency, `.env`, task Windows atau data dev. Tidak ada worker/reconcile manual, gateway atau pembayaran baru.

## Pemeriksaan aktual

| Perintah | Hasil dan batas |
|---|---|
| `npm.cmd test` | **24 file / 437 tes lulus**, termasuk 22 baru: fixed policy, whitelist, semua state/relasi, query/pagination invalid, nama/Unicode, own ID/role, refresh sesi dan respons hilang tanpa replay. Bukan tes React DOM |
| `npm.cmd run lint` | Lulus |
| `npm.cmd run build` | Lulus, `/admin/voucher` dan `/admin/akun` tercantum |
| `npm.cmd run typecheck` | Lulus setelah build selesai |
| `npm.cmd run check:client` | PASS: **71 source files / 38 browser artifacts / empat nilai privat** diperiksa tanpa dicetak |
| `node --import tsx scripts/verify-admin-account-client.mjs` | **PASS tujuh kelompok**, controller/payload frontend + real Next HTTP + PostgreSQL test:55433; cleanup PASS; providerCalls=0; browserTested=false |

Tes yang membutuhkan spawn dijalankan dengan izin di luar sandbox yang membatasi Vitest/tsx. Tidak menjalankan ulang tes provider atau migrasi backend yang sudah memiliki bukti valid.

### Bukti HTTP/SQL

1. Anonymous 401 dan BUYER 403 pada profil, list voucher dan policy; PATCH buyer/Origin asing ditolak 403.
2. Policy tepat NEW_BUYER/20/100000/oncePerAccount=true. Halaman 1/2 untuk semua state dan tiap AVAILABLE/RESERVED/USED dicocokkan dengan SQL count serta urutan createdAt/id, termasuk baris existing. Halaman 100000 kosong. Tidak menganggap fixture sebagai seluruh database.
3. Dua order sintetis memberi relasi RESERVED dan USED yang benar; nomor/link dan nama pemilik cocok. Seluruh Discount dan order fixture sebelum–sesudah GET sama; tidak ada mutasi voucher dari pembacaan.
4. Dua ADMIN menerima profil sendiri. Body berisi ID/email/role tambahan ditolak 422; nama 1/101 karakter ditolak. PATCH nama sah di-trim, GET profil dan refresh sesi memperlihatkan hasil. Field sendiri selain name/updatedAt tetap; user admin kedua sama persis.
5. Nama 100 emoji diterima PATCH, decoder profil dan GET sesi sesudahnya, tanpa false session error. Nama lebih dari batas ditolak pada unit/client.
6. Respons PATCH sengaja hilang setelah commit: controller needsReload, reset/retry tidak mengirim PATCH kedua, GET profil/sesi menemukan nama tersimpan. Seluruh voucher tetap sama.
7. Sesi ADMIN dicabut; profil/voucher kembali 401. Allowlist hanya auth/session, GET voucher/policy/me dan PATCH me; tidak ada endpoint provider/payment/worker.

Transaksi/order dengan voucher RESERVED/USED adalah **fixture sintetis**, bukan bukti checkout, penerapan pembayaran atau pemakaian voucher baru oleh provider. Callback session/controller pada harness dibedakan dari tampilan nama header yang benar-benar terlihat di browser. Kebijakan backend historis tetap bersumber pada laporan backend.

## Isolasi dan hasil

Sebelum menulis fixture, URL loopback port 55433 dan SQL current_database=salvora_kitchen_test/inet_server_port=55433 diverifikasi. Dua admin, 12 buyer, 12 voucher, kategori/produk dan dua order baru memakai namespace run. Secret auth baru hanya di memori; DATABASE_URL child dan kedua key Midtrans kosong. Tidak memakai akun dev atau membaca admin-demo.json.

Run **25 Oktober 2026 09:30:00 UTC / 16:30:00 WIB**, ID `ee9a74ab-2218-41b7-a01e-97ad158fb804`, PASS. `.local/fe11/http-result.json`, `<run>-result.json` dan `<run>-baseline.json` menyimpan metadata/hitungan/hash tersanitasi, tanpa kredensial/baris pelanggan. Cleanup mengosongkan relasi voucher milik run sebelum order/voucher/user dihapus; tidak mereset data existing. Rate-limit dihapus hanya key secret/email/window run yang diketahui.

Delapan belas fingerprint sebelum–sesudah cocok: User, Session, Address, Category, Product, ProductPhoto, Cart, CartItem, Discount, CheckoutQuote, Order, OrderItem, StockReservation, OrderStatusHistory, Payment, PaymentApplication, PaymentEvent, Rating. Sisa user fixture nol. Ini cakupan tabel tersebut, bukan checksum seluruh cluster. Tidak menulis/menghapus berkas foto atau backup/rollback, tidak memakai 5432/LanggananKu. Server test ditutup; server development pengguna tidak dihentikan.

## Gap FE-12

Browser belum dijalankan pada FE-11, dan runner HTTP otomatis selesai; tidak menyiapkan sesi UI yang tetap hidup. Saat akses browser tersedia, siapkan server/fixture test terisolasi dengan cleanup lalu periksa:

- Voucher semua state, pagination/filter/kosong/error, label aturan tetap dan link menuju order yang benar, tanpa kontrol mutasi promosi.
- Profil GET milik sendiri; edit nama valid/invalid, cancel tanpa PATCH, pending double-click, error/429/respons hilang. Sesudah simpan, nama halaman/header cocok GET sesi; email/role tidak memiliki kontrol edit.
- BUYER/anonymous/expiry/logout/pergantian akun, 360/768/1440px, keyboard/fokus/dialog, teks panjang dan scroll tabel. Jangan menulis perubahan test ke akun dev.

Simpan bukti browser dan cleanup sebelum menandai FE-11 Selesai. FE-12 menutup gap frontend lintas task, termasuk transaksi/Snap, aset/Figma dan UAT visual yang belum terverifikasi. Tidak menyamakan penerimaan backend atau unit/API dengan kesiapan seluruh produk/deployment.
