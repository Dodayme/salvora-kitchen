# FE-00 — Inventaris aset dan ekspor desain

24 Oktober 2026. Acuan PRD 1.9 dan [FE-DESIGN-AUDIT.md](FE-DESIGN-AUDIT.md). **21 file PNG lokal: 20 ekspor/screenshot dan 1 aset individual.** Metadata dibaca dengan sharp, file didecode untuk contact sheet dan diperiksa visual. Semua PNG memiliki kanal alpha menurut metadata; itu tidak menjamin gambar merupakan cutout transparan.

Inventaris ini tidak mengubah file sumber, memotong foto dari screenshot atau memasang aset ke frontend. Halaman Figma/PNG belum dianggap implementasi selesai. File .local/fe00/contact-sheet.png dan asset-metadata.json hanya artefak QA lokal yang diabaikan Git.

**Pembaruan FE-01, 24 Oktober 2026:** enam TTF Poppins/Abhaya Libre resmi beserta dua OFL kini tersimpan di `src/app/fonts`, termuat melalui `next/font/local`. Primitive shadcn/Radix dan ikon interaksi Lucide tersedia; identitas sementara berupa teks, bukan logo final. Temuan “belum lokal/belum ada komponen” di bawah adalah snapshot FE-00 sebelum implementasi. Hero/logo/auth/foto belum diimplementasikan FE-01. Rincian: [UI-FOUNDATION.md](UI-FOUNDATION.md).

## 1. File yang benar-benar tersedia

**Pembaruan FE-03:** A-01 hero disalin identik ke `public/images/salvora-hero.png` dan dipakai pada hero beranda/menu dengan rasio asli; bukan foto produk. Foto produk tetap dari API/fallback. Logo, cutout kategori, banner terpisah dan foto about belum tersedia; screenshot tidak dipotong/dijadikan UI. Sumber, SHA, geometri serta batas visual: [FE03-CATALOG-VERIFICATION.md](FE03-CATALOG-VERIFICATION.md).

**Status aset auth setelah FE-02:** fungsi form/sesi teruji, tetapi export logo, pola dan kolase Login/Register belum tersedia terpisah. Panel teks sementara tidak diklaim identik Figma. Gap ini tetap terbuka untuk penyempurnaan visual; lihat [hasil FE-02](FE02-AUTH-VERIFICATION.md).

Semua path pada tabel relatif terhadap root proyek, nama persis termasuk spasi/underscore. Byte adalah ukuran berkas, bukan dimensi render atau batas optimasi frontend. Screenshot admin dapat dipakai acuan layout, bukan background halaman aplikasi.

| ID | Path lokal | Dimensi px | Byte | Jenis dan penggunaan |
|---|---|---|---|---|
| A-01 | `.Desain/Assets/Hero Page.png` | 1440×552 | 1.200.872 | **Aset individual siap untuk slot hero.** Foto risol/cookies berlatar cokelat, ruang judul di kiri; judul/CTA HTML terpisah. Komposisi sesuai slot hero Figma 30:5, kesamaan byte file remote belum diuji |
| S-01 | `.Desain/Beranda pelanggan (1).png` | 1440×3851 | 3.186.973 | Screenshot beranda desktop: header, hero, voucher, kategori, cards, about, alasan, testimoni, kontak. Acuan komposisi/koreksi PRD; bukan satu gambar pengganti halaman |
| S-02 | `.Desain/Dashbord - Admin.png` | 1440×1024 | 153.295 | Screenshot shell/cards/table/graph; P0 hanya metrik backend aktual, bukan angka/grafik dummy |
| S-03 | `.Desain/Desain Sistem.png` | 1030×1144 | 7.167 | Ekspor bidang abu-abu, tidak memperlihatkan spesifikasi komponen/token yang dapat digunakan. Bukan font/icon/design-system siap pakai |
| S-04 | `.Desain/Halaman menu.png` | 1440×2575 | 3.766.929 | Screenshot katalog desktop, hero/teks/menu tabs/product grid; bukan kumpulan foto produk terpisah |
| S-05 | `.Desain/Kategori - Admin.png` | 1440×1024 | 44.367 | Screenshot kategori kosong; dipakai empty-state layout |
| S-06 | `.Desain/Kategori Produk fiks - Admin.png` | 1440×1024 | 56.834 | Screenshot kategori terisi/card; isi dan jumlah dari API |
| S-07 | `.Desain/Kelola Produk - Admin.png` | 1440×1024 | 197.085 | Screenshot tabel/filter/pagination; status dan delete perlu koreksi sesuai API |
| S-08 | `.Desain/Kelola Produk -_ Tambah Produk - Admin.png` | 1440×1024 | 119.438 | Screenshot upload/preview/form; sidebar salah, kategori bukan teks bebas, stok tanpa Rp dan perlu Simpan/Batal |
| S-09 | `.Desain/Login.png` | 1440×1024 | 1.020.559 | Screenshot form dan ilustrasi makanan/pattern; keduanya tidak tersedia sebagai file individual |
| S-10 | `.Desain/Pengaturan - Produk.png` | 1440×1024 | 45.194 | Screenshot hub Pengaturan; bukan mandat membuat CMS/notifikasi/shipping/payment configuration |
| S-11 | `.Desain/Pengaturan -_ Akun Admin - Admin.png` | 1440×1024 | 158.860 | Screenshot profil admin; foto contoh, username/telepon di luar kontrak; hanya nama editable |
| S-12 | `.Desain/Pengaturan -_ Notifikasi - Admin.png` | 1440×1024 | 108.417 | Screenshot toggle notifikasi di luar P0; tidak dibuat route/control aktif |
| S-13 | `.Desain/Pengaturan -_ Pembayaran - Admin.png` | 1440×1024 | 119.727 | Screenshot COD/rekening/toggle wallet, harus diganti monitoring Midtrans P0; tidak menyalin rekening contoh |
| S-14 | `.Desain/Pengaturan -_ Pengiriman - Admin.png` | 1440×1024 | 102.841 | Screenshot delivery/pickup/tarif/gratis ongkir; hanya info delivery manual tetap yang berlaku, bukan konfigurasi UI |
| S-15 | `.Desain/Pengaturan -_ profil toko - Admin.png` | 1440×1024 | 74.835 | Screenshot CMS profil/logo/kontak/jam di luar P0; jangan membuat API/form submit palsu |
| S-16 | `.Desain/Pesanan - Admin.png` | 1440×1024 | 211.715 | Screenshot ringkasan/filter/table order; nomor/status/kanal/aksi harus diselaraskan, avatar/data contoh bukan data pelanggan |
| S-17 | `.Desain/Pesanan -_ Export Data - Admin.png` | 1440×1024 | 64.070 | Screenshot ekspor di luar P0; tidak dipasang tombol/route ekspor |
| S-18 | `.Desain/Promosi.png` | 1440×1024 | 304.453 | Screenshot banner/table promo umum; dipakai pola visual untuk voucher pembeli baru read-only, bukan CRUD promosi |
| S-19 | `.Desain/Register.png` | 1440×1024 | 1.027.971 | Screenshot form keliru untuk API: tidak ada password/confirmPassword, ada gender/alamat/remember-me. Pertahankan pola visual, koreksi field |
| S-20 | `.Desain/Ulasan Dan Rating.png` | 1440×892 | 114.145 | Screenshot testimoni/kontak, bukan form review item atau bukti author nyata. Gunakan pola kartu saja untuk review produk; form kontak/kurasi P1 tidak dibuat |

Tidak ditemukan SVG, logo mandiri, foto produk mandiri, font WOFF/WOFF2/TTF, atau aset banner/auth mandiri di direktori desain/aset yang diperiksa. Belum ada public dan src/components hanya README. Foto produk backend adalah data dinamis dari API/storage, tidak diinventaris sebagai file publik dengan membaca database/unggahan privat pada FE-00.

## 2. Aset Figma yang terdeteksi, belum file lokal siap pakai

get_design_context frame beranda 29:4 berhasil beserta screenshot/reference code. Context menyediakan referensi asset MCP sementara untuk gambar/ikon. **URL sementara tidak menjadi source URL produksi atau bukti file sudah diunduh.** FE-00 tidak mengunduh semua aset karena scope-nya inventaris; FE terkait harus mengekspor/download aset yang benar sebelum dipakai dan memverifikasi slot/rasionya.

| Kebutuhan | Bukti Figma yang terbaca | Status dan tindakan |
|---|---|---|
| Hero | Image node 30:5, wrapper 54:108, 1440×552 | A-01 lokal tersedia; visual sesuai, byte remote belum dibandingkan. FE-03 periksa crop/object-position di tiap breakpoint |
| Logo/header | Group 74:611, chef-hat 74:613, teks 74:612 dan tagline74:614 | Struktur/icon terdeteksi, belum ada export logo SVG mandiri. Jangan crop logo dari S-01 atau membuat slogan sebagai bagian foto |
| Kategori risol/cookies | Food cutout 36:172/36:173 dan background36:178/36:175 | Referensi image terpisah di context, belum lokal. Perlu export cutout+background sesuai slot; ukuran efek/shadow bukan izin merusak aspect ratio |
| Foto pilihan produk | 36:190–36:194; lima slot foto pada cards | Referensi context ada, belum lokal sebagai lima foto. Produk/name/price harus tetap API-driven; jangan menganggap lima menu pada desain sebagai katalog resmi |
| Foto about | 36:20 di section47:48 | Referensi image context tersedia, belum lokal. Teks section dikoreksi menjadi Tentang Salvora Kitchen |
| Banner promo | Image47:98/48:48, gradient48:46 dan teks48:50/37:22/48:51 | Komposisi tersedia, belum export raster mandiri. Teks asli salah, sehingga teks promo wajib HTML yang dikoreksi; jangan merasterisasi copy lama |
| Ikon navigasi/keunggulan/kontak | Chef, cart/user, panah, leaf/chef/headset/WhatsApp/maps dan lainnya pada context | Referensi SVG terdeteksi, belum lokal. Slot statis Figma memakai ekspor tepat ketika diimplementasikan, terutama identitas/logo; ikon UI tambahan dapat memakai library React konsisten sesuai PRD. Tidak menggambar ulang logo atau mengganti aset yang sudah disediakan secara sembarang; alt/label sesuai tujuan |
| Avatar testimoni | 36:199/36:214/36:223 | Referensi image ada, tetapi testimoni terpilih beranda P1. Jangan mempublikasikan contoh nama/foto/komentar sebagai pembelian terverifikasi |

Metadata halaman/node lain tidak tersedia karena kuota setelah context beranda. Ilustrasi auth/pattern, aset detail mobile serta ikon admin belum diverifikasi langsung dari Figma. Tidak mengarang node ID untuk halaman tersebut. Sumber Figma yang dapat diakses kembali: [beranda 29:4](https://www.figma.com/design/Mz9sFXvJbWMbAlgTY9AaaR/Untitled?node-id=29-4).

## 3. Font dan tema

- **Terbaca langsung pada beranda:** Abhaya Libre Bold untuk heading; Poppins Light/Medium/SemiBold/Bold untuk teks/label/nav/card. Tidak ditemukan file font lokal. Nilai ini tidak membuktikan tiap halaman admin/auth memakai font/weight yang persis sama.
- **Tema terverifikasi beranda:** #FFF6EF, #4E342E, #FF7A00, CTA #B7260C, surface #F8E8D5/#F0D8C0 dan accent kontak #F97316. Rincian node dan ukuran desktop pada FE-DESIGN-AUDIT.
- **Yang tersedia dalam kode sekarang:** Arial/Helvetica dan Georgia/Times, theme sementara berbeda. FE-01 perlu perolehan font resmi yang sesuai dan tokens shadcn/Tailwind. Nama font diketahui bukan berarti font sudah termuat di browser.
- Tidak ada export design-system usable dari S-03. Breakpoint, focus, hover, pressed, disabled dan mobile belum lengkap; keputusan tambahan dicatat sebagai usulan, diuji FE-01/12.

## 4. Kesiapan, placeholder dan pemilik tindak lanjut

| Status | Aset/konten | Pemakaian dan tindak lanjut |
|---|---|---|
| Siap sebagai sumber lokal | A-01 hero | FE-03 menyalin/mengoptimalkan ke path publik stabil saat implementasi, memeriksa dimensinya; sumber asli tidak ditimpa |
| Siap sebagai referensi visual | S-01–S-20 | Referensi audit/review, tidak dipakai sebagai background atau image pengganti komponen interaktif |
| Perlu perolehan FE-01 | Font dan ikon/identitas | Ambil dari sumber resmi/export Figma; state/error/fokus dapat dibangun tanpa menunggu foto toko |
| Perlu export FE-02/03 | Ilustrasi/pattern auth, logo, foto kategori/produk/about/banner | Minta/export aset yang sesuai slot ketika akses tersedia. Sementara gunakan placeholder/fallback eksplisit saat development; penerimaan visual final belum boleh selesai |
| Data dinamis/demo | Product.imageUrl/isDemo, category, harga, stock, rating | Gunakan API; imageUrl null → fallback bernama jelas, jangan URL acak/screenshot crop. Harga/name pada PNG bukan sumber transaksi |
| Konten resmi belum dikonfirmasi | Nomor/alamat kontak, cerita/keunggulan, menu/foto final | FE-03 pisahkan konfigurasi konten dan tandai belum tersedia; jangan menerbitkan nomor/rekening/data contoh screenshot sebagai resmi |
| Tidak diperlukan P0 | Avatar testimoni kurasi, grafik/export/promo CMS/notifikasi | Tidak perlu mengumpulkan/membangun fitur yang ditunda hanya karena gambarnya tersedia |

Placeholder development harus jelas, mudah diganti, tidak melaporkan mutasi palsu atau menyamar sebagai data toko. Untuk frontend demo yang diterima, slot gambar utama dalam cakupan memakai aset yang disepakati dan tidak ada broken-image. Jangan membuat foto/logo baru atau menggambar ulang aset tanpa arahan; audit ini tidak meminta image generation.

## 5. Verifikasi dan batas

Inventaris diperiksa terhadap filesystem, ukuran/dimensi sharp dan contact sheet semua 21 file. Beberapa screenshot diperiksa full-size untuk field dan koreksi. Metadata berhasil walau label contact sheet memberi peringatan fontconfig cache sandbox; tidak membuat perubahan cache global. Pemeriksaan sumber belum berarti konten final disetujui, font terpasang atau layout mobile telah lolos browser. Tidak ada PNG sumber dimodifikasi, tidak ada dependency/DB/provider/task yang disentuh dan tidak ada aset remote yang diklaim sudah lokal.

FE-00 selesai dengan gap ini eksplisit. **FE-01 siap untuk fondasi tema/komponen/API client; FE-02/03 dan FE-12 harus menutup kebutuhan aset/visual yang relevan sebelum diterima.**
