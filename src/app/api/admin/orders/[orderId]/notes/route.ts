import { orders } from "@/lib/orders/server";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ orderId: string }> }) {
  return orders.addNote(request, (await context.params).orderId);
}
