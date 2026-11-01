import { catalog } from "@/lib/catalog/server";
export const runtime = "nodejs";
type Context = { params: Promise<{ productId: string }> };
export async function GET(request: Request, context: Context) { return catalog.adminProduct(request, (await context.params).productId); }
export async function PATCH(request: Request, context: Context) { return catalog.updateProduct(request, (await context.params).productId); }
