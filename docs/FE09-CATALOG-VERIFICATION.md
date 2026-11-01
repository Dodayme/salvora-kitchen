# FE-09 — Admin kategori, produk, foto, dan stok

25 Oktober 2026. PRD 1.9 FR-09/bagian 24; kontrak API 0.13; [CATALOG](CATALOG.md), [audit visual](FE-DESIGN-AUDIT.md).

**Status: Ditinjau.** Implementasi, 387 unit/regresi serta tujuh kelompok controller/HTTP/PostgreSQL test lulus. CRUD/unggahan/stok melalui browser, cancel/keyboard/fokus, pergantian akun dan responsif belum diuji pada tahap ini. Tidak ditandai Selesai. FE-05–FE-08 tetap Ditinjau sesuai laporan masing-masing; keberhasilan backend atau API tidak menutup gap browser.

## Implementasi

| Bagian | Perilaku |
|---|---|
| `/admin/kategori` | Daftar server berhalaman 10, pencarian literal dan filter aktif; tambah/ubah nama dan status, konfirmasi hapus. Kategori terpakai ditolak server; nonaktif merupakan pilihan terpisah melalui edit |
| `/admin/produk` | Daftar/filter nama, kategori, aktif dan ketersediaan; pagination server. Tambah/ubah metadata, nonaktif dengan konfirmasi; tidak ada hapus produk historis |
| Pilihan kategori | Membaca kategori tersimpan, pencarian dan pagination sendiri; tidak menganggap halaman pertama sebagai seluruh kategori. Pilihan sebelumnya dipertahankan saat halaman berubah; kategori nonaktif diberi label |
| Form produk | Nama/deskripsi/nominal Rupiah bulat/kategori/aktif/foto. Stok fisik awal hanya saat create. PATCH metadata tidak mengirim stok fisik, reservasi, identitas pemilik atau field internal |
| Stok | Fisik, direservasi dan tersedia dalam unit tanpa Rp. Aktif/nonaktif terpisah dari menipis/habis. Menipis 1–5 tersedia; habis 0. PUT khusus memakai versi `updatedAt` dari GET admin terbaru |
| Konflik stok | RESOURCE_VERSION_CONFLICT/STOCK_RESERVED memblokir pengulangan. Tombol Periksa data terbaru membaca detail lagi dan mengganti form, termasuk versi serta input stok lama. Server tetap otoritas reservasi |
| Foto | Tepat satu JPEG/PNG/WebP, 1–2.000.000 byte. FormData tanpa Content-Type JSON; validasi isi dilakukan server dan hasil disimpan WebP. Preview object URL lokal diberi label belum tersimpan dan dicabut saat selesai/diganti/unmount |
| Pemasangan foto | Pilih file → unggah eksplisit → preview URL yang diterima server → Simpan produk mengirim photoId. File pilihan harus diunggah atau dibatalkan sebelum simpan. Membatalkan pilihan foto baru mengembalikan referensi awal; tidak menjanjikan penghapusan berkas server |
| State dan sesi | Loading/error/kosong/retry, validasi sebelum kirim, pending, cooldown 429, konflik dan hasil belum pasti. Pembacaan lama diabaikan saat path/akun berubah; layout memakai gate ADMIN dan API memeriksa otorisasi sebenarnya |

Tambah/edit memakai dialog pada halaman daftar, bukan route form terpisah. Dialog membatasi tinggi/scroll; klik di luar tidak menutup. Escape, X dan Batal ditahan selama mutasi berjalan. Kunci yang sama mencegah unggah dan simpan berjalan bersamaan. Penutupan setelah sukses dilakukan sesudah kunci dilepas. `PageNav` kini menggunakan `type="button"` agar navigasi kategori di dalam form tidak mengirim formulir produk.

Jaringan/protokol/5xx atau konflik menghasilkan kebutuhan pemeriksaan ulang, tanpa retry otomatis POST/PATCH/PUT/DELETE. Uji respons hilang membuktikan controller yang sama tidak mengirim ulang. Ini **bukan jaminan exactly-once create katalog setelah refresh atau membuka form baru**; endpoint katalog tidak memiliki idempotency key. Periksa daftar sebelum mengulangi tindakan yang hasilnya belum pasti.

Cancel dialog hanya membuang draft browser. Unggahan yang sudah diterima tetapi belum dipasang dapat tetap menjadi foto pending di server; tidak ada endpoint hapus/GC foto dalam kontrak. Tidak menambahkan penghapusan otomatis atau menghapus foto lama. Foto legacy `imageUrl` tetap ditampilkan; task ini tidak menambahkan tindakan hapus universal untuk foto legacy.

## Sumber visual dan perubahan

PNG `.Desain/Kelola Produk -_ Tambah Produk - Admin.png` dan `.Desain/Kategori Produk fiks - Admin.png` diperiksa sebagai referensi panel foto/form, kartu putih, peach/oranye dan judul serif. Gambar desain tidak menjadi aset UI. Harga tetap Rp; stok berupa unit. Status aktif terpisah dari stok habis; sidebar menandai Produk/Kategori. Tidak menambah promo umum, settings, impor atau aksi lain yang tidak tersedia pada API. Figma tidak dipanggil ulang setelah batas kuota yang sudah dicatat FE-00; kesamaan render belum diklaim.

Berkas utama:

- `src/app/admin/produk/page.tsx`, `src/app/admin/kategori/page.tsx`: dua route baru.
- `src/components/admin/product-screens.tsx`, `category-screens.tsx`, `catalog-hooks.tsx`: halaman, picker, dialog, GET terbaru dan lifecycle mutasi.
- `src/lib/admin-client/catalog-model.ts`, `action-controller.ts`: validasi/decoder/payload whitelist, multipart, filter, kunci mutasi, cooldown dan hasil belum pasti.
- `src/components/admin/admin-shell.tsx`: mengaktifkan dua menu yang sudah diimplementasikan. Pesanan/Pembayaran/Voucher tetap belum tersedia.
- `src/components/shared/page-nav.tsx`: tombol pagination tidak melakukan submit form.
- `tests/admin-catalog-client.test.ts`: 28 tes baru.
- `scripts/verify-admin-catalog-client.mjs`: HTTP nyata/test DB, namespace fixture baru, cleanup terarah dan fingerprint database/foto.

Service/API backend, schema/migrasi, PRD, dependency, `.env`, konfigurasi pembayaran, Scheduled Task dan database dev tidak diubah. Tidak membuat transaksi provider atau menjalankan worker/rekonsiliasi manual.

## Pemeriksaan aktual

| Perintah | Hasil dan batas |
|---|---|
| `npm.cmd test -- tests/admin-catalog-client.test.ts` | 28 tes baru lulus: whitelist create/patch, Unicode code points, integer/version, filter literal, foto/batas/MIME/multipart, shared lock, close/pending, konflik/unknown tanpa replay, 429 dan lifecycle auth/dispose |
| `npm.cmd test` | **22 file / 387 tes lulus**, termasuk regresi sebelumnya; bukan suite PostgreSQL atau tes DOM |
| `npm.cmd run lint` | Lulus |
| `npm.cmd run typecheck` | Lulus |
| `npm.cmd run build` | Lulus; kedua route admin baru tercantum. Bukan bukti interaksi browser |
| `npm.cmd run check:client` | PASS: **67 source files / 37 browser artifacts / empat nilai privat**, tanpa mencetak nilainya |
| `node --import tsx scripts/verify-admin-catalog-client.mjs` | **PASS tujuh kelompok** controller frontend + HTTP Next production build + PostgreSQL test:55433; cleanup PASS; providerCalls=0; browserTested=false |

Vitest/tsx sempat ditolak sandbox dengan `spawn EPERM`; pemeriksaan yang diperlukan dijalankan ulang dengan izin di luar sandbox. Ini masalah memulai tool, bukan kegagalan pembayaran.

### Cakupan HTTP/SQL nyata

1. Tanpa cookie 401; BUYER mendapatkan 403 untuk katalog admin dan upload. Sesi ADMIN yang kemudian dicabut memperoleh 401.
2. Tambah kategori melalui payload/controller frontend; duplikat 409 RESOURCE_EXISTS. Dua halaman kategori tersimpan berisi 10+2 baris berbeda dengan total 12. Hapus kategori kosong berhasil; kategori terpakai mendapat 409 RESOURCE_IN_USE.
3. PNG kecil valid melalui FormData diterima/dikonversi WebP. Berkas bertipe PNG tetapi korup ditolak 422. Foto pending 404 untuk publik, 200 WebP bagi admin; sesudah dipasang pada produk aktif dapat dibaca publik. Batas ukuran/jumlah/MIME client diuji unit; bukan browser drag/drop atau bukti seluruh format file nyata.
4. Tambah produk, filter kategori/pencarian literal `%_`, detail publik, foto terpasang dan PATCH metadata berhasil. Stok palsu pada draft edit tidak ikut payload dan fisik tetap 12. Snapshot OrderItem sintetis sebelum–sesudah perubahan harga/nonaktif sama persis.
5. PUT stok menghasilkan LOW; filter LOW/aktif menemukan produk. Versi lama ditolak RESOURCE_VERSION_CONFLICT dan stok di bawah reservasi ditolak STOCK_RESERVED; controller memerlukan reload. GET publik membuktikan OUT_OF_STOCK ketika semua stok terreservasi. Setelah GET versi baru, PUT fisik 6 dengan reservasi 5 berhasil dan tersedia 1.
6. Nonaktif kategori menyembunyikan produk/fotonya; kategori diaktifkan lagi lalu produk dinonaktifkan dan hilang dari publik. Filter admin nonaktif tetap menemukannya. Respons create produk sengaja hilang setelah commit: tepat satu produk tercatat dan controller tidak mengirim POST kedua.
7. Sesi admin dicabut dan akses ditolak; allowlist transport tidak membuka payments/reconcile/webhook/gateway. Kedua key pembayaran child server kosong. Tidak ada mock gateway atau provider nyata yang diperlukan/dipanggil pada task ini.

Order dan reservasi/counter test adalah fixture sintetis, bukan bukti pembayaran atau fulfillment baru. Unit controller/payload dan HTTP nyata tetap berbeda dari React/browser. Pagination produk di browser, error unggah interaktif dan submit dialog belum terbukti.

## Isolasi, hasil, dan riwayat cleanup

Sebelum menulis fixture, harness memverifikasi URL loopback port 55433 serta SQL `current_database()=salvora_kitchen_test`/`inet_server_port()=55433`. Secret auth baru hanya di memori, DATABASE_URL child kosong. Kategori/produk/user/order/foto baru dibatasi ID run. Server test ditutup setelah selesai; tidak mematikan server development pengguna.

Run penutup **25 Oktober 2026 08:33:51 UTC / 15:33:51 WIB**, ID `99bdb947-cc62-453c-ac38-1e073a919a47`, PASS. Artefak tersanitasi `.local/fe09/http-result.json` dan `.local/fe09/99bdb947-cc62-453c-ac38-1e073a919a47-result.json`. Enam belas fingerprint tabel cocok: User, Session, Address, Category, Product, ProductPhoto, Cart, CartItem, Discount, CheckoutQuote, Order, OrderItem, StockReservation, OrderStatusHistory, Payment, Rating. Hash dan daftar berkas/subfolder penyimpanan **test** sebelum–sesudah cocok; user fixture run nol. Ini cakupan 16 tabel tersebut, bukan klaim checksum seluruh cluster. Rate-limit dibersihkan hanya key secret/email/window run yang diketahui.

Riwayat percobaan tetap dibedakan:

- Dua preflight berhenti saat pembacaan arsip foto: checker awal hanya mengizinkan file di root, sementara arsip test lama memiliki subfolder. Belum membuat fixture. Checker diperbaiki menjadi pembacaan rekursif yang menolak symlink; arsip tidak diubah/dihapus.
- Run `fe09-fb3a2690-1681-47ab-86be-37a60d3ef6e4` lolos tujuh kelompok tetapi cleanup mendapat P2003: login BUYER membuat voucher dengan relasi restriktif ke user. Setelah order/produk/kategori/foto milik run telah kosong, dua user dan satu voucher tersisa dibersihkan **hanya berdasarkan dua email fixture persis**. Script recovery ada di `.local/fe09/recover-cleanup.mjs`; bukan perintah setup rutin. Tidak menghapus voucher/provider fixture lain. Key rate-limit run gagal tidak dapat diidentifikasi karena secret memori berakhir; dibiarkan kedaluwarsa, tidak dihapus berdasarkan waktu/pola luas.
- Cleanup harness diperbaiki menghapus voucher run sebelum user. Run berikutnya 08:32:13 UTC dan run penutup di atas lulus dengan baseline/foto cocok. Kegagalan cleanup sebelumnya tidak dianggap bukti lulus atau disembunyikan oleh keberhasilan API.

Tidak reset test, menghapus backup/rollback, mengubah data dev, memakai 5432/LanggananKu atau mengubah task Windows.

## Gap penerimaan dan langkah berikutnya

Kriteria browser FE-09 masih terbuka karena konektor browser DOM tidak tersedia pada pemeriksaan sebelumnya dan izin kontrol Chrome timeout; tidak ada bukti baru yang mengatasi keterbatasan tersebut pada task ini. Harness FE-09 di atas **otomatis selesai dan tidak menyediakan sesi browser yang tetap hidup**. Jangan memakai halaman dev untuk menulis fixture penerimaan tanpa menyiapkan target test yang benar. Pada FE-12 siapkan server/browser fixture terisolasi dengan lifecycle cleanup, lalu:

1. Sebagai ADMIN, uji tambah/ubah/nonaktif produk, tambah/ubah/hapus kategori kosong dan penolakan kategori terpakai. Uji cancel tanpa request, filter/pagination termasuk kategori di halaman berikutnya; verifikasi pilihan tetap tersimpan.
2. Uji satu JPEG/PNG/WebP valid, kosong/lebih dari satu/format salah/lebih dari 2.000.000 byte. Bedakan preview lokal, foto diterima, dan asosiasi setelah simpan; cancel sebelum/sesudah unggah. Periksa multipart melalui network tanpa menyalin cookie/output rahasia.
3. Uji dua editor stok dengan versi berbeda dan perubahan reservasi; konflik wajib GET ulang, input lama tidak dikirim otomatis. Uji pending double-click, X/Escape/Batal dan kehilangan respons; jangan menciptakan produk kedua tanpa memeriksa daftar.
4. Periksa BUYER/anonymous/expiry/logout/pergantian akun, error/loading/kosong/429 serta privasi. Periksa 360/768/1440px, foto, teks panjang, scroll dialog, Tab/fokus dan tidak ada submit saat pagination kategori diklik.

Simpan bukti browser dan cleanup sebelum menandai FE-09 Selesai. FE-10 dapat mengerjakan pesanan/pembayaran/catatan/fulfillment admin, dengan gap FE-05–FE-09 tetap tercatat. Tidak menyamakan hasil frontend task ini dengan penerimaan Figma/UAT seluruh produk atau deployment.
