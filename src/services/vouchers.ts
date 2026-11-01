import type { Prisma, PrismaClient } from "../generated/prisma/client";
import { requireRole, type Principal } from "../lib/auth/access";

// Shared by issuance and pricing. Successful payment application is authoritative;
// terminal refund/reversal states never restore first-purchase eligibility.
export async function firstPurchaseEligible(tx: Prisma.TransactionClient, userId: string) {
  const user = await tx.user.findUnique({ where: { id: userId }, select: { role: true, isFirstPurchase: true } });
  if (!user || user.role !== "BUYER" || !user.isFirstPurchase) return false;
  const paid = await tx.order.findFirst({ where: { userId, OR: [
    { application: { isNot: null } },
    { payments: { some: { status: { in: ["SUCCESS", "REFUNDED", "PARTIALLY_REFUNDED", "REVERSED"] } } } },
  ] }, select: { id: true } });
  return !paid;
}

export async function issueNewBuyerVoucher(tx: Prisma.TransactionClient, userId: string) {
  // Same account lock as cart mutations; payment application must acquire it too.
  await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;
  if (!await firstPurchaseEligible(tx, userId)) return;
  // Existing RESERVED/USED rows are intentionally left untouched. The unique userId
  // index is the final guard against duplicate issuance, beyond this transaction.
  await tx.discount.upsert({ where: { userId }, create: { userId }, update: {} });
}

export function createVoucherService(db: PrismaClient) {
  return {
    async mine(principal: Principal | null) {
      const user = requireRole(principal, "BUYER");
      const voucher = await db.discount.findUnique({ where: { userId: user.id }, select: {
        id: true, type: true, percentage: true, maxDiscount: true, status: true, reservedOrderId: true, usedAt: true,
      } });
      return { voucher: voucher ? { ...voucher, usedAt: voucher.usedAt?.toISOString() ?? null } : null };
    },
  };
}
