# FE-02 — Autentikasi, sesi dan navigasi peran

24 Oktober 2026. PRD 1.9 FR-01/FR-14, kontrak API 0.13. **Selesai untuk fungsi FE-02**; hasil ini tidak menutup penerimaan visual Figma seluruh produk, dashboard operasional atau deployment. Backend/schema/konfigurasi pembayaran/task Windows tidak diubah.

## Implementasi

| Bagian | Hasil |
|---|---|
| `/login`, `/register` | Email/password; registrasi menambah name/confirmPassword. Label/hint/error, fokus keyboard, toggle password, pending dan pencegahan submit ganda. Tidak ada gender/alamat/remember-me/reset password/social login |
| Validasi | Nama trim 2–100, email trim/lowercase/maks 254, password minimal 8 karakter Unicode dan maks 72 byte UTF-8 tanpa trim, konfirmasi sama. Validasi server tetap otoritatif; path/kode field 422 dipetakan menjadi pesan aman |
| Sesi | POST login/register diikuti GET `/api/auth/session` untuk mengonfirmasi cookie browser. Tidak menganggap JSON `{user}` saja membuktikan cookie tersimpan. Tidak menyimpan token, password atau akun di localStorage/sessionStorage |
| Logout | POST `/api/auth/logout` dengan `{}`; hanya respons berhasil menavigasi ke beranda. Identitas lama disembunyikan sejak permintaan dimulai. Jika gagal, tampilkan error/periksa sesi, tanpa klaim logout berhasil atau POST retry otomatis |
| Header/drawer | Guest Masuk/Daftar; BUYER Akun saya/Keluar; ADMIN Area admin/Keluar. Tidak menautkan halaman pesanan/alamat/keranjang yang belum diimplementasikan |
| `/akun` | Ringkasan akun pembeli milik sesi server. Bukan form edit atau dashboard transaksi |
| `/admin` dan layout admin | Pintu masuk admin dengan ringkasan akun; dashboard/sidebar operasional tetap FE-08. Pembeli ditolak di UI; admin tidak diperlakukan sebagai pembeli pada `/akun` |
| Return path | Allowlist route UI internal; origin lain, protocol-relative, backslash, kontrol/whitespace, percent-encoded path, traversal, API/auth/dev dan query sensitif ditolak. Filter katalog page/categoryId yang sederhana serta hash ulasan diperbolehkan. Role diperiksa lagi setelah server mengenali akun. Default BUYER `/`, ADMIN `/admin` |

Source utama: `src/lib/auth-client/model.ts`, `session-store.ts`, `src/components/auth/*`, route login/register/akun/admin, root layout dan PublicShell. Tidak mengimpor validasi server yang memakai Buffer ke browser; batas Unicode/byte frontend menggunakan TextEncoder. DTO sesi di-whitelist kembali.

## Lifecycle dan batas proteksi

`SessionProvider` menggunakan store teruji dan useSyncExternalStore dengan snapshot SSR awal yang stabil. Revalidasi dilakukan saat mount/perubahan path, fokus, pageshow dan kembali terlihat. Tab tersembunyi menyembunyikan identitas; tab aktif memeriksa GET sesi setiap 60 detik. Pemeriksaan latar dengan identitas sama tidak mereset draft fitur; pergantian akun/peran, sesi hilang atau error menghapus/membongkar tampilan pribadi. Tidak ada GET yang memanggil provider pembayaran.

Request generasi lama dibatalkan/diabaikan, termasuk transport yang mengabaikan AbortSignal. Mutasi auth diserialkan; pembacaan sesi tidak menimpa hasil mutasi berjalan. BroadcastChannel hanya mengirim konstanta changing/changed, tanpa PII/token; changing menyembunyikan identitas tab lain, changed meminta pembacaan server baru. Pengujian lintas dua tab/BFCache pada semua browser belum dilakukan; handler tersedia, bukan klaim matriks browser lengkap.

Fitur privat berikutnya harus memakai `useAccountRequest()` dan `RequireRole`: 401 menghapus akun langsung, 403 meminta peran terbaru. Beri key/cache berdasarkan identitas/revision; jangan mempertahankan cache akun lain. Pemeriksaan berkala membatasi deteksi expiry/revocation yang belum memicu request hingga sekitar satu menit pada tab aktif, bukan deteksi server seketika. 401 dari request privat langsung ditangani.

**RequireRole adalah gate tampilan, bukan otorisasi backend.** Halaman statis `/akun`/`/admin` dapat berstatus HTTP 200 dengan loading, redirect client atau pesan 403. Tidak ada data akun pada HTML statis awal. Resource/API tetap wajib requireSessionUser/role/ownership server yang sudah ada; jangan memasukkan fetch data privat tanpa pemeriksaan server ke children RSC hanya karena ada gate client.

## Lingkungan dan cara menjalankan

```powershell
npm.cmd run dev
```

Buka `http://localhost:3000/login` atau `/register`. Origin browser harus tepat sama dengan NEXT_PUBLIC_APP_URL (scheme/host/port); localhost dan 127.0.0.1 berbeda untuk pemeriksaan Origin. Pemeriksaan konfigurasi lokal menyatakan cocok dengan `http://localhost:3000` dan mode pembayaran produksi false, tanpa mencetak nilai lain. Tidak mengubah `.env.local` atau melonggarkan pemeriksaan Origin backend.

Server PostgreSQL harus hidup untuk API auth. Pada awal task, probe test read-only gagal ECONNREFUSED; tidak ada fixture ditulis. Pengguna kemudian menjalankan pg_ctl secara manual dan mengonfirmasi server started. Probe ulang memverifikasi `salvora_kitchen_test`, PostgreSQL 18.6, port 55433. Agent tidak menyalakan cluster, mengubah task Windows, atau memeriksa tick pembayaran sebagai bagian FE-02.

### Harness browser opt-in

```powershell
npm.cmd run build
node --import tsx scripts/verify-auth-ui.mjs --mock
# ATAU, hanya jika database test existing sudah hidup dan terverifikasi:
node --import tsx scripts/verify-auth-ui.mjs --test-db
```

Jangan jalankan dua mode bersamaan. Harness menyalakan Next dari build pada loopback acak dan proxy hanya mengizinkan empat endpoint auth. Mode test-db memakai NODE_ENV=test, DATABASE_URL kosong, TEST_DATABASE_URL tervalidasi/nama test/host loopback/55433 serta secret fixture baru. Semua key provider dikosongkan. Tidak ada migrasi/seed/reset/startup PostgreSQL/worker manual. Mode mock tidak membuka DB sama sekali.

URL/pointer berada di `.local/fe02/current.json`; kredensial fixture baru berada di file private run yang disebut pointer, diabaikan Git dan tidak dicetak. Hanya gunakan identitas fixture tersebut dalam browser uji. Jangan mengirim file private/password/cookie melalui chat atau memasukkannya ke aset frontend. File lama bukan kredensial aplikasi; fixture sudah dihapus saat stop.

Kontrol berikut memakai file lokal milik run (tidak membuat endpoint kontrol pada aplikasi), dapat dijalankan dari terminal kedua selagi harness berstatus READY:

```powershell
node --import tsx scripts/verify-auth-ui.mjs --control expire
node --import tsx scripts/verify-auth-ui.mjs --control demote
node --import tsx scripts/verify-auth-ui.mjs --control limit
node --import tsx scripts/verify-auth-ui.mjs --control summary
node --import tsx scripts/verify-auth-ui.mjs --control stop
```

expire hanya mencabut sesi akun fixture; demote hanya mengubah admin fixture menjadi BUYER; limit mengisi counter email fixture terbatas untuk menguji 429 tanpa serangkaian percobaan mahal. fail-session/fail-logout/restore hanya mensimulasikan gangguan pada mode mock. Tunggu output CONTROLLED/STOPPED; QUEUED belum membuktikan kontrol telah diterapkan. Gunakan **stop** untuk cleanup terarah dan penghentian server. stdin exec non-TTY dapat tertutup, sehingga kontrol file disediakan; jangan mengandalkan Ctrl+C untuk cleanup test-db.

## Hasil aktual

| Lapisan | Bukti 24 Oktober 2026 |
|---|---|
| Unit HTTP in-memory | 41 tes auth baru: return path berbahaya/peran, Unicode/byte/konfirmasi, DTO/field whitelist, sesi/null/SSR, race GET, cookie confirmation, serialisasi, logout gagal, tanpa replay POST, expiry, background refresh, request privat 401/403 dan suspend |
| Regresi unit | `npm.cmd test`: **15 file / 183 lulus**, termasuk 41 baru; bukan suite integrasi PostgreSQL lengkap |
| Statis/build | lint, typecheck dan build lulus. check:client lulus pada 33 file grafik sumber/23 artefak browser; 4 nilai privat dicocokkan tanpa dicetak. Tidak ditemukan impor/marker/nilai privat yang diperiksa |
| Browser + API Next nyata + PostgreSQL test | Satu register 201 dan satu duplicate 409; empat login 200, dua invalid credentials 401; empat logout 200; satu limiter 429; 35 GET sesi 200. Browser mengonfirmasi akun/cookie, tujuan kembali aman, loading/disabled, error generik, admin default `/admin`, penolakan lintas peran, pencabutan sesi fixture dan peran fixture yang berubah, serta drawer akun/logout ponsel |
| Pembatasan HTTP | Angka 403 di halaman adalah **penolakan UI**. Otorisasi endpoint backend tetap implementasi BE-03; FE-02 tidak mengklaim HTML statis berstatus HTTP 403 |
| Browser + API mock | Registrasi/login/logout dan peran diuji terpisah; run akhir memeriksa fokus error, pemetaan field HTTP 422, logout 503 yang menghilangkan ringkasan pribadi, serta GET sesi 503 yang menonaktifkan form. Run akhir: login 401×1/200×1, register 422×1, logout 503×1, sesi 200×5/503×3. Tidak disamakan dengan DB/provider nyata |
| Cleanup DB | Dua user fixture dan satu voucher fixture, nol pesanan. Stop selesai exit 0; setelah cleanup user/voucher/order fixture seluruhnya 0. Fingerprint Order/Payment/Rating/Product/Category dan User non-fixture cocok sebelum–sesudah **cleanup**. Ini tidak diklaim fingerprint sejak awal seluruh task |
| Responsif | Login/register dan navigasi akun diperiksa di 360/768/1440px, tanpa overflow horizontal halaman yang diperiksa. Bukti lokal `login-1440.jpg`, `register-360.jpg`, `register-768.jpg` di `.local/fe02`; form kosong tanpa kredensial |
| Provider/operasional | Nol panggilan provider/worker manual; tidak membuat pesanan/pembayaran, mengganti DB 5432, mengubah database dev atau task Windows. Tidak memverifikasi tick scheduler baru pada FE-02 |

Ringkasan tersanitasi tersimpan pada `.local/fe02/test-db-results.json` dan `cleanup-result.json`. Screenshot dan file private tidak menjadi aset publik. Browser otomatis sempat sangat lambat saat membuka origin baru; verifikasi interaksi selanjutnya berhasil. Ini tidak dijadikan pengukuran performa produk.

Perbaikan yang ditemukan: fokus error berbasis requestAnimationFrame dapat terjadi sebelum notice terpasang. Diganti effect setelah commit DOM; browser mock akhir membuktikan role=alert menerima fokus. Tidak mengubah logika auth backend.

## Batas visual dan serah terima

Form memakai tema/font/shadcn FE-01, komposisi form dan koreksi PRD dari Login.png/Register.png. Logo, pola latar dan kolase makanan auth **belum tersedia sebagai file terpisah**; tidak dipotong dari screenshot, digambar ulang atau diganti dengan foto lain. Panel teks merupakan komposisi sementara, bukan klaim implementasi Figma identik. Kuota Figma yang dicatat FE-00 tidak dicoba ulang. Export aset auth/identitas dan penerimaan visual tetap gap FE-02/FE-12 yang terbuka; penyelesaian fungsi tidak menghapus gap ini.

FE-03 siap memakai sesi/peran dan request browser ini untuk katalog publik/add-to-cart sesuai dependensi. FE-04/07/08 dan seterusnya tetap belum dikerjakan. Deployment HTTPS/cookie Secure, semua perangkat/browser, BFCache/lintas tab penuh, dan UAT visual/produk tetap terpisah.
