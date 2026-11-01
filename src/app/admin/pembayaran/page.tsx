import { AdminPaymentListScreen } from "@/components/admin/order-screens";
export const metadata = { title: "Pembayaran admin | Salvora Kitchen" };
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) { const query = await searchParams; const orderId = typeof query.orderId === "string" ? query.orderId : query.orderId ? "invalid/id" : ""; return <AdminPaymentListScreen key={orderId} initialOrderId={orderId} />; }
