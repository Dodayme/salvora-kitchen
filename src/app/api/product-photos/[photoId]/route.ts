import { readPhoto } from "@/lib/catalog/server";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ photoId: string }> }) { return readPhoto(request, (await context.params).photoId); }
