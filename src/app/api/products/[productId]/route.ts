import { catalog } from "@/lib/catalog/server";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ productId: string }> }) {
  return catalog.product(request, (await context.params).productId);
}
