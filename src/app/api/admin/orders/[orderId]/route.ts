import { orders } from "@/lib/orders/server";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ orderId: string }> }) {
  return orders.adminDetail(request, (await context.params).orderId);
}
