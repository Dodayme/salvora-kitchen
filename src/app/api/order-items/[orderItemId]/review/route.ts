import { reviews } from "@/lib/reviews/server";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ orderItemId: string }> }) {
  return reviews.create(request, (await context.params).orderItemId);
}
