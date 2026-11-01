# Diagnosis worker rekonsiliasi — exit code 1

23 Oktober 2026. Lanjutan [audit launcher Windows](WINDOWS-AUTOMATION-AUDIT.md). **Pembaruan setelah pemulihan manual:** SQL dev/test:55433 terverifikasi dan dua tick otomatis 14:09/14:12 WIB COMPLETED/exit 0, checked=0. Ini memulihkan bukti operasional pass antrean kosong, bukan pembayaran. Laporan terbaru [BE14-RECONCILIATION.md](BE14-RECONCILIATION.md). Diagnosis CONNECTION_REFUSED dan rencana startup di bawah bersifat historis saat cluster berhenti; jangan mengulang startup atau mengubah task yang kini Ready/PT1M.

## Penyebab yang dipastikan saat diagnosis awal (historis)

1. Task aktual tetap GUI launcher, WorkingDirectory proyek benar, argumen Node cocok executable lokal, Ready/PT1M. Node aktual yang dicatat worker adalah 24.21.0, sesuai engines >=24.21.0 <25. `npm.cmd ls --depth=0` tidak menunjukkan dependensi hilang; probe berhasil mengimpor config, Prisma/pg, gateway, lock, service rekonsiliasi, batch dan loader TypeScript tanpa membuat client/koneksi.
2. Setelah diagnostik dipasang, **tick otomatis normal** 11:45:37 WIB menulis status FAILED, phase `database_connection`, code `CONNECTION_REFUSED`. Timestamp log worker dan launcher cocok pada tick tersebut; launcher tetap exit 1. Tidak menjalankan worker manual.
3. Probe konfigurasi tanpa koneksi menunjukkan target DEV, loopback, port **55433**. Tidak menampilkan URL, user, password, nama host privat atau key. Windows tidak memiliki listener pada 55433, cluster workspace tidak mempunyai proses server, dan `pg_ctl -D <workspace>/.local/postgres/data status` memberi `no server running`. Ini mengonfirmasi cluster PostgreSQL khusus proyek tidak berjalan saat diagnosis.
4. Ada PostgreSQL lain/listener pada 5432. Itu bukan alasan mengganti DATABASE_URL atau memakai database lain sebagai fallback. Cluster/proyek lain tidak disentuh. File PID proyek masih ada; tidak dihapus, tidak diasumsikan penyebab, dan tidak digunakan sebagai bukti server sehat.

**Kesimpulan:** kegagalan worker saat ini terkonfirmasi pada koneksi ke cluster lokal 55433 yang tidak berjalan, sebelum pengambilan advisory lock atau pemrosesan order/provider. Belum diketahui mengapa cluster berhenti. Tidak mengklaim semua exit 1 historis mempunyai penyebab sama karena log lama tidak menyimpan fase.

## Koreksi hipotesis impor env

Probe impor dinamis menemukan default export `@next/env` undefined sementara named `loadEnvConfig` adalah function. Ini sempat menjadi hipotesis startup. Namun fixture terisolasi dengan **impor statis lama** (`payment-env-legacy-probe.mjs`) menghasilkan DEFAULT_LOADER_AVAILABLE. Perbedaan interop statis/dinamis itu **bukan bukti akar kegagalan worker lama**. Hipotesis env sebagai penyebab ditarik kembali; konfigurasi aktual lolos dan worker mencapai fase koneksi database.

Resolver loader sekarang menerima named export dan bentuk legacy default secara eksplisit. Ini penguatan ketahanan/diagnostik, bukan bukti perbaikan masalah env yang sebelumnya terjadi.

## Alur peluncuran dan batas indikator konsol

- Task menunjuk `.local/automation/SalvoraPaymentLauncher.exe` dengan satu argumen path node.exe. Launcher menurunkan root dari lokasi binary `.local/automation`, bukan cwd acak.
- Argumen Node adalah `--import <file URL loader tsx> <path worker>`, keduanya path tetap milik workspace. WorkingDirectory diset root. Tidak menerima script arbitrer dan tidak menjalankan shell per tick.
- ProcessStartInfo tidak mengganti environment, sehingga anak mewarisi environment task. Probe terminal tidak membuktikan seluruh env task sama; bukti aktual worker memastikan konfigurasi telah lolos pada tick yang dibaca. Loader env menggunakan root proyek, perilaku development=true dipertahankan, dengan prioritas env bawaan `@next/env` dan tanpa menyalin env proyek lain.
- Worker menjaga arti exit 0 (pass selesai/lock dipakai worker lain), 1 (kegagalan infrastruktur/startup/cleanup/log), 2 (pass selesai tetapi ada status belum pasti). Launcher memetakan 0/2 apa adanya dan kegagalan lain ke 1; kegagalan bootstrap sebelum worker aktif masih bisa menghasilkan log launcher saja.
- `run-payment-job.ps1` adalah jalur legacy untuk rollback, bukan action aktif. Ia memakai WorkingDirectory root dan `--import tsx`; tidak diubah dalam diagnosis ini.

**`consoleAttached=false` mengukur proses C# yang memanggil GetConsoleWindow, bukan worker Node.** Flag ini bukan pemeriksaan rekonsiliasi atau pengukuran langsung handle konsol anak. CreateNoWindow=true/UseShellExecute=false adalah konfigurasi pembuatan anak, tetapi tidak membuktikan tidak ada jendela dari proses lain. API GetConsoleWindow juga mempunyai batas pseudoconsole: handle tidak selalu berarti jendela desktop terlihat. Tidak mengubah executable C# hanya untuk mengubah indikator ini.

## Perubahan kode yang terbatas

- `scripts/reconcile-payments.mjs`: pemuatan env/config/dependensi dipindah ke orkestrasi yang menangkap fase dan menulis report FAILED; sebelumnya import/env terjadi di luar try dan catch hanya mencetak pesan umum, sehingga proof sukses lama tetap tertinggal. Factory/service/target koneksi tetap sama. Tidak ada retry/provider action tambahan.
- `scripts/payment-worker-runtime.mjs`: orkestrasi dengan dependency injection dan klasifikasi error whitelist. Membedakan runtime, env module/env, konfigurasi, dependensi, client DB, koneksi DB, lock, rekonsiliasi, cleanup dan persistence. Tidak mengimpor env/DB/provider sendiri. Tidak menyalin raw error, message, stack, query, connection string, metadata bebas, akun atau token. Validasi versi mengikuti engines proyek yang sudah ada.
- `src/lib/payments/job-lock.ts`: callback observasi opsional menandai connect versus lock, plus kode error tetap untuk lock yang putus. Strategi session lock, SQL lock/unlock dan aturan bisnis tidak berubah.
- `scripts/payment-runtime-probe.mjs`: impor dan validasi konfigurasi saja; tidak membuat Prisma/pg client, tidak memanggil gateway, tidak menjalankan batch. Output hanya whitelist metadata versi/bentuk export/hasil validasi, target DEV/DEMO/TEST, loopback dan port.
- `tests/payment-worker.test.mjs`: 11 tes orkestrasi/classifier memakai mock; `tests/payment-job-lock.test.ts`: lima tes callback fase dengan pg mock; `tests/fixtures/payment-env-legacy-probe.mjs` memeriksa bentuk impor lama tanpa memuat env atau koneksi.

Report `.local/payment-job-last.json` sekarang menyimpan hasil sukses **atau gagal** terbaru: waktu, versi Node, status, phase/code aman saat gagal; checked/released/unconfirmed saat pass selesai. Cleanup diobservasi sebelum persist. Gagal menulis log memberi exit 1/kode DIAGNOSTIC_WRITE_FAILED di output aman; log lama bisa tetap tertinggal sehingga timestamp wajib diperiksa. Error loader Node atau sintaks bootstrap sebelum orkestrasi termuat tetap perlu dibandingkan dengan log launcher. Output mentah anak tetap dibuang launcher.

## Pengujian aktual yang aman

| Pemeriksaan | Hasil dan batas |
|---|---|
| `node --import tsx scripts/payment-runtime-probe.mjs` | Lulus impor/config; target DEV loopback 55433. Tidak membuktikan DB/provider sehat |
| `node --import tsx tests/fixtures/payment-env-legacy-probe.mjs` | DEFAULT_LOADER_AVAILABLE; menolak hipotesis kegagalan default import statis |
| `node --test tests/payment-worker.test.mjs` | 11 lulus; seluruh env/DB/lock/batch mock, kecuali membaca bentuk export modul yang tidak dipanggil |
| `npm.cmd test` | 55 unit lulus, termasuk lima tes fase connect/lock dengan pg mock; tidak menjalankan tes database |
| `npm.cmd run lint`, `npm.cmd run typecheck` | Lulus |
| `node --check` pada runner/runtime/probe | Lulus syntax |
| `tests/payment-scheduler-safety.ps1` | Delapan skenario mock lulus; tidak mengubah task asli |
| Metadata listener dan `pg_ctl status` | Tidak ada listener 55433, cluster workspace tidak berjalan; tidak membuka SQL atau memulai server |
| Log tick normal | FAILED/database_connection/CONNECTION_REFUSED; **bukan** pass rekonsiliasi berhasil |

Tidak menjalankan npm payments:reconcile, Start-ScheduledTask, gateway manual, tes HTTP transaksi, test:db, migrasi, seed, reset, atau perubahan data transaksi. Jadwal 1 menit, principal, status task, database URL, backup XML, rollback dan launcher binary dipertahankan. Tidak menyalakan cluster otomatis dalam audit.

## Perbaikan operasional minimal berikutnya

**Status terbaru:** pemulihan manual sudah dilaporkan pengguna dan konektivitas/tick dikonfirmasi read-only pada rekonsiliasi BE-14. Instruksi startup berikut dipertahankan sebagai konteks keputusan sebelumnya, bukan tindakan yang perlu diulang sekarang. User kemudian juga menyetujui database sementara dan satu uji Sandbox baru; scope tersebut tidak mengizinkan perubahan task/dev/config produksi.

Pemulihan ditunda pengguna sampai dampak antrean pembayaran dipastikan. Cluster khusus workspace pada 55433 tetap menjadi target; jangan mengganti URL ke 5432, menginisialisasi cluster pengganti, menghapus PID/data atau me-restart layanan proyek lain. Task aktif tiap menit dapat langsung memproses antrean dan menghubungi Sandbox setelah database hidup. Startup atau perubahan task memerlukan persetujuan terpisah; BE-14 tidak menjalankannya.

```powershell
# Baca status cluster yang sudah ada. Audit memakai pg_ctl status langsung.
npm.cmd run db:local -- status

# Tidak menjalankan start pada tahap ini.
```

Helper db:local start mencakup provisioning role/hak database selain startup (scripts/local-postgres.mjs), sehingga bukan pilihan minimal untuk pemulihan cluster existing. Setelah binary, marker ownership, PG_VERSION, port konfigurasi dan direktori diverifikasi ulang serta persetujuan diperoleh, bentuk startup minimal adalah `pg_ctl.exe -D <direktori-data-terverifikasi> -l <log-cluster-terverifikasi> start -w`. Path relatif proyek yang tercatat: `.local/postgres/data` dan `.local/postgres/server.log`, server PostgreSQL 18.6. Jangan mengeksekusi placeholder atau menganggap path/versi historis sebagai pemeriksaan baru. Tidak ada override port atau initdb pada perintah tersebut. Log sebelumnya tidak membuktikan alasan berhenti atau menjamin integritas; startup dapat menjalankan crash recovery PostgreSQL dan tick dapat memproses antrean.

Sesudah cluster dinyalakan secara sadar, **tunggu tick terjadwal**, jangan menjalankan worker manual untuk pembuktian. Periksa LastTaskResult dan report baru: COMPLETED/0 membuktikan pass tersebut selesai; checked=0 tidak membuktikan pembayaran end-to-end; exit 2 berarti ada hasil belum pasti. Jika masih gagal, phase/code baru membedakan autentikasi, schema, lock dan batch. Tidak menyatakan BE-10 operasional normal atau VA lunas sampai bukti yang sesuai tersedia.

Referensi resmi: [env di luar runtime Next.js](https://nextjs.org/docs/app/guides/environment-variables#loading-environment-variables-with-nextenv), [GetConsoleWindow mengukur calling process dan batas pseudoconsole](https://learn.microsoft.com/en-us/windows/console/getconsolewindow).
