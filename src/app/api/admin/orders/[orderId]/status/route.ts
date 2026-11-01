import { orders } from "@/lib/orders/server";
export const runtime = "nodejs";
export async function PATCH(request: Request, context: { params: Promise<{ orderId: string }> }) {
  return orders.fulfill(request, (await context.params).orderId);
}
