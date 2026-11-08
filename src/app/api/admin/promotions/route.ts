import { z } from "zod";
import { getDatabase } from "@/lib/db";
import { authContext, requireSessionUser } from "@/lib/auth/server";
import { checkOrigin } from "@/lib/auth/access";
import { route, success } from "@/lib/api/response";
import { jsonBody } from "@/lib/api/input";
import { createPromotion } from "@/services/promotions";
export const runtime = "nodejs";
export const GET = route(async request => {
  await requireSessionUser(request, "ADMIN");
  return success(await getDatabase().eventPromotion.findMany({ orderBy: { createdAt: "desc" } }));
});
export const POST = route(async request => {
  checkOrigin(request, authContext().settings.appUrl);
  const user = await requireSessionUser(request, "ADMIN");
  return success(await createPromotion(getDatabase(), user, await jsonBody(request, z.unknown())), { status: 201 });
});
export const PATCH = route(async request => {
  checkOrigin(request, authContext().settings.appUrl);
  await requireSessionUser(request, "ADMIN");
  const value = await jsonBody(request, z.union([z.strictObject({ id: z.string().uuid(), isActive: z.boolean() }), z.strictObject({ id: z.string().uuid(), photoId: z.uuid() })]));
  return success(await getDatabase().eventPromotion.update({ where: { id: value.id }, data: "photoId" in value ? { photoId: value.photoId } : { isActive: value.isActive } }));
});
