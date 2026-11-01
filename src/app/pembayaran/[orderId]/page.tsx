import { notFound } from "next/navigation";
import { PublicShell } from "@/components/layout/public-shell";
import { RequireRole } from "@/components/auth/require-role";
import { PaymentScreen } from "@/components/payment/payment-screen";
import { validOrderId } from "@/lib/payment-client/model";
export const metadata = { title: "Pembayaran | Salvora Kitchen" };
export default async function PaymentPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  if (!validOrderId(orderId)) notFound();
  return <PublicShell><RequireRole role="BUYER"><PaymentScreen key={orderId} orderId={orderId} /></RequireRole></PublicShell>;
}
