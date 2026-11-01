# FE-01 — Fondasi UI dan API client

24 Oktober 2026. Acuan PRD 1.9, kontrak API 0.13, [audit desain](FE-DESIGN-AUDIT.md) dan [inventaris aset](FE-ASSET-INVENTORY.md). Cakupan: tema, komponen, layout publik dan transport browser. Halaman akun/katalog/checkout belum diintegrasikan. Backend, schema, `.env`, database, task Windows dan pembayaran tidak diubah.

## Meninjau komponen

**Pembaruan FE-02:** provider sesi kini dipasang global. Komponen galeri tetap data contoh tanpa API bisnis, tetapi header membaca sesi nyata serta menyediakan navigasi auth. Pernyataan tanpa panggilan API pada bukti FE-01 di bawah adalah kondisi sebelum FE-02. Integrasi dan pemeriksaan baru: [FE02-AUTH-VERIFICATION.md](FE02-AUTH-VERIFICATION.md).

```powershell
npm.cmd run dev
```

Buka `http://localhost:3000/dev/ui`. Halaman hanya tersedia pada `NODE_ENV=development`; build produksi memberi **404**. Tidak ada tautan galeri pada navigasi pelanggan. Semua isian/status/nominal/toast adalah contoh lokal berlabel, tanpa panggilan API bisnis. Form sengaja menampilkan error contoh. `/` tetap beranda sementara dalam layout publik.

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
npm.cmd run check:client
```

`check:client` membutuhkan build produksi terbaru. Pemeriksaan grafik impor sumber FE dan `.next/static` (JS/CSS/source map browser) menolak impor server yang diperiksa dan mencari marker/nilai rahasia konfigurasi secara in-memory. Hanya kategori/status/jumlah dicetak. Tidak memanggil DB/provider, tidak memperlakukan bundle server sebagai bundle browser, dan bukan audit keamanan menyeluruh atas dependensi/deployment.

## Sumber dan keputusan tema

| Bagian | Implementasi dan sumber |
|---|---|
| Figma terverifikasi | background `#FFF6EF`, foreground `#4E342E`, brand `#FF7A00`, CTA `#B7260C`, secondary `#F8E8D5`, accent `#F0D8C0`; node beranda dicatat pada FE-00 |
| Semantik tambahan | Card/popover putih, teks sekunder, border/input, ring, error/success/warning/info dipilih untuk state yang terbaca; bukan klaim token Figma tambahan |
| Font | Abhaya Libre Bold 700; Poppins 300/400/500/600/700, `next/font/local`, swap. Regular 400 menjadi default keterbacaan; keluarga dan weight lain mengikuti audit |
| Asal font | Enam TTF resmi [google/fonts — Poppins](https://github.com/google/fonts/tree/main/ofl/poppins) dan [Abhaya Libre](https://github.com/google/fonts/tree/main/ofl/abhayalibre), diambil 24 Oktober 2026, disimpan di `src/app/fonts` beserta dua OFL. Tidak memerlukan Google Fonts saat browser/build. Tidak preload semua weight Poppins |
| Primitive | [shadcn/ui](https://ui.shadcn.com/docs/installation/next), registry resmi `https://ui.shadcn.com/r/styles/new-york-v4/{name}.json`, diambil 24 Oktober 2026; hasil adaptasi disimpan lokal. MIT di `src/components/ui/LICENSE.md` |
| Adaptasi | Alias `@/`, light theme meski OS dark, tombol pill/default 44px dan `type=button` (submit eksplisit), ring fokus tegas, label aksesibel Indonesia, dialog dibatasi tinggi viewport, Sonner light |
| Ukuran | Spacing Tailwind kelipatan 4px; wrapper 1280px, gutter 20/32/48px; radius dasar 20px dan besar 24/28px. Breakpoint sm 640/md 768/lg 1024px. Responsif ini keputusan pelengkap desain desktop, bukan bukti desain mobile Figma |
| Identitas/aset | Nama toko berupa teks, belum logo final. Tidak menggunakan screenshot sebagai UI atau URL MCP sementara. Logo/auth/foto tetap tindak lanjut FE-02/03; hero belum dipasang |

Paket exact/lockfile: `radix-ui@1.8.1`, `class-variance-authority@0.7.1`, `clsx@2.1.1`, `tailwind-merge@3.7.0`, `lucide-react@1.61.0`, `sonner@2.0.8`, `tw-animate-css@1.4.0`. Next/React/Tailwind tidak dinaikkan. Tidak memasang next-themes; desain saat ini light saja. Instalasi melaporkan 0 vulnerabilities serta pemberitahuan kebijakan install-script toolchain yang sudah ada; tidak mengubah keamanan global.

## Komponen dan pemakaian

| Lokasi | Tanggung jawab |
|---|---|
| `src/components/ui` | Button, input, label, textarea, badge, dialog, alert-dialog, sheet, select, checkbox, table, pagination, skeleton, sonner |
| `shared/form-field.tsx` | Label, hint/error, id dan aria melalui render prop. Pemanggil tetap menentukan required/type/name/autocomplete dan validasi bisnis |
| `shared/action-button.tsx` | Pending spinner/aria-busy/disabled; tidak menggantikan idempotensi server |
| `shared/data-state.tsx` | Loading, kosong, error; error tak dikenal generik, requestId aman, petunjuk Retry-After. Retry callback eksplisit milik pemanggil; tidak mengirim ulang otomatis |
| `shared/status-badge.tsx` | Label dari kontrak murni, status pesanan dan pembayaran terpisah; null pembayaran tetap “Belum ada pembayaran” |
| `shared/page-nav.tsx` | Batas prev/next/pending dan info live. totalPages 0 tidak dijadikan 1; halaman di luar hasil tidak otomatis digeser |
| `layout/public-shell.tsx` | Header/footer, skip link, main, nav desktop dan drawer ponsel; navigation hanya halaman yang sudah ada, default Beranda. Sesi/role/keranjang menyusul FE-02/04 |
| `src/lib/format.ts` | IDR bulat nonnegatif, waktu Asia/Jakarta; null/undefined “—”, 0 tetap Rp0. Timestamp string wajib zona eksplisit, nominal pecahan/invalid ditolak |

Gunakan `cn()` untuk kelas Tailwind. Ikon dekoratif aria-hidden, tombol ikon wajib label. Aksi utama minimal 44px; ukuran kecil hanya bila sesuai konteks. Reduced motion mencakup portal/toast. Ini fondasi aksesibilitas; audit screen reader/perangkat nyata seluruh produk tetap FE-12.

## API client browser

`src/lib/http/client.ts` murni, tanpa Prisma, konfigurasi/sesi server, SDK pembayaran, storage atau logging. `apiRequest<T>()` menerima path relatif `/api/...`, cookie same-origin, no-store dan redirect error. Origin lain/hash/path keluar API ditolak sebelum fetch. Generic T bukan validasi runtime; decoder opsional dipakai per fitur untuk bentuk DTO.

- Envelope success/data/meta, requestId, pagination dan ratingSummary divalidasi; null dipertahankan, tidak membuat nilai bisnis contoh.
- `ApiClientError` membedakan http/network/protocol/aborted. HTTP 401/403/404/405/409/422/429/503 punya fallback publik; pesan JSON publik server mengikuti kontrak. HTML, parse/decoder failure dan stack transport tidak disalin ke pesan.
- Error menyediakan status/code/requestId, field path/code yang diizinkan, serta retryAfterSeconds. Input mentah field dibuang; jangan log object error/data pada fitur/analytics.
- Retry-After detik/HTTP-date diparse. Pemanggil menghormati jedanya dan menentukan apakah tindakan aman diulang. Tidak ada auto-retry, polling, redirect login atau replay mutasi. Network/503 bukan bukti mutasi gagal: baca state terbaru/ikuti aturan idempotensi fitur.
- JSON dan FormData terpisah; multipart boundary ditentukan browser. GET dengan body atau dua body sekaligus ditolak.
- `createLatestRead<T>()` hanya untuk **pembacaan**, satu instance stabil per konsumen. Gunakan `run(signal => ...)`, terapkan hasil status success saja, `cancel()` saat cleanup/perubahan akun. Respons/error lama diabaikan meski transport mengabaikan abort. Jangan gunakan untuk checkout/payment/submit.
- Reaksi tampilan terhadap 401/sesi, 403/role, 409, 422 atau cooldown adalah integrasi FE berikutnya. Fondasi menyediakan sinyal, belum membuktikan alur bisnis tersebut.

## Bukti aktual 24 Oktober 2026

| Pemeriksaan | Hasil dan batas |
|---|---|
| `npm.cmd test -- tests/http-client.test.ts tests/format.test.ts` | 2 file / **39 lulus**. Envelope/null/meta, origin, JSON/multipart, HTTP/non-JSON error, Retry-After, parse/decode/network, abort body, tanpa replay mutasi, race/cancel, IDR/waktu Jakarta. Fetch in-memory |
| `npm.cmd test` | **14 file / 142 lulus**, termasuk 39 baru. PostgreSQL/provider tidak dijalankan |
| Lint/typecheck/build | Lulus; bukan bukti DB/provider/transaksi baru |
| `npm.cmd run check:client` | Lulus: 25 file grafik sumber, 16 artefak browser, 4 nilai privat diperiksa tanpa dicetak. Tidak ditemukan marker/impor/nilai yang diperiksa |
| HTTP produksi loopback 3101 | `/` 200, `/dev/ui` **404** tanpa teks pratinjau; hanya GET halaman. Server pemeriksaan sementara dihentikan |
| Browser in-app localhost:3000 | Font/tema, 360/768/1440px, tanpa overflow horizontal halaman. Tabel 360px bergulir lokal (container 263px, isi 452px); drawer, field error/aria, Select/checkbox, pending disabled, toast, batas pagination diperiksa |
| Keyboard/dialog | Fokus awal di dalam; Shift+Tab tetap di dialog, Escape menutup dan mengembalikan fokus ke pembuka. Konfirmasi default fokus Batal; bukan audit screen reader penuh |

Bukti screenshot lokal di `.local/fe01/` (diabaikan Git): `mobile-360.jpg`, `tablet-768.jpg`, `desktop-1440.jpg`, semuanya data contoh. Percobaan awal runner/dev sandbox terkena spawn EPERM; verifikasi kemudian dijalankan dengan izin proses. Percobaan dev kedua menemukan server proyek sudah ada; menggunakan server tersebut tanpa menghentikan proses pengguna.

Pemeriksaan akhir: server dev sempat tidak merespons setelah rangkaian verifikasi. Server development dijalankan kembali tanpa perubahan konfigurasi; GET loopback `/dev/ui` menghasilkan 200 dengan konten pratinjau. Browser otomatis gagal membuka ulang meski HTTP lokal berhasil; keberhasilan browser sebelumnya dan screenshot tidak disamakan dengan keberhasilan pembukaan ulang terakhir. Tidak mengubah proxy/firewall/Windows. `next dev` juga menghasilkan `AGENTS.md` secara otomatis; panduan Next lokal terkait font/CSS/layout telah dibaca, file ini bukan konfigurasi pembayaran baru.

FE-01 menutup fondasi; **FE-02 siap** untuk auth/sesi/navigasi role. Halaman bisnis, aset final, penerimaan keseluruhan Figma, UAT alur dan deployment masih task berikutnya.
