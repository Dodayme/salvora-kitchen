import { notFound } from "next/navigation";
import { AdminOrderDetailScreen } from "@/components/admin/order-screens";
import { validOrderId } from "@/lib/payment-client/model";
export const metadata = { title: "Detail pesanan admin | Salvora Kitchen" };
export default async function Page({ params }: { params: Promise<{ orderId: string }> }) { const { orderId } = await params; if (!validOrderId(orderId)) notFound(); return <AdminOrderDetailScreen orderId={orderId} />; }
