import { payOrder } from "@/lib/payments/server";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ orderId: string }> }) {
  return payOrder(request, (await context.params).orderId);
}
