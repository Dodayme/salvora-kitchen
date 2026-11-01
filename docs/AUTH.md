# Autentikasi dan otorisasi — BE-03

Tanggal: 23 Oktober 2026. Acuan: PRD 1.4 FR-01, FR-14, bagian 5/16; [API-CONTRACT.md](API-CONTRACT.md). Endpoint backend tersedia; halaman login/register/dashboard lengkap belum menjadi hasil task ini.

## Endpoint yang sudah tersedia

**Frontend 24 Oktober 2026:** fungsi FE-02 tersedia pada `/login`, `/register`, `/akun` dan pintu masuk `/admin`, dengan sesi/peran dari endpoint yang sama. Bukti browser API nyata, unit, mock, cleanup dan batas visual: [FE02-AUTH-VERIFICATION.md](FE02-AUTH-VERIFICATION.md). Paragraf UI belum tersedia pada catatan BE-03 di bawah adalah histori sebelum FE-02; backend tidak diubah oleh implementasi frontend.

| Metode/path | Akses dan hasil |
|---|---|
| `POST /api/auth/register` | Publik + Origin; `{name,email,password,confirmPassword}` → 201 `{user}`, cookie sesi baru; selalu BUYER |
| `POST /api/auth/login` | Publik + Origin; `{email,password}` → 200 `{user}`, cookie sesi baru dengan rotasi cookie browser sebelumnya |
| `POST /api/auth/logout` | Origin; body `{}` → 200 `null`, revoke sesi di DB lalu hapus cookie; tanpa sesi/diulang tetap aman |
| `GET /api/auth/session` | 200 `{user:null}` untuk cookie hilang/tidak valid/expired/revoked; 200 `{user}` untuk sesi valid |
| `GET /api/admin/me` | Sesi ADMIN → 200 User miliknya; anonymous 401, BUYER 403 |
| `PATCH /api/admin/me` | ADMIN + Origin; hanya `{name}` → 200 User miliknya; semua atribut tambahan ditolak |

Response memakai envelope/error bersama, requestId dan Cache-Control no-store. Respons user whitelist hanya `id,name,email,role`, tanpa password hash, token/digest sesi atau AUTH_SECRET. Frontend memakai `data.user.role` hasil server untuk navigasi peran saat halaman terkait diintegrasikan; API JSON ini tidak mengalihkan ke halaman dashboard yang belum dibuat. Menu/tombol frontend tetap perlu mengikuti izin server.

Konfigurasi lokal dibaca dari `.env.local` Salvora: DATABASE_URL, AUTH_SECRET dan NEXT_PUBLIC_APP_URL. Kunci Midtrans tidak diperlukan. Pada HTTPS/production gunakan URL aplikasi HTTPS yang tepat. Tidak ada akun baru yang disalin dari LanggananKu. Admin demo internal hasil BE-02 tetap tersedia melalui kredensial privat `.local/admin-demo.json`; BE-03 tidak mengubah password/nama/role akun tersebut untuk pengujian.

## Validasi akun dan profil

- Nama trim 2–100 karakter; email trim/lowercase, format valid, maksimum 254 karakter dan unique constraint. Password tidak ditrim, minimal 8 karakter Unicode, maksimum 72 byte UTF-8 (batas bcrypt); konfirmasi harus sama.
- Registrasi public strict object: tidak menerima role/id/isFirstPurchase, gender/avatar atau alamat. Role BUYER juga ditulis eksplisit pada server. Konflik unique user menghasilkan 409 EMAIL_EXISTS, termasuk registrasi bersamaan.
- Login memeriksa hash bcrypt cost 12. Email tidak ada dan password salah memakai status 401/kode INVALID_CREDENTIALS/pesan yang sama: “Email atau kata sandi salah.” Untuk email tidak ditemukan, tetap lakukan bcrypt compare terhadap dummy hash cost 12 yang bukan akun pengguna. Ini menyetarakan pekerjaan hash, bukan klaim seluruh waktu jaringan selalu identik.
- Profil hanya memakai ID dari sesi; tidak ada endpoint edit pengguna lain. PATCH menerima nama saja: id/userId/email/role/password ditolak dengan 422; role pengguna biasa tidak dapat dinaikkan. Tidak ada UI perubahan email/password atau provisioning admin publik.

## Sesi dan CSRF

Token cookie adalah 32 byte acak crypto, representasi 64 hex. Database hanya menyimpan digest HMAC-SHA256 dengan AUTH_SECRET milik Salvora; token mentah tidak masuk JSON/log. Cookie `salvora_session` memiliki HttpOnly, SameSite=Lax, path `/`, host-only, max-age 604800 detik, expires 7 hari. Secure dipasang jika URL aplikasi HTTPS, termasuk HTTPS saat development. TTL absolut, tidak diperpanjang hanya karena GET sesi. Tidak ada fitur Ingatkan Saya.

Registrasi yang berhasil sekaligus membuat sesi, sebagai login pertama. Login baru merotasi sesi yang disertakan browser: hapus digest lama dan buat digest/token baru dalam satu transaksi. Sesi perangkat lain tetap terpisah; ini bukan fitur logout semua perangkat. Cookie malformed, panjang salah, nama salah atau duplikat yang ambigu tidak diterima sebagai sesi.

User dan role dibaca dari DB untuk setiap resolusi sesi, sehingga perubahan role server tidak ditunda sampai login berikutnya. Expiry diperiksa server meskipun browser masih mengirim cookie lama. Logout mencabut record DB dahulu, baru mengirim cookie kosong max-age 0; replay cookie lama kemudian tidak memberi akses. Jika DB gagal, tidak mengembalikan sukses logout palsu. Pergantian AUTH_SECRET membuat digest sesi lama tidak cocok; perlakukan sebagai operasi internal yang mencabut akses sesi.

Semua mutation browser (register/login/logout/PATCH profil) wajib Origin tepat sama dengan NEXT_PUBLIC_APP_URL, termasuk scheme/host/port, dan JSON sesuai schema. Origin hilang/salah ditolak 403 sebelum pemrosesan kredensial/mutation. Ditambah SameSite=Lax dan tanpa CORS wildcard ber-credentials, ini menjadi mekanisme perlindungan CSRF sesuai pola BE-00. Header Host/forwarded/client userId tidak menjadi sumber izin. Implementasi cookie memakai [NextResponse](https://nextjs.org/docs/app/api-reference/functions/next-response).

GET sesi/profil tidak melakukan perubahan transaksi bisnis. Cookie-backed responses memakai no-store dan Vary: Cookie. Akses pribadi setelah logout harus membaca ulang server; jangan menjadikan cache browser sebagai bukti izin.

## Batas percobaan

Counter tersimpan di PostgreSQL melalui upsert/increment atomik, sehingga berlaku lintas proses Next.js yang memakai AUTH_SECRET/database sama. Kunci counter berupa HMAC dari scope, identitas dan bucket waktu; email/IP mentah tidak disimpan di RateLimit.

| Operasi | Per email ternormalisasi | Global aplikasi |
|---|---|---|
| Login | 10 percobaan per bucket 15 menit | 200 percobaan per bucket 15 menit |
| Registrasi | 5 percobaan per bucket 15 menit | 50 percobaan per bucket 15 menit |

Bucket fixed-window dibatasi setiap seperempat jam UTC, bukan rolling window. Sukses/gagal autentikasi sama-sama dihitung; password salah atau rollback hook tidak menghapus counter. Global diperiksa dahulu, kemudian email; jika global sudah penuh, request tidak melanjutkan compare/hash atau membuka bucket email baru. 429 RATE_LIMITED menyertakan header Retry-After sampai bucket berakhir. Field/schema invalid dan Origin palsu ditolak sebelum hash/autentikasi.

Ini kebijakan teknis awal BE-03. Header IP dari client tidak dipercaya saat kontrak reverse proxy hosting belum dipilih; global cap menjadi pembatas kerja lintas identitas. Setelah hosting O-08 dipilih, batas per jaringan dapat ditambahkan dengan sumber IP proxy yang terverifikasi. Jangan mengaktifkan bypass berdasarkan X-Forwarded-For arbitrary. Record expired tidak lagi mengizinkan sesi atau membatasi bucket baru; cleanup/retensi terjadwal mengikuti infrastruktur hosting nanti.

## Struktur dan kait BE-06

`src/services/auth.ts` mengoordinasikan akun/sesi dan menerima dependency Prisma/settings. `src/lib/auth/server.ts` menyelesaikan dependency server-only secara lazy dan menyediakan `requireSessionUser(request, role?)` untuk endpoint berikutnya. `access.ts` menyediakan pemeriksaan peran/kepemilikan; owner selalu diturunkan dari sesi/data server, bukan body request. `http.ts` menangani Origin/body, respons JSON aman dan Set-Cookie. Route Handlers hanya memasang adapter pada runtime Node.js.

`afterAuthenticatedLogin(transaction,user)` di `src/services/auth-login-hook.ts` adalah titik integrasi BE-06. Dipanggil setelah validasi kredensial dan pembuatan sesi dalam transaksi yang sama; pada registrasi, akun juga berada pada transaksi tersebut. Jika hook gagal, akun/sesi baru dan pencabutan sesi lama di-rollback. BE-06 harus memeriksa BUYER, kelayakan pembelian pertama dan unique voucher di dalam transaksi; jangan membuat efek eksternal yang tidak bisa di-rollback melalui hook.

Pada BE-06, hook telah menerbitkan voucher idempoten untuk BUYER yang memenuhi syarat, termasuk registrasi yang membuat sesi pertama. Transaksi mengunci User sebelum insert sesi untuk mencegah deadlock foreign key pada login bersamaan. isFirstPurchase tidak berubah saat login. BE-06 selesai, termasuk rumus diskon final setelah O-10 ditutup; rincian [VOUCHERS.md](VOUCHERS.md). Penerapan pada checkout/pembayaran tetap BE-07/BE-09.

## Bukti pengujian dan batas cakupan

```powershell
npm.cmd run db:local
npm.cmd test
npm.cmd run test:db
npm.cmd run build
npm.cmd run test:http
npm.cmd run test:http:auth
```

`test:http:auth` memerlukan client/migrasi BE-02 dan build terbaru. Script menyalakan server Next.js sementara dari hasil build dengan **NODE_ENV=test**, TEST_DATABASE_URL eksplisit dan AUTH_SECRET fixture baru. Factory/config server pada mode test hanya menerima database `salvora_kitchen_test`; tidak fallback dev. Credential Midtrans dikosongkan. Fixture pembeli/admin baru dibuat di test, diuji lewat HTTP nyata, lalu user/session dan counter milik fixture dibersihkan; server dihentikan otomatis. Akun admin lokal pribadi tidak dibaca/dipakai. Secure cookie diverifikasi melalui header pada fixture origin HTTPS; penerimaan cookie browser/TLS deployment tetap membutuhkan integrasi frontend/hosting.

Tes PostgreSQL terpisah menguji hash, unique registration bersamaan, rotasi/revokasi/expiry, role terbaru, anonymous/buyer/admin, profil sendiri dan field tambahan, Origin, rollback hook, limiter atomik. Tes unit mencakup validasi byte/karakter password, cookie ambiguity/attributes, digest dan Retry-After. Tes HTTP menguji alur register→login→rotasi→logout, replay cookie lama, expiry, role/profil, CSRF serta 10 percobaan login lalu 429. Pada BE-06 pengujian diperbarui untuk satu voucher pembeli baru, read privat dan id tetap setelah login ulang; isFirstPurchase tidak berubah.

Tidak ada migrasi baru: User/Session/RateLimit BE-02 mencukupi. Tidak mengimplementasikan katalog/alamat/keranjang, voucher BE-06, UI Figma lengkap, pengelolaan akun admin lain, reset password, remember-me, atau pembayaran. Hasil ini mendukung UAT-01/UAT-18/UAT-39 untuk API auth/profil; belum membuktikan seluruh alur belanja, visual/responsif atau target performa produksi.
