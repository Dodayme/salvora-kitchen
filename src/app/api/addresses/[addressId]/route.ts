import { buyer } from "@/lib/buyer/server";
export const runtime = "nodejs";
type Context = { params: Promise<{ addressId: string }> };
export async function PATCH(request: Request, context: Context) { return buyer.updateAddress(request, (await context.params).addressId); }
export async function DELETE(request: Request, context: Context) { return buyer.deleteAddress(request, (await context.params).addressId); }
