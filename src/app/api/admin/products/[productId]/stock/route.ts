import { catalog } from "@/lib/catalog/server";
export const runtime = "nodejs";
export async function PUT(request: Request, context: { params: Promise<{ productId: string }> }) { return catalog.updateStock(request, (await context.params).productId); }
