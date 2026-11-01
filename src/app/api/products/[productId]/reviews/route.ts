import { reviews } from "@/lib/reviews/server";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ productId: string }> }) {
  return reviews.list(request, (await context.params).productId);
}
