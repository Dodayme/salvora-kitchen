import { catalog } from "@/lib/catalog/server";
export const runtime = "nodejs";
type Context = { params: Promise<{ categoryId: string }> };
export async function PATCH(request: Request, context: Context) { return catalog.updateCategory(request, (await context.params).categoryId); }
export async function DELETE(request: Request, context: Context) { return catalog.deleteCategory(request, (await context.params).categoryId); }
