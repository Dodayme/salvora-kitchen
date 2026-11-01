# FE-06 — Snap Sandbox, status, retry dan finish

25 Oktober 2026. PRD 1.9 FR-07; kontrak API 0.13; [PAYMENTS](PAYMENTS.md), [WEBHOOKS](WEBHOOKS.md), [RECONCILIATION](RECONCILIATION.md), dan [FE-05](FE05-CHECKOUT-VERIFICATION.md).

**Status: Ditinjau.** Implementasi UI/controller, unit/mock dan integrasi HTTP/PostgreSQL test lulus. Interaksi browser/Snap asli, redirect/refresh melalui browser dan pembayaran VA Sandbox baru belum dibuktikan. Pemeriksaan konfigurasi Snap valid tetapi konfigurasi webhook HTTPS belum valid. FE-05 juga tetap Ditinjau untuk gap browser sebelumnya; task ini tidak mengubah statusnya menjadi Selesai.

## Perilaku

| Bagian | Implementasi |
|---|---|
| `/pembayaran/[orderId]` | BUYER; membaca GET order melalui sesi pemilik. ID valid tetapi asing/hilang mengikuti API 404; document/gate dapat HTTP 200. Controller di-remount saat orderId berubah |
| Dari checkout | Hasil order FE-05 menautkan halaman pembayaran, tanpa token/provider reference pada URL |
| SDK | Tombol **Siapkan Snap Sandbox** memuat Next/Script resmi `https://app.sandbox.midtrans.com/snap/snap.js` dengan client key publik berformat Sandbox. Tidak memakai URL/script produksi atau paket baru |
| Bayar | Tombol terpisah **Bayar / lanjutkan Snap Sandbox** memeriksa SDK, konteks tab, canPay server dan deadline; lalu POST payments dengan JSON `{}`. Lock sinkron mencegah klik bersamaan dan charge ulang saat popup masih terbuka |
| 201 / 200 | Instruction dengan token PENDING yang valid membuka `snap.pay`; `reused` membedakan instruksi baru/aktif. URL/token hanya di memori alur SDK, tidak disimpan pada state tampilan atau storage |
| 202 / instruksi belum siap | Token null/CREATED/UNCONFIRMED tidak membuka popup atau otomatis membuat percobaan pengganti. Baca GET lokal dan ikuti canPay/canReconcile server |
| Callback | onSuccess/onPending/onError/onClose mengabaikan seluruh payload, menutup SDK dan membaca GET lokal. Callback tidak menerapkan sukses/gagal pada order. Callback berulang diabaikan; callback sinkron mock juga aman terhadap lock |
| Respons hilang/error | Status perlu dibaca ulang. Tidak otomatis retry POST payment. 409/502/503/network/protocol tidak dianggap bukti gagal/sukses; status fresh server menentukan apakah tindakan eksplisit berikutnya boleh dilakukan |
| Refresh | Initial mount dan callback hanya GET lokal; tombol **Perbarui status pesanan** juga GET. Tidak ada polling, POST pada effect, atau panggilan gateway otomatis dari timer/callback |
| Rekonsiliasi | Tombol **Periksa pembayaran lewat server** hanya aktif saat canReconcile server true, status telah terbaca, tidak ada aksi/popup, dan cooldown berakhir. POST reconcile `{}` hanya dari klik; dapat menghubungi provider melalui backend |
| 429 / 503 reconcile | Retry-After ditampilkan dan dicek ulang pada controller. Status belum pasti menahan aksi sampai GET ulang; tidak menyimpulkan stok/voucher dilepas |
| Tenggat | Countdown dari paymentDeadline server; nol menurut jam perangkat mematikan pembuatan. Tidak memperpanjang deadline atau menyatakan reservasi dilepas. Instruksi dengan expiry berbeda dari deadline ditolak |
| Status | Badge order dan payment terpisah, percobaan/kanal/nominal/waktu dari server. NEEDS_ATTENTION/refund/reversal meminta pemeriksaan tanpa janji refund otomatis |

SDK mengikuti [Snap JS resmi](https://docs.midtrans.com/reference/snap-js) untuk pay/hide dan empat callback. Custom callback hanya dipakai sebagai sinyal membaca status aplikasi; verifikasi server Salvora tetap otoritas. Server sudah mengatur kanal bank transfer dan expiry; frontend tidak membuat nominal, kanal merchant, referensi provider atau status sendiri.

### Finish dan privasi

`/payment/finish` tetap menampilkan informasi publik bahwa redirect bukan bukti bayar. Client memeriksa sesi dan konteks **tab yang sama**. Konteks hanya `{version,ownerId,orderId}` di sessionStorage `salvora-payment-return-v1`, disimpan sebelum meminta instruksi. Tidak ada token Snap, redirect URL, nominal, alamat, cookie atau key server di konteks.

Pemilik berbeda, logout/anonymous/401 dan sinyal auth antar-tab menghapus konteks. Storage gagal menahan permintaan instruksi baru. Konteks hilang/rusak tidak menebak dari query. Finish **tidak membaca** order_id, transaction_status, token atau parameter provider untuk memilih/melunaskan order. Konteks valid tetap harus melewati GET order dengan otorisasi server. Tab/origin berbeda tanpa konteks harus membuka kembali halaman pembayaran dari pesanan sendiri; riwayat lengkap adalah FE-07.

Data instruction divalidasi: token UUID, hanya origin Sandbox dan path Snap yang cocok dengan token, tanpa credentials/query/hash; pair token/URL dan status harus konsisten. Referensi provider/token dari instruction tidak dirender. Decoder order membuang token, referensi provider dan field privat dari daftar yang ditampilkan. Callback payload dan error mentah SDK tidak dicetak/dipersist.

## Perubahan

- `src/lib/payment-client/model.ts`: DTO order/instruction/reconcile browser, validasi Sandbox, gating dan countdown.
- `src/lib/payment-client/controller.ts`: GET/pay/SDK callback/reconcile, lock, cooldown, unknown dan lifecycle.
- `src/lib/payment-client/return-context.ts`: konteks order/owner minimal untuk finish.
- `src/components/payment/payment-screen.tsx`, `finish-content.tsx`: UI pembayaran, pemuatan SDK dan pemulihan finish.
- `src/app/pembayaran/[orderId]/page.tsx`, `src/app/payment/finish/page.tsx`: route BUYER dan informasi finish.
- Checkout menautkan pembayaran; safeReturnTo menerima route internal pembayaran/finish tanpa query provider. Cleanup auth FE-05 juga membersihkan konteks pembayaran.
- `tests/payment-client.test.ts`: 36 tes baru. `scripts/verify-checkout-ui-http.mjs --payment-client` menambah mode kosong-key yang eksplisit, namespace fixture/result FE-06 dan jalur test pembayaran terbatas.

Service backend, payload kontrak, schema/migrasi, `.env`, key merchant, task Windows, backup/rollback dan database dev tidak diubah. Tidak membuat transaksi provider baru atau menjalankan rekonsiliasi manual terhadap dev. Tidak memasang dependency baru.

## Verifikasi aktual

| Lapisan/perintah | Hasil |
|---|---|
| `npm.cmd test` | **19 file / 302 tes lulus**, 36 baru FE-06. Mock API/SDK menguji baru/reuse/tokenless, empat callback, callback sinkron/duplikat, double click, unknown/error, cooldown, canReconcile, 503, logout/disposal, wrong order/deadline, SDK throw, refund/reversal, storage dan URL Sandbox |
| `npm.cmd run build` | Lulus; route pembayaran dan finish tersedia. Tidak membuktikan pemuatan SDK/popup nyata |
| `npm.cmd run typecheck` | Lulus |
| `npm.cmd run lint` | Lulus; dua warning parameter noop mock dibersihkan sebelum penutup |
| `npm.cmd run check:client` | PASS, 55 source files / 30 browser artifacts / empat nilai privat diperiksa tanpa dicetak |
| `node --import tsx scripts/verify-checkout-ui-http.mjs --payment-client` | **PASS empat kelompok** pada Next HTTP + PostgreSQL test: tiga regresi checkout FE-05 dan kelompok pembayaran di bawah |
| `node --import tsx scripts/check-env.ts --snap` | Validasi konfigurasi lokal lulus, **tanpa koneksi provider** |
| `node --import tsx scripts/check-env.ts --payment` | Belum lulus: MIDTRANS_WEBHOOK_URL belum lengkap/valid. Tidak mengganti `.env` atau menghidupkan tunnel |
| HTTP development finish/payment document | HTTP 200. Hanya membuktikan route/document/gate; bukan otorisasi, popup, pembayaran, browser render atau webhook |

Integrasi pembayaran memakai frontend controller yang sama dan GET pemilik nyata, membaca canPay=true/canReconcile=false pada order baru. canReconcile=false tidak mengirim endpoint reconcile. Next child memakai **kedua key provider kosong**, sehingga klik controller pay ditolak 503 ENV_NOT_CONFIGURED **sebelum Payment dibuat**; SDK tidak dibuka. Buyer fixture lain GET order itu → 404. Query finish `transaction_status=settlement&order_id=foreign-fixture` tidak mengubah AWAITING_PAYMENT. Payment count fixture tetap nol. Ini bukti guard/integrasi lokal, bukan bukti token/payment/refund/rekonsiliasi provider nyata.

HTTP 201/200/202 instruction, callback, rekonsiliasi 429/503/sukses, refund/reversal dan SDK throw pada tes FE-06 memakai mock. Keberhasilan backend BNI VA BE-14 tetap bukti historis backend dan **tidak menggantikan penerimaan UI FE-06**.

### Isolasi

URL loopback 55433 dan `current_database()/inet_server_port()` harus membuktikan `salvora_kitchen_test` sebelum fixture ditulis. Namespace UUID `fe06-...`; DATABASE_URL child kosong, NODE_ENV=test dan auth secret run baru. Transport melarang provider path; endpoint payments hanya dibolehkan dalam mode `--payment-client` dengan konfigurasi key kosong. Tidak ada endpoint reconcile yang dipanggil pada integrasi ini. Mode UI FE-05 tetap memblokir payment paths.

Cleanup hanya ID/email run dan menolak penghapusan jika ditemukan Payment/bukti provider pada order fixture. **15 fingerprint cocok**, sisa user fixture nol: User, Session, Address, Category, Product, Cart, CartItem, Discount, CheckoutQuote, Order, OrderItem, StockReservation, OrderStatusHistory, Payment, Rating. Rate-limit hanya key run. Tidak reset test, memodifikasi fixture provider lama, menggunakan 5432/LanggananKu atau menghapus bukti lama.

Artefak tersanitasi: `.local/fe06/http-result.json` (ignored), PASS/cleanupPass=true/providerCalls=0/browserTested=false. Server uji sementara telah ditutup; development server pengguna tetap aktif.

## Kriteria belum terpenuhi

1. Browser nyata: SDK load/failure, popup close/pending/success/error, refresh/finish konteks benar, keyboard/fokus dan 360/768/1440px. DOM/browser controller tidak terhubung pada sesi sebelumnya, izin kontrol Chrome timeout pada FE-05; tidak mengulangi atau mengklaim browser FE-06 lulus.
2. HTTPS webhook baru yang terverifikasi dan satu transaksi VA Sandbox **baru**, diotorisasi terpisah, melalui UI ini. Snap token, redirect, callback atau pengalaman proyek lain tidak cukup.
3. Korelasi bukti UI dengan webhook, status lokal dan SQL penerapan tepat sekali. Jangan memakai ulang proof/referensi BE-14 lama atau menyamakan countdown dengan release.

Rencana terpisah: [FE06-SANDBOX-PLAN.md](FE06-SANDBOX-PLAN.md). Belum membuat transaksi, tunnel, payment attempt atau menyiapkan merchant baru. FE-05 tetap Ditinjau. FE-07 dapat menggunakan GET order/status yang sama, dengan gap penerimaan FE-05/06 tetap terbuka; deployment/Figma/UAT seluruh produk belum diterima.
