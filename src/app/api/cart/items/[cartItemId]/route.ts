import { buyer } from "@/lib/buyer/server";
export const runtime = "nodejs";
type Context = { params: Promise<{ cartItemId: string }> };
export async function PATCH(request: Request, context: Context) { return buyer.setItem(request, (await context.params).cartItemId); }
export async function DELETE(request: Request, context: Context) { return buyer.deleteItem(request, (await context.params).cartItemId); }
