# FE-12 — Verifikasi frontend dan serah terima

25 Oktober 2026. PRD 1.9, API 0.13. **Status: Ditinjau; penerimaan frontend P0 belum lengkap.** Seluruh halaman P0 telah diimplementasikan, tetapi itu tidak sama dengan seluruh state browser, provider, visual atau deployment sudah diterima.

## Hasil yang benar-benar dicapai

| Lingkup | Bukti dan batas |
|---|---|
| Fondasi/auth/katalog/keranjang/alamat | FE-00/01 serta fungsi FE-02–04 sebelumnya diterima. Bukti historis browser/API dan batas aset tetap pada laporan masing-masing; tidak menjalankan ulang seluruh tes lama tanpa perubahan relevan |
| Checkout browser | Memilih alamat fixture, meminta quote server Rp29.200, checkbox persetujuan awal kosong dan tombol konfirmasi disabled. Sesudah persetujuan, satu POST sengaja kehilangan respons setelah commit; halaman menunjukkan hasil belum pasti. Reload mempertahankan recovery; tindakan eksplisit memulihkan order yang sama. Hasil memuat snapshot/deadline/server status dan link pembayaran |
| SQL checkpoint checkout | **PASS**, 201 kemudian 200 dengan key/body sama, satu order untuk user browser fixture. Cleanup **PASS**, 15 fingerprint cocok; browserTested=true pada scope proxy checkout, bukan login/cookie browser |
| Responsif checkout | Hasil order diperiksa dengan Chrome DevTools Responsive Width **360/768/1440**. Label, nomor panjang yang membungkus, CTA dan susunan snapshot/biaya terlihat pada hasil. DevTools Fit melakukan scaling; tinggi otomatis bervariasi. Ini smoke visual halaman hasil, **bukan** pengukuran DOM overflow, audit seluruh state/halaman atau penerimaan responsif seluruh produk |
| Admin fulfillment browser | Order sintetis dengan dua item dan dua attempt (Gagal/Sukses). Buka/Batal pengiriman lalu simpan Dikirim. Dialog Selesai awalnya belum dicentang; submit tanpa konfirmasi/note menunjukkan validasi. Isi note/centang manual, simpan → Selesai. Sesudahnya tidak ada tombol transisi lanjut |
| Catatan privat browser | Satu note dikirim; proxy memutus respons sesudah commit. UI menampilkan error/hasil belum pasti, tombol simpan disabled dan Periksa data terbaru. Reload eksplisit menampilkan satu catatan yang tadi dikirim serta pelaku admin. Ini observasi UI pada fixture, bukan konfirmasi penerimaan barang nyata |
| Checkpoint otomatis admin | **FAIL karena batas waktu 20 menit tercapai sebelum stop/checkpoint ditutup**, cleanup **PASS**, 18 fingerprint cocok. Laporan runner tetap browserTested=false; tidak diubah menjadi PASS berdasarkan pengamatan manual. Tujuh kelompok API pada run tersebut lulus. Pengamatan UI di atas dan hasil runner yang belum lulus adalah dua bukti berbeda |
| Provider | **Nol panggilan provider** pada uji ini. Pembayaran admin adalah fixture sintetis. BNI Sandbox backend BE-14 historis tidak membuktikan FE-06 UI/Snap/finish atau VA baru |

Pada pemeriksaan lanjutan, tab sudah berada di `http://localhost:3000/usage` dan menampilkan 404, sementara proxy test telah selesai. Itu **bukan** bukti bahwa route `/admin/pembayaran` rusak; daftar pembayaran browser belum diverifikasi pada run ini. Tidak mengubah kode route karena hasil dari URL lain tersebut.

## Bug yang ditemukan dan diperbaiki

Sebelum perbaikan, pemilihan alamat browser kembali kosong ketika Chrome mendapat fokus. `SessionProvider` menghubungkan focus ke `store.refresh()` foreground. Store melewati keadaan checking; RequireRole melepaskan feature tree, lalu memasangnya lagi sehingga draft hilang meski akun sama.

`src/components/auth/session-provider.tsx` sekarang memakai `refresh(true)` khusus focus pada tab yang masih visible. Identitas yang sama tetap terpasang saat GET sesi berjalan. Perubahan akun/role, kegagalan/sesi expired, event cross-tab, visibility hidden dan pageshow/BFCache tetap mengikuti invalidasi/revalidasi yang sudah ada. Tidak menghapus pemeriksaan sesi atau otorisasi server.

`tests/auth-client.test.ts` menambahkan regresi: selama background check pending akun tetap authenticated/revisi sama; respons expired kemudian menghapus user dan menaikkan revisi. Tes background identity/role/error serta suspension yang lama tetap lulus. Di browser sesudah build, radio alamat mengaktifkan tombol quote dan dapat dilanjutkan ke persetujuan/recovery; reset fokus yang terlihat sebelumnya tidak muncul pada langkah tersebut. Pengujian lintas tab/BFCache/pergantian akun penuh masih terbuka.

## Pemeriksaan penutup

| Perintah | Hasil |
|---|---|
| `npm.cmd test` | **24 file / 438 tes lulus**, satu regresi baru fokus/sesi. Bukan suite PostgreSQL/provider/React DOM baru |
| `npm.cmd run build` | Lulus sesudah perbaikan; seluruh route P0 tercantum |
| `npm.cmd run lint` | Lulus |
| `npm.cmd run typecheck` | Lulus setelah build |
| `npm.cmd run check:client` | PASS: **71 source files / 38 browser artifacts / empat nilai privat** dicocokkan tanpa dicetak |
| `node --import tsx scripts/verify-checkout-ui-http.mjs --ui` | Run awal checkpoint FAILED/cleanup PASS; run sesudah perbaikan **PASS empat kelompok** termasuk browser recovery, cleanup 15 fingerprint cocok |
| `node --import tsx scripts/verify-admin-orders-client.mjs --ui` | Tujuh kelompok API lulus; observasi browser parsial di atas. Timeout membuat checkpoint FAIL, cleanup 18 fingerprint cocok |
| `node scripts/verify-frontend-evidence.mjs` | Indeks read-only artefak/hashes dan link dokumen; bukan eksekusi ulang tes atau bukti kelulusan frontend |

Tidak menjalankan ulang semua harness database/provider yang bukti validnya masih tersedia. Perubahan aplikasi hanya penanganan fokus sesi; service/backend, schema/migrasi, dependency, `.env`, dev database, task Windows serta backup/rollback tidak diubah.

## Artefak, isolasi dan riwayat

Kedua harness memverifikasi loopback PostgreSQL **55433**, SQL database **salvora_kitchen_test** dan port sebelum membuat fixture. Secret auth baru hanya di memori; key Midtrans child kosong. Cookie fixture disisipkan proxy, bukan disalin dari dev. Allowlist mencegah endpoint gateway/worker. Cleanup hanya relasi/ID/email run; tidak reset database atau memakai 5432/LanggananKu. Semua server/proxy test yang dijalankan sudah berakhir; development server pengguna tidak dihentikan.

- `.local/fe12/checkout-before-focus-fix.json`: checkpoint awal tidak lulus, cleanup tetap lulus; dipertahankan.
- `.local/fe05/ui-result.json`: browser checkout **PASS**, waktu **09:49:20 UTC / 16:49:20 WIB**, 15 fingerprint, nol provider.
- `.local/fe10/74344232-1c92-4103-9e85-249717432dc1-result.json` dan `.local/fe10/ui-result.json`: checkpoint admin **FAIL**, waktu **10:09:49 UTC / 17:09:49 WIB**, cleanup PASS/18 tabel, nol provider. Jangan menimpa bukti timeout dengan klaim sukses.
- `.local/fe12/evidence-index.json`: indeks status/hash artefak lama pada saat script dijalankan. Timestamp artefak bukan otomatis waktu tes ulang; hash membantu mendeteksi file laporan yang kemudian berubah.

Screenshot browser diamati dalam sesi computer-use; tidak membuat klaim ada berkas screenshot baru di repo. Inventaris aplikasi/window saja sebelumnya bukan bukti browser; akses sebenarnya baru berhasil setelah user membuka tab login. Sempat terjadi window minimized/user-input interruption; state dibaca ulang, tanpa memakai koordinat lama atau mengubah keamanan Windows.

## Status task aktual

| Task | Status penerimaan saat ini |
|---|---|
| FE-00 | Selesai untuk audit; aset/konten final yang belum tersedia tetap dicatat |
| FE-01 | Selesai untuk fondasi; regresi sesi FE-12 sudah lulus |
| FE-02–FE-04 | Selesai untuk fungsi sesuai bukti historis; visual/konten final bukan otomatis diterima |
| FE-05 | Ditinjau. Gap utama recovery checkout browser kini tertutup; audit seluruh state/keyboard/responsif masih belum lengkap |
| FE-06 | Ditinjau. Mock dan HTTP valid; Snap/VA/finish melalui UI baru belum terbukti |
| FE-07 | Ditinjau. Ulasan/riwayat HTTP valid; browser submit/foreign/empty/pagination belum ditutup |
| FE-08 | Ditinjau. Dashboard HTTP valid; periode, drawer, logout/keyboard/responsif browser belum lengkap |
| FE-09 | Ditinjau. CRUD/foto/stok HTTP valid; browser upload/cancel/conflict dan responsif belum lengkap |
| FE-10 | Ditinjau. Fulfillment/cancel/validasi/note browser sempat diamati; checkpoint timeout dan daftar/filter/akses/konkurensi browser belum tuntas |
| FE-11 | Ditinjau. Voucher/profil HTTP valid; interaksi browser belum ditutup |
| FE-12 | Ditinjau, **bukan Selesai**. Verifikasi parsial, perbaikan bug dan handoff tersedia; gap berikut masih merupakan syarat penerimaan |

## Pekerjaan spesifik yang masih diperlukan

1. Sesi browser terisolasi berikutnya: FE-07 ulasan/riwayat; FE-08 dashboard/periode/drawer; FE-09 kategori/produk/foto/stok; FE-10 daftar/filter/role/conflict serta checkpoint yang berakhir sebelum timeout; FE-11 profil/voucher. Gunakan harness yang sudah ada untuk alur yang didukung dan siapkan fixture UI scoped untuk FE-09/11. Jangan menguji mutasi pada akun dev untuk mempercepat penerimaan.
2. Periksa **semua** halaman/state relevan pada 360/768/1440, keyboard/fokus, dialog, loading/error/empty/429/conflict, nama panjang, gambar dan batas sesi/lintas tab. Bukti checkout hasil tiga lebar tidak mencakup seluruh frontend.
3. Provider UI: ikuti [FE06-SANDBOX-PLAN.md](FE06-SANDBOX-PLAN.md). Belum menyiapkan listener/tunnel/transaksi baru pada FE-12. Perlu izin spesifik sebelum satu transaksi Sandbox baru dan webhook HTTPS sementara; key tidak melalui chat. Pastikan browser, origin/finish, quote Rp14.000 dan callback siap dahulu. Tidak memakai ulang referensi/izin transaksi lama atau menganggap callback/token sebagai bukti pembayaran.
4. Visual/aset: `public/images/salvora-hero.png` dan font lokal resmi tersedia. Export logo, ilustrasi auth, foto kategori/produk/about/banner serta konten kontak/menu resmi masih perlu dikonfirmasi menurut [inventaris](FE-ASSET-INVENTORY.md). Tidak memotong screenshot atau membuat data/foto toko palsu. Aset Figma yang belum diekspor tidak dianggap siap; limit sebelumnya tidak diakali.
5. Handoff/deployment: gunakan [FRONTEND-HANDOFF.md](FRONTEND-HANDOFF.md), [README/setup proyek](../README.md). UAT produk/Figma, hosting, penyimpanan foto persisten, HTTPS/cookie serta penjadwal deployment memerlukan penerimaan terpisah. Backend diterima tidak menjadikan frontend/produk produksi siap.

Dokumen ini mempertahankan kegagalan historis dan batas observasi. Tidak menaikkan status task hanya karena semua halaman sudah memiliki kode atau tes unit/HTTP lulus.
