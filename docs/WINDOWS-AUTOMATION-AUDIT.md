# Audit terminal Windows — otomatisasi pembayaran

Tanggal: 23 Oktober 2026. Status: perbaikan file proyek diverifikasi; migrasi action task yang sama diterapkan setelah persetujuan eksplisit pengguna pada audit ini. Tidak menjalankan rekonsiliasi manual, tes database, pembayaran provider manual, atau perubahan keamanan Windows. Tick otomatis yang sudah aktif tetap berjalan.

Lanjutan diagnosis exit 1: [PAYMENT-WORKER-DIAGNOSTICS.md](PAYMENT-WORKER-DIAGNOSTICS.md). Fase database_connection/CONNECTION_REFUSED dan cluster proyek 55433 yang berhenti kini terkonfirmasi. consoleAttached=false di laporan ini hanya mengukur launcher, bukan konsol worker Node atau keberhasilan pembayaran.

## Temuan dan batas bukti

1. `SalvoraKitchen-PaymentReconciliation-Local` adalah fitur resmi BE-10 yang disetujui untuk rekonsiliasi lokal tiap menit. Installer hanya dipanggil eksplisit melalui `scripts/payment-scheduler.ps1`; package.json tidak memiliki predev/postinstall atau hook instalasi scheduler. `dev`, `build`, dan `start` menjalankan Next.js saja. Tidak ditemukan `.vscode/tasks.json`/launch.json pada workspace atau installer scheduler kedua. Pencarian mencakup sumber, skrip dan dokumentasi, termasuk file tersembunyi; isi `.env`, node_modules, output build, log privat dan generated client tidak dicetak.
2. Pembacaan Windows menemukan satu task yang menunjuk proyek ini, State Ready, interval PT1M, LogonType Interactive, hak Limited, MultipleInstances IgnoreNew, ExecutionTimeLimit PT10M. Action masih powershell.exe dengan flag Hidden dan `run-payment-job.ps1`. Script tersebut kemudian membuat proses Node melalui Start-Process Hidden. Jadi ada proses konsol PowerShell baru pada desktop interaktif tiap tick sebelum script menyembunyikan proses anak. Ini kandidat kuat kilatan terminal; Hidden pada proses anak tidak menghilangkan kebutuhan membuat proses PowerShell induk.
3. Pembacaan 10:47 WIB: LastTaskResult 1, sedangkan ringkasan sukses worker terakhir bertanggal 05:06 WIB. Validasi statis konfigurasi Sandbox lulus tanpa koneksi DB/provider. Penyebab runtime exit 1 belum dipastikan; tidak diasumsikan pembayaran gagal atau database perlu diubah. Launcher lama tidak menyimpan stdout/stderr worker, sehingga proof sukses lama dapat menyesatkan jika waktu/LastTaskResult diabaikan.
4. Task Scheduler Operational history tersedia tetapi nonaktif. Percobaan observasi pasif Win32_ProcessStartTrace ditolak Access denied, termasuk di konteks tool yang diizinkan. Tidak mengaktifkan history, mengubah izin WMI/audit policy atau menjalankan task untuk memaksakan reproduksi. Belum ada korelasi PID/event/waktu kilatan dari desktop; tidak mengklaim semua terminal berasal dari task ini.
5. Skrip DB/backup/HTTP test/tunnel yang membuat subprocess memakai windowsHide, dipanggil eksplisit, dan tidak dijadwalkan oleh npm dev/build. Tooling/editor di luar workspace, task proyek lain dan proses yang tidak tertangkap belum dapat disingkirkan hanya dari pencarian kode. Tidak ada dasar mengubah atau menonaktifkan ekstensi lain.

Lokasi bukti kode: `scripts/run-payment-job.ps1` (Start-Process anak), `scripts/payment-scheduler.ps1` (pengenalan action legacy, trigger 1 menit dan migrasi eksplisit), `package.json` (perintah dev/build/manual), `src/services/payment-job.ts` (polling/backoff), `src/lib/payments/job-lock.ts` (advisory lock). Konfigurasi Windows dibaca langsung, bukan disimpulkan dari dokumentasi.

## Perubahan yang disiapkan

- `scripts/PaymentJobLauncher.cs`: executable WindowsApplication/GUI subsystem, tanpa console entry point. Menjalankan Node langsung dengan UseShellExecute=false dan CreateNoWindow=true, tanpa PowerShell/cmd/wscript per tick. Target worker tetap reconcile-payments.mjs; loader tsx memakai file URL agar path Windows/spasi benar. Exit 0/1/2 diteruskan, tidak menampilkan dialog error. Tidak mengubah service atau kebijakan pembayaran.
- `scripts/build-payment-launcher.ps1`: kompilasi lokal memakai .NET Framework Windows yang tersedia, tanpa mengunduh paket atau memasang komponen global. Binary dan manifest hash berada di `.local/automation/`; source tersedia untuk ditinjau. Build tidak memasang task atau menjalankan worker. Binary terpakai tidak dihentikan paksa bila build gagal menggantinya.
- `scripts/payment-scheduler.ps1`: Plan/Status hanya baca, Update migrasi action task yang sama, Install tidak membuat duplikat. Memeriksa ownership/path/action serta hash source/binary. Update membuat backup XML privat sebelum Set-ScheduledTask dan mempertahankan trigger, principal, pengaturan, serta enabled state. SupportsShouldProcess/WhatIf/Confirm melindungi tindakan mutasi. Access denied tidak lagi dianggap task tidak ada. Disable/Enable mengganti penghapusan rutin, tanpa menghentikan worker berjalan. Rollback memulihkan hanya action dari backup tervalidasi milik workspace, menolak DTD/XML action asing.
- `scripts/verify-payment-launcher.mjs`, `tests/fixtures/payment-launcher-smoke.mjs`, `tests/payment-scheduler-safety.ps1`: pengujian launcher dengan target inert dan cmdlet task yang dimock. Mode self-test hanya memilih fixture tetap; tidak menerima path script sembarang.

`run-payment-job.ps1` dipertahankan untuk kompatibilitas/rollback. `reconcile-payments.mjs`, fungsi rekonsiliasi, schema dan logika pembayaran tidak diubah; audit tidak mengeksekusi operasi database. Sesudah pengguna menyetujui, Update mengganti hanya action task existing dan menyimpan backup XML privat. Perbandingan export sebelum/sesudah membuktikan Triggers, Principals dan Settings identik; satu task proyek tetap ada, ActionKind GuiLauncher, PT1M/Ready. Tidak ada pemanggilan Start-ScheduledTask.

Tick normal 11:16:37 WIB mencatat mode PAYMENT_JOB, consoleAttached=false, exitCode=1/CHILD_EXIT_FAILED. Status terakhir yang dibaca 11:18:37 WIB masih LastTaskResult 1, tick berikutnya 11:19:36 WIB. Artinya mekanisme GUI berjalan tanpa konsol terpasang, tetapi kegagalan runtime worker yang sudah ada sebelum migrasi belum terdiagnosis. Bukti ini tidak dianggap pembayaran berhasil atau seluruh gangguan jendela desktop hilang. PostgreSQL teramati mempunyai proses berjalan; itu tidak membuktikan koneksi aplikasi/role/provider sehat.

## Interval dan keamanan pembayaran

Tetap 1 menit, sesuai keputusan operasional lokal BE-10; bukan karena PRD mewajibkan polling persis 1 menit. Tenggat bisnis tetap 60 menit. Worker maksimal 25 kandidat/pass, mulai order baru selama anggaran 50 detik, jeda per order 60 detik atau 300 detik jika belum pasti. Advisory lock pada koneksi PostgreSQL khusus, IgnoreNew pada task dan transaksi/idempotensi aplikasi tetap melindungi overlap. Mengubah interval untuk menyembunyikan kilatan hanya menunda rekonsiliasi/release dan tidak memperbaiki sumber konsol.

Tidak mengganti akun ke SYSTEM/admin atau S4U. Akun interaktif Limited tetap dipakai; GUI launcher mengatasi konsol tanpa mengubah hak akses. S4U memiliki pembatasan jaringan/enkripsi sehingga tidak dipilih sebagai jalan pintas bagi worker yang membutuhkan layanan pembayaran. Tidak mengaktifkan fitur VBScript/WSH atau mengubah ExecutionPolicy global.

## Cara menerapkan setelah persetujuan

Jalankan dari root proyek, lewat terminal yang sudah dibuka sendiri. Perintah build dan test di bawah tidak menjalankan pembayaran.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/build-payment-launcher.ps1
node scripts/verify-payment-launcher.mjs
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/payment-scheduler-safety.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/payment-scheduler.ps1 -Action Plan
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/payment-scheduler.ps1 -Action Update -WhatIf

# MUTASI WINDOWS: hanya setelah menyetujui action yang ditampilkan.
# Update task yang sama, backup dulu, tanpa menjalankan worker manual.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/payment-scheduler.ps1 -Action Update -Confirm

powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/payment-scheduler.ps1 -Action Status
```

Jika task belum pernah ada, gunakan Install -Confirm setelah build dan pemeriksaan; jangan membuat nama task lain. Untuk kasus audit ini task sudah ada, jadi gunakan Update. Menyetujui Update mempertahankan tick otomatis yang sudah aktif; tick mendatang tetap dapat menghubungi database/provider seperti sebelumnya. Audit ini tidak akan memicu Start-ScheduledTask atau npm payments:reconcile untuk verifikasi.

Sesudah migrasi, Status harus menampilkan GuiLauncher dan PT1M. Periksa waktu tick normal berikutnya, LastTaskResult, `.local/payment-launcher-last.json` dan `.local/payment-job-last.json` tanpa menampilkan isinya secara massal. Amati desktop selama 2–3 tick saat development server ditutup dan saat dibuka. Tidak adanya console pada tes inert belum membuktikan seluruh gangguan desktop hilang; laporan pengguna dan korelasi proses setelah migrasi menutup verifikasi visual.

Log launcher berisi hanya startedAt, completedAt, mode, exitCode, kode error tetap dan consoleAttached. Stdout/stderr anak dikuras dan dibuang, bukan disalin ke log. Log worker tetap berisi ringkasan hitungan tanpa key/token/order/customer. Exit 1 launcher menandakan kegagalan start/child/logging; exit 2 hasil pembayaran belum pasti. Periksa timestamp terbaru bersama kode hasil; file sukses lama tidak membuktikan tick baru berhasil. Jangan mengunggah env, raw provider error, command line penuh atau data transaksi untuk diagnosis.

## Menonaktifkan dan membatalkan perubahan

```powershell
# Matikan pemicu berikutnya, biarkan worker yang sedang berjalan selesai.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/payment-scheduler.ps1 -Action Disable -Confirm
# Aktifkan kembali tanpa memicu job manual.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/payment-scheduler.ps1 -Action Enable -Confirm

# Path backup ditampilkan ketika Update berhasil; wajib XML di task-backups workspace.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/payment-scheduler.ps1 -Action Rollback -BackupPath "<path backup XML lokal>" -Confirm
```

Disable menghentikan pemeriksaan/release otomatis di masa berikutnya. Webhook dan pemeriksaan manual aplikasi tidak dihapus, tetapi transaksi yang kehilangan webhook/reservasinya bisa menunggu lebih lama. Karena itu tidak dinonaktifkan selama audit tanpa persetujuan. Rollback ke action PowerShell lama dapat mengembalikan risiko kilatan. Tidak menghapus task, script, binary, database atau transaksi.

## Verifikasi aktual

- `node scripts/verify-payment-launcher.mjs`: lulus; kompilasi, PE subsystem 2 (GUI), consoleAttached=false, fixture inert exit 0/1/2, path invalid gagal tertutup, output sentinel tidak muncul di log/stdout/stderr launcher. Tidak memuat env aplikasi, menghubungi database/provider atau menjalankan task.
- `powershell.exe ... -File tests/payment-scheduler-safety.ps1`: delapan skenario mock lulus: Status/Plan hanya baca, Install existing tanpa duplikat, WhatIf tanpa mutasi, Enable/Disable reversible, task asing/Update absent ditolak. Cmdlet task nyata tidak dijalankan oleh tes ini.
- Parser AST PowerShell: empat file otomasi/test lulus. `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd test`: lulus, 50 tes unit. Tidak menjalankan test:db, test:midtrans, worker manual atau tes HTTP yang berpotensi memakai transaksi.
- Sebelum persetujuan: Plan terhadap task asli LegacyPowerShell/PT1M, Update -WhatIf lulus tanpa mutasi. Konfigurasi statis --snap valid; koneksi database/provider tidak diperiksa. Sesudah persetujuan: Update nyata dan backup berhasil; perbandingan XML trigger/principal/settings identik, action GUI dan jumlah task satu. Rollback -WhatIf terhadap backup asli lulus tanpa memulihkan action lama. Pembacaan tick normal mencatat consoleAttached=false, worker exit 1 tetap terbuka.

Pengujian menemukan dan memperbaiki absolute path loader Node Windows yang perlu file URL, pemeriksaan hash dry-run yang terpengaruh WhatIf PowerShell 5.1, serta pembacaan backup XML legacy dengan deklarasi UTF-16/byte UTF-8. Backup baru memakai encoding sesuai deklarasi; backup lama tetap bisa dibaca tanpa mengubah file aslinya. Tidak mengklaim semua jendela desktop sudah hilang sebelum observasi pengguna selesai.

## Bila masih muncul setelah migrasi

Catat waktu kejadian sampai detik dan nama proses dari Task Manager/Process Explorer, tanpa menyalin command line yang mungkin berisi rahasia. Cocokkan waktu dengan LastRunTime task dan timestamp launcher. Jika diperlukan, gunakan Task Scheduler > task > History; saat ini history nonaktif dan belum diaktifkan audit. Persetujuan terpisah diperlukan sebelum mengubah pengaturan logging Windows.

Gunakan Process Monitor resmi dengan filter Process Create dan image powershell.exe, pwsh.exe, cmd.exe, node.exe, conhost.exe/OpenConsole.exe; lihat parent PID/process tree secara lokal. Parent terkait launcher/task membantu atribusi; parent editor/npm/tool lain memerlukan audit sumber tersebut. Jangan membagikan dump mentah. Alternatif jika audit proses sudah aktif: baca Security 4688/Sysmon 1 yang sudah tersedia, tanpa mengubah kebijakan keamanan global. Hak event trace tool ini ditolak sehingga observasi tersebut perlu dilakukan pada konteks Windows yang sesuai.

Referensi Microsoft: [CreateNoWindow dan UseShellExecute](https://learn.microsoft.com/en-us/dotnet/api/system.diagnostics.processstartinfo.createnowindow?view=netframework-4.8.1), [target winexe](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/compiler-options/output#targettype), [logon interaktif dan batas S4U](https://learn.microsoft.com/en-us/windows/win32/taskschd/taskschedulerschema-logontype-principaltype-element).
