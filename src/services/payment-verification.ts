import { createHash } from "node:crypto";
import { Prisma, type PaymentStatus, type PrismaClient } from "../generated/prisma/client";
import { ApiError } from "../lib/api/errors";
import { mapProviderStatus, notificationSchema, providerTime, rupiah, verifyNotificationSignature, type ProviderStatus, type StatusGateway } from "../lib/payments/status";

const paidRank: Partial<Record<PaymentStatus, number>> = { SUCCESS: 1, PARTIALLY_REFUNDED: 2, REFUNDED: 3, REVERSED: 4 };
const terminal = new Set<PaymentStatus>(["FAILED", "CANCELLED", "EXPIRED"]);
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const unavailable = () => new ApiError(503, "MIDTRANS_STATUS_UNCONFIRMED", "Status pembayaran belum dapat dipastikan. Notifikasi perlu dicoba kembali.", undefined, 3);
async function clock(tx: Prisma.TransactionClient) { return (await tx.$queryRaw<Array<{ time: Date }>>`SELECT clock_timestamp() AS time`)[0].time; }

export function createPaymentVerificationService(db: PrismaClient, settings: { serverKey: string; gateway: StatusGateway }) {
  async function verify(reference: string, source: "WEBHOOK" | "STATUS_API" | "SCHEDULER", notification?: ProviderStatus) {
      const payment = await db.payment.findUnique({ where: { providerOrderId: reference }, include: { order: { select: { userId: true } } } });
      if (!payment) throw new ApiError(404, "PAYMENT_NOT_FOUND", "Referensi pembayaran tidak ditemukan.");
      const reject = async (code: string): Promise<never> => {
        const key = digest([source, "rejected", notification?.transaction_id ?? reference, code]);
        await db.paymentEvent.upsert({ where: { paymentId_deduplicationKey: { paymentId: payment.id, deduplicationKey: key } }, create: { paymentId: payment.id, deduplicationKey: key, source, verification: "REJECTED", errorCode: code }, update: {} });
        throw new ApiError(409, code, "Referensi atau nominal notifikasi tidak cocok.");
      };
      if (notification && (rupiah(notification.gross_amount) !== payment.amount || notification.currency !== undefined && notification.currency !== payment.currency)) return reject("PAYMENT_AMOUNT_MISMATCH");
      if (notification && payment.midtransTransactionId && payment.midtransTransactionId !== notification.transaction_id) return reject("PAYMENT_REFERENCE_MISMATCH");
      let latest: ProviderStatus | null;
      try { latest = await settings.gateway.get(payment.providerOrderId); }
      catch { latest = null; }
      if (!latest) {
        const key = digest([source, "status-unavailable", notification?.transaction_id ?? reference]);
        await db.paymentEvent.upsert({ where: { paymentId_deduplicationKey: { paymentId: payment.id, deduplicationKey: key } }, create: { paymentId: payment.id, deduplicationKey: key, source, verification: "UNCONFIRMED", errorCode: "PROVIDER_STATUS_UNAVAILABLE" }, update: {} });
        throw unavailable();
      }
      if (latest.order_id !== payment.providerOrderId || notification && latest.transaction_id !== notification.transaction_id || payment.midtransTransactionId && latest.transaction_id !== payment.midtransTransactionId) return reject("PAYMENT_REFERENCE_MISMATCH");
      if (rupiah(latest.gross_amount) !== payment.amount) return reject("PAYMENT_AMOUNT_MISMATCH");
      // Core API defines gross_amount in IDR; documented legacy bank responses
      // omit currency. An explicitly different/empty currency is never accepted.
      if (latest.currency !== undefined && latest.currency !== "IDR") throw unavailable();
      const mapped = mapProviderStatus(latest);
      const transactionTime = providerTime(latest.transaction_time);
      const successTime = mapped.status === "SUCCESS" ? providerTime(latest.transaction_status.toLowerCase() === "capture" ? latest.transaction_time : latest.settlement_time) ?? payment.paidAt : null;
      if (latest.transaction_time && !transactionTime || mapped.status === "SUCCESS" && !successTime) throw unavailable();
      const eventKey = digest([source, "verified-status", latest.order_id, latest.transaction_id, payment.amount, mapped.providerStatus, latest.status_code, latest.fraud_status?.toLowerCase() ?? null, successTime?.toISOString() ?? null]);
      let safeTerminal = false;
      for (let attempt = 0; ; attempt++) {
        try {
          await db.$transaction(async tx => {
            await tx.$queryRaw`SELECT id FROM "User" WHERE id=${payment.order.userId} FOR UPDATE`;
            await tx.$queryRaw`SELECT id FROM "Order" WHERE id=${payment.orderId} FOR UPDATE`;
            const order = await tx.order.findUniqueOrThrow({ where: { id: payment.orderId }, include: { items: { include: { reservation: true } }, application: true, payments: { select: { id: true, status: true } } } });
            const productIds = order.items.map(item => item.productId).sort();
            if (productIds.length) await tx.$queryRaw(Prisma.sql`SELECT id FROM "Product" WHERE id IN (${Prisma.join(productIds)}) ORDER BY id FOR UPDATE`);
            await tx.$queryRaw`SELECT id FROM "Discount" WHERE "userId"=${order.userId} FOR UPDATE`;
            await tx.$queryRaw`SELECT id FROM "Payment" WHERE id=${payment.id} FOR UPDATE`;
            const current = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
            if (current.midtransTransactionId && current.midtransTransactionId !== latest.transaction_id) throw new ApiError(409, "PAYMENT_REFERENCE_MISMATCH", "Identitas transaksi tidak cocok.");
            const bound = await tx.payment.findUnique({ where: { midtransTransactionId: latest.transaction_id }, select: { id: true } });
            if (bound && bound.id !== current.id) throw new ApiError(409, "PAYMENT_REFERENCE_CONFLICT", "Identitas transaksi telah terikat pembayaran lain.");
            const time = await clock(tx);
            let orderStatus = order.status, attentionReason = order.attentionReason;
            async function transition(status: typeof order.status, note: string, reason: string | null = null) {
              const nextReason = status === "NEEDS_ATTENTION" ? attentionReason ?? reason : null;
              if (orderStatus === status && attentionReason === nextReason) return;
              await tx.order.update({ where: { id: order.id }, data: { status, attentionReason: nextReason } });
              await tx.orderStatusHistory.create({ data: { orderId: order.id, fromStatus: orderStatus, toStatus: status, actor: "SYSTEM", changedAt: time, note } });
              orderStatus = status; attentionReason = nextReason;
            }
            const oldRank = paidRank[current.status] ?? 0, newRank = paidRank[mapped.status] ?? 0;
            const regression = terminal.has(current.status) && ["PENDING", "UNCONFIRMED"].includes(mapped.status);
            const ignored = oldRank > newRank || regression;
            const next = ignored ? current.status : mapped.status;
            const paidAt = current.paidAt ?? successTime;
            const patch = {
              status: next, midtransTransactionId: latest.transaction_id,
              providerStatus: ignored ? current.providerStatus : mapped.providerStatus,
              channel: latest.payment_type ?? current.channel,
              transactionTime: current.transactionTime ?? transactionTime,
              paidAt: next === "SUCCESS" ? paidAt : current.paidAt,
            };
            const changed = Object.entries(patch).some(([key, value]) => {
              const previous = current[key as keyof typeof patch];
              return previous instanceof Date && value instanceof Date ? previous.getTime() !== value.getTime() : previous !== value;
            });
            if (changed) await tx.payment.update({ where: { id: current.id }, data: patch });
            if (regression) await transition("NEEDS_ATTENTION", "Status penyedia bertentangan dengan percobaan terminal; perlu pemeriksaan.", "PROVIDER_STATUS_REGRESSION");
            if (newRank && !ignored) {
              await tx.user.updateMany({ where: { id: order.userId, isFirstPurchase: true }, data: { isFirstPurchase: false } });
              if (next !== "SUCCESS") {
                await transition("NEEDS_ATTENTION", "Penyedia melaporkan pengembalian atau pembalikan pembayaran; perlu pemeriksaan.", "PAYMENT_REFUND_OR_REVERSAL");
              } else if (order.application) {
                if (order.application.paymentId !== current.id) await transition("NEEDS_ATTENTION", "Lebih dari satu pembayaran sukses untuk pesanan yang sama.", "DUPLICATE_SUCCESS_PAYMENT");
              } else {
                const stock = await tx.product.findMany({ where: { id: { in: productIds } }, select: { id: true, physicalStock: true, reservedStock: true } });
                const stocks = new Map(stock.map(p => [p.id, p]));
                const stockValid = order.items.length > 0 && order.items.every(item => item.reservation?.status === "RESERVED" && item.reservation.expiresAt.getTime() === order.paymentDeadline.getTime() && (stocks.get(item.productId)?.physicalStock ?? -1) >= item.quantity && (stocks.get(item.productId)?.reservedStock ?? -1) >= item.quantity);
                const voucher = order.discountId ? await tx.discount.findFirst({ where: { id: order.discountId, userId: order.userId, status: "RESERVED", reservedOrderId: order.id }, select: { id: true } }) : null;
                if (orderStatus !== "AWAITING_PAYMENT" || !stockValid || order.discountId && !voucher || !paidAt || paidAt > order.paymentDeadline) {
                  await transition("NEEDS_ATTENTION", "Pembayaran sukses memerlukan pemeriksaan tenggat atau reservasi sebelum pemenuhan.", "PAYMENT_RESERVATION_OR_DEADLINE_CONFLICT");
                } else {
                  for (const item of [...order.items].sort((a, b) => a.productId.localeCompare(b.productId))) {
                    const rows = await tx.$queryRaw<Array<{ id: string }>>`UPDATE "Product" SET "physicalStock"="physicalStock"-${item.quantity},"reservedStock"="reservedStock"-${item.quantity},"updatedAt"=GREATEST(date_trunc('milliseconds',clock_timestamp()),"updatedAt"+interval '1 millisecond') WHERE id=${item.productId} AND "physicalStock">=${item.quantity} AND "reservedStock">=${item.quantity} RETURNING id`;
                    if (rows.length !== 1) throw unavailable();
                    const reservation = await tx.stockReservation.updateMany({ where: { orderItemId: item.id, status: "RESERVED" }, data: { status: "CONSUMED", finalizedAt: time } });
                    if (reservation.count !== 1) throw unavailable();
                  }
                  if (voucher) {
                    const used = await tx.discount.updateMany({ where: { id: voucher.id, userId: order.userId, status: "RESERVED", reservedOrderId: order.id }, data: { status: "USED", reservedOrderId: null, usedOrderId: order.id, usedAt: time } });
                    if (used.count !== 1) throw unavailable();
                  }
                  await tx.paymentApplication.create({ data: { orderId: order.id, paymentId: current.id, appliedAt: time } });
                  await transition("PROCESSING", "Pembayaran sukses terverifikasi; reservasi diterapkan tepat satu kali.");
                  if (order.payments.some(p => p.id !== current.id && ["CREATED", "PENDING", "UNCONFIRMED"].includes(p.status))) await transition("NEEDS_ATTENTION", "Percobaan pembayaran lain masih berpotensi dibayar; perlu pemeriksaan.", "OTHER_PAYMENT_STILL_ACTIVE");
                }
              }
            }
            await tx.paymentEvent.upsert({ where: { paymentId_deduplicationKey: { paymentId: current.id, deduplicationKey: eventKey } }, create: { paymentId: current.id, deduplicationKey: eventKey, source, verification: mapped.known ? "VERIFIED" : "UNCONFIRMED", providerStatus: mapped.providerStatus, resultingStatus: next, errorCode: ignored ? "STALE_STATUS_IGNORED" : mapped.known ? null : "UNKNOWN_PROVIDER_STATUS" }, update: {} });
            safeTerminal = mapped.known && !ignored && terminal.has(next);
          }, { timeout: 15000 });
          break;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ApiError(409, "PAYMENT_REFERENCE_CONFLICT", "Identitas transaksi pembayaran bertentangan.");
          const retryable = error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2034" || error.code === "P2010" && ["40P01", "40001"].includes(String(error.meta?.code)));
          if (!retryable || attempt >= 2) throw error;
        }
      }
      if (!mapped.known) throw unavailable();
      return { paymentId: payment.id, safeTerminal };
  }
  return {
    async notification(input: unknown) {
      const notification = notificationSchema.parse(input);
      verifyNotificationSignature(notification, settings.serverKey);
      await verify(notification.order_id, "WEBHOOK", notification);
      return { accepted: true as const };
    },
    // Trusted server/CLI entry point: identity comes only from the local payment.
    async reconcilePayment(paymentId: string, source: "STATUS_API" | "SCHEDULER") {
      const payment = await db.payment.findUnique({ where: { id: paymentId }, select: { providerOrderId: true } });
      if (!payment) throw new ApiError(404, "PAYMENT_NOT_FOUND", "Referensi pembayaran tidak ditemukan.");
      return verify(payment.providerOrderId, source);
    },
  };
}
