import { PublicShell } from "@/components/layout/public-shell";
import { FinishContent } from "@/components/payment/finish-content";

export default function PaymentFinish() {
  return <PublicShell><section className="mx-auto flex max-w-xl flex-col gap-4 px-5 pt-12">
    <h1 className="text-2xl font-semibold">Kembali dari pembayaran</h1>
    <p>Status pesanan diperbarui setelah pembayaran terverifikasi. Informasi pada halaman pembayaran belum menjadi konfirmasi pesanan telah dibayar.</p>
  </section><FinishContent /></PublicShell>;
}
