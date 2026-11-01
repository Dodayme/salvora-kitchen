# FE-04 — Alamat, keranjang, dan informasi voucher

Implementasi dan browser/API: **24 Oktober 2026**. Pemeriksaan penutup dan pemulihan setup setelah restart: **25 Oktober 2026**. Acuan PRD 1.9 FR-03/04/05, kontrak API 0.13, [audit desain](FE-DESIGN-AUDIT.md) dan [hasil FE-03](FE03-CATALOG-VERIFICATION.md).

**Status: selesai untuk fungsi FE-04.** Penerimaan visual seluruh produk tetap FE-12. Pemilihan alamat pengiriman, quote, total akhir, dan konfirmasi checkout adalah FE-05. Tidak ada perubahan schema, service backend, kontrak, dependensi, konfigurasi pembayaran, atau action/status/jadwal task Windows.

## Implementasi

| Bagian | Hasil |
|---|---|
| `/keranjang` | BUYER; GET cart, PATCH jumlah absolut, DELETE dengan konfirmasi lalu GET. Harga, jumlah, stok, subtotal item dan subtotal barang berasal dari server. Loading/kosong/error, jumlah invalid, stok berubah dan item unavailable ditangani |
| Badge | Jumlah **unit**, penjumlahan quantity dari cart nyata. Refresh setelah add/edit/delete dan tindakan pemulihan GET; sinyal invalidasi antar-tab hanya konstanta, tanpa PII. Saat belum diketahui/error tampil `—`, bukan angka nol palsu |
| `/alamat` | BUYER; daftar milik sendiri, enam per halaman, dialog tambah/ubah dan konfirmasi hapus. Tidak mengubah snapshot pesanan lama. Halaman yang menjadi kosong setelah delete tetap eksplisit dan menyediakan kembali ke halaman pertama |
| Form | Penerima 1–100, telepon 6–32 dengan prefix/string terjaga, alamat 1–2.000, kota/provinsi 1–100, kode pos opsional 16, catatan opsional 1.000. Trim, null untuk mengosongkan field opsional, fokus ke field invalid. Tidak mengirim ownerId atau id dari draft |
| Voucher | GET `/api/me/voucher`; AVAILABLE/RESERVED/USED/null dengan penjelasan. Aturan tetap 20%, maksimal Rp100.000, sekali pakai, subtotal barang tanpa ongkir. AVAILABLE bukan jaminan reservasi atau kelayakan checkout |
| Navigasi | Keranjang pada header/drawer BUYER; kelola alamat dan keranjang dari akun. Anonymous diarahkan login memakai return path tervalidasi; ADMIN mendapat pembatasan UI |
| Data privat | Pembacaan terkait akun, revisi sesi dan path; request lama dibatalkan/diabaikan. RequireRole meremount state privat ketika sesi berubah. API tetap otoritas akses; HTML halaman terlindungi dapat HTTP 200 dengan gate UI |

Mutasi dijalankan hanya dari tindakan pengguna, dengan lock klik ganda. Tidak ada replay otomatis. Network/protocol/5xx dianggap belum pasti; 404/409 memerlukan pembacaan ulang. Tombol mutasi dikunci sampai pengguna memeriksa data terbaru. Retry-After menahan pengiriman ulang. Tidak menyimpan alamat, cart atau sesi ke localStorage.

Jika CART_TOTAL_LIMIT muncul setelah pembacaan berhasil, subtotal disembunyikan dan ID item dari pembacaan sebelumnya pada akun/revisi yang sama hanya dipakai untuk menawarkan penghapusan terkonfirmasi. Data itu dilabeli lama dan tidak dipercaya sebagai harga baru. **Batas kontrak:** jika GET pertama sudah gagal karena batas total, API tidak memberikan daftar ID; UI meminta pemeriksaan harga oleh admin, tanpa menebak atau membuka endpoint baru.

Keranjang tidak mereservasi stok/harga/voucher. Informasi delivery mengikuti keputusan aktif: Kota Tanjungpinang, Kepulauan Riau, Rp10.000 per pesanan. Tidak ada tombol checkout aktif sebelum FE-05.

## Berkas

- `src/lib/buyer-client/model.ts`: decoder DTO whitelist, validasi draft dan kategori pemulihan mutasi.
- `src/components/buyer/`: pembacaan privat, mutasi, badge, keranjang, voucher dan alamat.
- `src/app/keranjang/page.tsx`, `src/app/alamat/page.tsx`: route dan gate BUYER.
- `src/components/layout/public-shell.tsx`, `src/components/auth/account-summary.tsx`, `src/components/catalog/add-to-cart.tsx`: navigasi dan invalidasi cart.
- `src/components/catalog/product-photo.tsx`: fallback ikon ringkas untuk thumbnail keranjang; label aksesibel tetap ada. Default kartu/detail tetap memakai penjelasan foto.
- `src/components/shared/page-nav.tsx`: teks jelas untuk page yang sudah melewati hasil setelah penghapusan.
- `tests/buyer-client.test.ts`: 27 tes baru pada batas data/validasi/pemulihan; bukan tes provider.
- `scripts/verify-auth-ui.mjs`, `scripts/catalog-ui-fixtures.mjs`: mode opt-in `--buyer`, allowlist API, fixture/kontrol dan cleanup khusus run.

## Bukti verifikasi

| Lingkungan/tanggal | Hasil aktual dan batas |
|---|---|
| Unit/regresi, 24 dan 25 Oktober | **17 file / 245 tes lulus**; 27 baru untuk FE-04. DTO privat tersaring, validasi alamat/telepon/null, tiga state voucher dan mutasi belum pasti/konflik diperiksa in-memory |
| Pemeriksaan final 25 Oktober | `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run build`, `npm.cmd run check:client` lulus. Boundary: 46 source files, 27 browser artifacts, empat nilai privat diperiksa tanpa dicetak |
| Build sebelum restart | Sebagian percobaan sandbox ditolak spawn EPERM; pengulangan berizin menghasilkan build. Proses penutup terputus oleh restart, sehingga bukti penutup diperbarui dengan build exit 0 pada 25 Oktober |
| Browser + Next/API PostgreSQL test, run 1, 24 Oktober | Tamu diarahkan ke login/return keranjang; register, kosong, add, PATCH absolut 1→2, DELETE/batal, validasi jumlah 0, stok berubah/409 dan pemulihan ke 1. Alamat create/update/clear optional/delete/batal; invalid kosong memfokuskan penerima; catatan `<script>` tampil literal |
| Respons hilang terkendali, run 1 | Satu POST alamat dan satu PATCH cart benar-benar commit, lalu harness mengganti respons menjadi 503. UI mengunci simpan dan GET memulihkan satu alamat baru/jumlah 3 tanpa replay mutasi. Ini fault injection setelah API nyata, bukan gangguan jaringan/provider nyata |
| Voucher run 1 | AVAILABLE dari API nyata. RESERVED, USED dan null **tiga overlay mock**, tanpa membuat pesanan atau mengubah voucher menjadi status pembayaran secara manual |
| Browser retest, run 2, 24 Oktober | Bug badge setelah pemulihan ditemukan dan diperbaiki. PATCH respons hilang → GET membuktikan badge dan quantity sama-sama 3. Harga fixture 3.500→4.500 → subtotal 13.500 dari server. Harga overflow → GET 409, tanpa subtotal palsu, DELETE memulihkan cart kosong |
| Alamat/role/sesi, run 2 | Tujuh alamat fixture → halaman 6+1; hapus alamat terakhir pada page 2 → empty dengan navigasi kembali. Sesi dicabut → GET cart/addresses 401 dan login tanpa data privat lama. Login admin dan akses langsung cart → gate UI 403; tidak diklaim HTTP document 403 |
| Responsif, run 2 | Keranjang 360/768/1024 serta screenshot desktop 1440; alamat/dialog 360. Pemeriksaan DOM tidak menemukan overflow pada lebar yang disebut; dialog mobile lebar 328px. Pemeriksaan ini bukan seluruh matriks FE-12 |
| Penutup 25 Oktober, run 3 | HTTP test nyata: registrasi fixture dan add 2 unit menghasilkan subtotal 7.000. Browser connector tidak tersedia setelah restart, sehingga **tidak mengklaim retest browser final**. Dua perubahan kecil terakhir (fallback ikon ringkas dan teks page kosong) lolos statis/build, masih perlu pemeriksaan visual FE-12 |

Tidak menjalankan suite PostgreSQL backend besar yang bukti validnya sudah ada. Tidak ada pembayaran, worker/reconcile manual, order test baru, atau panggilan gateway oleh harness FE-04. Catatan hitungan endpoint run 1/2 berasal dari output harness yang diamati saat itu; file cleanup tersanitasi di bawah tetap tersedia. Output lama harness menyebut `auth fixtures only` terlalu sempit; implementasi memang juga menulis fixture katalog/cart/alamat. Label diperbaiki pada run 3, tanpa menimpa hasil lama.

## Isolasi dan cleanup

Setiap run memvalidasi URL **dan identitas SQL** `salvora_kitchen_test:55433` sebelum membuat fixture. Node/Next memakai environment test, DATABASE_URL kosong, secret sesi baru dan key provider kosong; proxy memblokir order/payment/provider. Tidak ada reset, migrasi, bootstrap, fallback 5432, atau perubahan fixture provider lama.

Cleanup menolak jika fixture memperoleh referensi order. Penghapusan dibatasi ID/kategori/email acak milik run; cart/user/address fixture dibersihkan, bukan data global. Fingerprint count/digest delapan tabel sebelum dan sesudah cocok: Category, Product, Order, Payment, Rating, Address, Cart, CartItem. Setiap run menyisakan **0 user fixture** dan exit 0.

| Run | Cleanup UTC | Respons commit sengaja hilang | Overlay voucher | Fingerprint |
|---|---|---:|---:|---|
| 1 | 2026-10-24 13:58:41 | 2 | 3 | cocok |
| 2 | 2026-10-24 14:02:47 | 1 | 0 | cocok |
| 3 | 2026-10-25 06:04:38 | 0 | 0 | cocok |

Artefak lokal yang diabaikan Git: `.local/fe04/cleanup-first-run.json`, `cleanup-second-run.json`, `cleanup-result.json`; screenshot `address-360.jpg`, `address-dialog-360.jpg`, `cart-360.jpg`, `cart-1440.jpg`. Screenshot cart berasal dari run 2 sebelum fallback ikon dipadatkan; tidak dianggap tangkapan build final. Manifest kredensial test juga berada di direktori privat ini dan **tidak boleh dibagikan**; akun fixture sudah dihapus.

## Setup setelah restart, 25 Oktober

Pengguna meminta menyalakan setup FE/BE. Pemeriksaan menemukan listener 55433/3000 tidak ada, PG_VERSION 18, binary PostgreSQL 18.6, marker root/owner/port cocok dengan proyek. `pg_ctl status` melaporkan no server running. Startup minimal cluster existing menggunakan `pg_ctl -D .local\postgres\data -l .local\postgres\server.log start -w` dijalankan setelah instruksi pengguna; sandbox menolak restricted token 87, pengulangan berizin berhasil. Pesan stale `another server might be running` tidak diatasi dengan menghapus PID, initdb, atau mengganti port.

`npm.cmd run dev -- --hostname localhost --port 3000` aktif; SQL read-only `db:check` mengonfirmasi dev PostgreSQL 18.6, dua kategori/dua produk demo, satu admin dan nol order. Home, health, cart dan alamat document HTTP 200. Health/document bukan bukti otorisasi atau pembayaran. Metadata task read-only 13:04:37 WIB: Ready/PT1M/LastTaskResult=0; tanpa korelasi report worker baru, ini **belum bukti lengkap tick rekonsiliasi berhasil**. Task/action/status/jadwal tidak diubah, worker tidak dijalankan manual. Startup database dapat membuat tick otomatis aktif kembali; itu sudah dijelaskan sebelum startup.

Frontend dan backend memakai satu Next.js pada **http://localhost:3000**, database khusus tetap 55433. Hanya harness sementara FE-04 yang dihentikan; development server dibiarkan aktif untuk pengguna.

## Menjalankan verifikasi berikutnya

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
npm.cmd run check:client
node --import tsx scripts/verify-auth-ui.mjs --test-db --buyer
```

Harness memerlukan build dan database test yang sudah hidup; tidak menyalakan PostgreSQL. Interaksi browser memakai akun fixture lokal dari manifest privat, tidak akun dev. Kontrol contoh: `--buyer --control addresses-page`, `price-change`, `price-overflow`, `stock-low`, `cart-response-lost`, `address-response-lost`, `voucher-reserved-mock`, `voucher-used-mock`, `voucher-null-mock`, `expire`; akhiri dengan `--buyer --control stop` dan periksa cleanup PASS. Kontrol hanya untuk fixture run aktif; tidak boleh diarahkan ke dev atau dijalankan pada run lama.

Desain alamat/keranjang individual belum tersedia di audit; layout diturunkan dari tema, form, kartu dan primitive yang ada. Tidak mencoba ulang kuota Figma atau mengubah screenshot menjadi aset produk. Logo/aset resmi dan penerimaan visual tetap terbuka. **FE-05 siap dimulai** dengan sumber alamat/cart/voucher ini; pilihan addressId dan otoritas total harus tetap quote server.
