import type { PrismaClient } from "../generated/prisma/client";
import { requireRole, type Principal } from "../lib/auth/access";
import { ApiError } from "../lib/api/errors";
import { promotionInput } from "../lib/promotions/model";
export async function createPromotion(db: PrismaClient, principal: Principal | null, input: unknown) {
  requireRole(principal, "ADMIN");
  const value = promotionInput.parse(input);
  if (value.photoId && !await db.productPhoto.findUnique({ where: { id: value.photoId } })) throw new ApiError(422, "INVALID_PHOTO", "Foto promosi tidak ditemukan.");
  const emails = [...new Set(value.emails.map(email => email.toLowerCase()))];
  const users = value.audience === "SELECTED" ? await db.user.findMany({ where: { role: "BUYER", OR: emails.map(email => ({ email: { equals: email, mode: "insensitive" as const } })) }, select: { id: true } }) : [];
  if (value.audience === "SELECTED" && users.length !== emails.length) throw new ApiError(422, "INVALID_RECIPIENTS", "Ada email yang belum terdaftar sebagai pembeli. Periksa daftar penerima.");
  return db.eventPromotion.create({ data: { photoId: value.photoId, name: value.name, percentage: value.percentage, maxDiscount: value.maxDiscount, startsAt: new Date(value.startsAt), endsAt: new Date(value.endsAt), recipientIds: users.map(user => user.id) } });
}
