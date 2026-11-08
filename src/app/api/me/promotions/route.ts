import { getDatabase } from "@/lib/db";
import { requireSessionUser } from "@/lib/auth/server";
import { route, success } from "@/lib/api/response";
export const runtime = "nodejs";
export const GET = route(async request => {
 const user = await requireSessionUser(request, "BUYER");
 const now = new Date();
 const data = await getDatabase().eventPromotion.findMany({ where: { isActive: true, startsAt: { lte: now }, endsAt: { gt: now }, OR: [{ recipientIds: { isEmpty: true } }, { recipientIds: { has: user.id } }] }, orderBy: { endsAt: "asc" }, select: { id: true, name: true, percentage: true, maxDiscount: true, endsAt: true, photoId: true } });
 const response = success(data); response.headers.set("Vary", "Cookie"); return response;
});
