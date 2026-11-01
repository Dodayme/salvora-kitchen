import { Prisma, type PrismaClient } from "../generated/prisma/client";
import { ApiError } from "../lib/api/errors";
import { requirePrincipal, type Principal } from "../lib/auth/access";
import { consumeRateLimit } from "../lib/auth/rate-limit";
import { idSchema } from "../lib/catalog/validation";
import { definitiveSnapRejection, verifiedTerminal } from "../lib/payments/retry";
import type { StatusGateway } from "../lib/payments/status";
import { orderView } from "./checkout";
import { createPaymentVerificationService } from "./payment-verification";

async function clock(db: Prisma.TransactionClient) { return (await db.$queryRaw<Array<{ time: Date }>>`SELECT clock_timestamp() AS time`)[0].time; }
const unavailable = () => new ApiError(503, "PAYMENT_RECONCILIATION_UNCONFIRMED", "Sebagian status pembayaran belum dapat dipastikan. Reservasi tetap ditahan; coba periksa kembali.", undefined, 30);

export function createReconciliationService(db: PrismaClient, settings: { serverKey: string; authSecret: string; gateway: StatusGateway }) {
  const verification = createPaymentVerificationService(db, settings);
  async function release(orderId: string, userId: string, safeIds: Set<string>) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await db.$transaction(async tx => {
          await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;
          await tx.$queryRaw`SELECT id FROM "Order" WHERE id=${orderId} FOR UPDATE`;
          const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: { include: { reservation: true } }, payments: { include: { events: true } }, application: true } });
          const time = await clock(tx);
          if (order.status !== "AWAITING_PAYMENT" || order.paymentDeadline > time || order.application || !order.payments.every(p => safeIds.has(p.id) && verifiedTerminal(p))) return false;
          const productIds = order.items.map(i => i.productId).sort();
          if (productIds.length) await tx.$queryRaw(Prisma.sql`SELECT id FROM "Product" WHERE id IN (${Prisma.join(productIds)}) ORDER BY id FOR UPDATE`);
          await tx.$queryRaw`SELECT id FROM "Discount" WHERE "userId"=${userId} FOR UPDATE`;
          // A malformed reservation is an operational exception, never a partial release.
          const voucher = order.discountId ? await tx.discount.findFirst({ where: { id: order.discountId, userId, status: "RESERVED", reservedOrderId: orderId }, select: { id: true } }) : null;
          if (!order.items.length || order.items.some(i => i.reservation?.status !== "RESERVED" || i.reservation.expiresAt.getTime() !== order.paymentDeadline.getTime()) || order.discountId && !voucher) throw new ApiError(409, "ORDER_RESERVATION_INVALID", "Reservasi perlu diperiksa sebelum pelepasan.");
          for (const item of [...order.items].sort((a, b) => a.productId.localeCompare(b.productId))) {
            const rows = await tx.$queryRaw<Array<{ id: string }>>`UPDATE "Product" SET "reservedStock"="reservedStock"-${item.quantity},"updatedAt"=GREATEST(date_trunc('milliseconds',clock_timestamp()),"updatedAt"+interval '1 millisecond') WHERE id=${item.productId} AND "reservedStock">=${item.quantity} RETURNING id`;
            if (rows.length !== 1) throw unavailable();
            await tx.stockReservation.update({ where: { orderItemId: item.id }, data: { status: "RELEASED", finalizedAt: time } });
          }
          if (voucher) await tx.discount.update({ where: { id: voucher.id }, data: { status: "AVAILABLE", reservedOrderId: null } });
          await tx.order.update({ where: { id: orderId }, data: { status: "EXPIRED" } });
          await tx.orderStatusHistory.create({ data: { orderId, fromStatus: "AWAITING_PAYMENT", toStatus: "EXPIRED", actor: "SYSTEM", changedAt: time, note: "Tenggat berakhir; seluruh percobaan dipastikan tidak aktif. Reservasi dilepas." } });
          return true;
        }, { timeout: 15000 });
      } catch (error) {
        const retryable = error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2034" || error.code === "P2010" && ["40P01", "40001"].includes(String(error.meta?.code)));
        if (!retryable || attempt >= 2) throw error;
      }
    }
  }
  async function reconcileOrder(orderId: string, source: "STATUS_API" | "SCHEDULER") {
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, select: { userId: true, payments: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], include: { events: true } } } });
    const safeIds = new Set<string>(); let uncertain = false;
    // Each attempt is independently persisted. A failing provider lookup must not
    // prevent another attempt's verified success from being recorded.
    for (const payment of order.payments) {
      if (definitiveSnapRejection(payment)) { safeIds.add(payment.id); continue; }
      try { const result = await verification.reconcilePayment(payment.id, source); if (result.safeTerminal) safeIds.add(payment.id); }
      catch { uncertain = true; }
    }
    const released = await release(orderId, order.userId, safeIds);
    if (uncertain) throw unavailable();
    return { released };
  }
  return {
    // Internal only. No unauthenticated HTTP cron endpoint is exposed.
    reconcileOrder,
    async reconcile(principal: Principal | null, orderId: string) {
      const user = requirePrincipal(principal); idSchema.parse(orderId);
      const order = await db.order.findFirst({ where: { id: orderId, ...(user.role === "ADMIN" ? {} : { userId: user.id }) }, select: { userId: true } });
      if (!order) throw new ApiError(404, "NOT_FOUND", "Data tidak ditemukan.");
      const time = await db.$transaction(clock);
      await consumeRateLimit(db, settings.authSecret, "reconcile-user", user.id, 20, time);
      await consumeRateLimit(db, settings.authSecret, "reconcile-order", orderId, 1, time, 30000);
      await reconcileOrder(orderId, "STATUS_API");
      return db.$transaction(async tx => ({ order: await orderView(tx, orderId, order.userId), reconciledAt: (await clock(tx)).toISOString() }));
    },
  };
}
