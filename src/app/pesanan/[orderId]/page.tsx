import { notFound } from "next/navigation";
import { PublicShell } from "@/components/layout/public-shell";
import { RequireRole } from "@/components/auth/require-role";
import { OrderDetailScreen } from "@/components/orders/order-screens";
import { validOrderId } from "@/lib/payment-client/model";
export const metadata = { title: "Detail pesanan | Salvora Kitchen" };
export default async function OrderPage({ params }: { params: Promise<{ orderId: string }> }) { const { orderId } = await params; if (!validOrderId(orderId)) notFound(); return <PublicShell><RequireRole role="BUYER"><OrderDetailScreen key={orderId} orderId={orderId} /></RequireRole></PublicShell>; }
