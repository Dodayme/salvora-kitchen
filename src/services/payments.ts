import { randomUUID } from "node:crypto";
import type { Payment, Prisma, PrismaClient } from "../generated/prisma/client";
import { ApiError } from "../lib/api/errors";
import { requireRole, type Principal } from "../lib/auth/access";
import { idSchema } from "../lib/catalog/validation";
import { MIN_SNAP_WINDOW_MS, SnapFailure, validSnapResult, type SnapGateway, type SnapInput } from "../lib/payments/snap";
import { verifiedTerminal } from "../lib/payments/retry";

async function clock(tx: Prisma.TransactionClient) { return (await tx.$queryRaw<Array<{ time: Date }>>`SELECT clock_timestamp() AS time`)[0].time; }
function instruction(payment: Payment, reused: boolean, time: Date) {
  const usable = payment.status === "PENDING" && payment.expiresAt > time;
  return { orderId: payment.orderId, paymentId: payment.id, providerOrderId: payment.providerOrderId, status: payment.status,
    snapToken: usable ? payment.snapToken : null, redirectUrl: usable ? payment.snapRedirectUrl : null, expiresAt: payment.expiresAt.toISOString(), reused };
}
const pendingStatuses = ["CREATED", "PENDING", "UNCONFIRMED"] as const;
export function canStartPayment(order: { status: string; paymentDeadline: Date; payments: Array<{ status: string; midtransTransactionId?: string | null; providerStatus?: string | null; events?: Parameters<typeof verifiedTerminal>[0]["events"]; snapToken?: string | null; snapRedirectUrl?: string | null; expiresAt?: Date }> }, time = new Date()) {
  if (order.status !== "AWAITING_PAYMENT" || order.paymentDeadline <= time || order.payments.some(p => ["SUCCESS", "REFUNDED", "PARTIALLY_REFUNDED", "REVERSED", "UNCONFIRMED", "CREATED"].includes(p.status))) return false;
  const pending = order.payments.find(p => p.status === "PENDING");
  if (pending) return !!pending.snapToken && !!pending.snapRedirectUrl && !!pending.expiresAt && pending.expiresAt > time;
  return order.payments.every(verifiedTerminal) && order.paymentDeadline.getTime() - time.getTime() >= MIN_SNAP_WINDOW_MS;
}
export function createPaymentService(db: PrismaClient, gateway: () => SnapGateway) {
  return {
    async pay(principal: Principal | null, orderId: string) {
      const user = requireRole(principal, "BUYER"); idSchema.parse(orderId);
      const prepared = await db.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id} FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM "Order" WHERE id=${orderId} AND "userId"=${user.id} FOR UPDATE`;
        const order = await tx.order.findFirst({ where: { id: orderId, userId: user.id }, include: { items: { orderBy: { id: "asc" }, include: { reservation: true } }, payments: { orderBy: { createdAt: "desc" }, include: { events: true } }, application: true } });
        if (!order) throw new ApiError(404, "NOT_FOUND", "Data tidak ditemukan.");
        const time = await clock(tx);
        if (order.status !== "AWAITING_PAYMENT" || order.application || order.payments.some(p => ["SUCCESS", "REFUNDED", "PARTIALLY_REFUNDED", "REVERSED"].includes(p.status))) throw new ApiError(409, "ORDER_NOT_PAYABLE", "Pesanan tidak dapat dibuatkan pembayaran baru.");
        if (order.paymentDeadline <= time) throw new ApiError(409, "ORDER_PAYMENT_EXPIRED", "Batas pembayaran pesanan sudah berakhir. Status pembayaran perlu diperiksa.");
        const active = order.payments.find(p => pendingStatuses.some(status => status === p.status));
        if (active) return { kind: "reused" as const, data: instruction(active, true, time) };
        if (!order.payments.every(verifiedTerminal)) throw new ApiError(409, "PAYMENT_RECONCILIATION_REQUIRED", "Periksa status pembayaran sebelumnya sebelum membuat percobaan baru.");
        if (order.paymentDeadline.getTime() - time.getTime() < MIN_SNAP_WINDOW_MS) throw new ApiError(409, "PAYMENT_WINDOW_TOO_SHORT", "Waktu pembayaran yang tersisa tidak cukup untuk membuat instruksi baru.");
        if (!order.items.length || order.items.some(item => item.reservation?.status !== "RESERVED" || item.reservation.expiresAt.getTime() !== order.paymentDeadline.getTime())) throw new ApiError(409, "ORDER_RESERVATION_INVALID", "Reservasi pesanan tidak valid untuk pembayaran.");
        if (order.discountId && !await tx.discount.findFirst({ where: { id: order.discountId, userId: user.id, status: "RESERVED", reservedOrderId: order.id }, select: { id: true } })) throw new ApiError(409, "ORDER_RESERVATION_INVALID", "Reservasi voucher pesanan tidak valid untuk pembayaran.");
        const provider = gateway(); // Validate configured merchant before persisting an attempt.
        const payment = await tx.payment.create({ data: { orderId, providerOrderId: `SV-${randomUUID()}`, amount: order.total, expiresAt: order.paymentDeadline, createdAt: time,
          events: { create: { deduplicationKey: "snap-prepared", source: "SNAP_REQUEST", verification: "UNCONFIRMED", resultingStatus: "CREATED", errorCode: "SNAP_PREPARED" } } } });
        const input: SnapInput = { providerOrderId: payment.providerOrderId, orderId, total: order.total, subtotal: order.subtotal, discount: order.discount, shippingFee: order.shippingFee, createdAt: order.createdAt, deadline: order.paymentDeadline, requestedAt: time, recipientName: order.recipientName, phone: order.phone, items: order.items.map(item => ({ productId: item.productId, name: item.name, unitPrice: item.unitPrice, quantity: item.quantity })) };
        return { kind: "new" as const, payment, provider, input };
      });
      if (prepared.kind === "reused") return prepared.data;
      let result: ReturnType<typeof validSnapResult> | null = null, failure: SnapFailure | null = null;
      // No automatic provider retries, and no open DB transaction during HTTP.
      try { result = validSnapResult(await prepared.provider.create(prepared.input)); }
      catch (error) { failure = error instanceof SnapFailure ? error : new SnapFailure("SNAP_UNCONFIRMED"); }
      const data = await db.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id} FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM "Order" WHERE id=${orderId} FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM "Payment" WHERE id=${prepared.payment.id} FOR UPDATE`;
        const current = await tx.payment.findUniqueOrThrow({ where: { id: prepared.payment.id } });
        // Future verified webhook/status updates always take precedence over this response.
        if (current.status !== "CREATED" && !(result && current.status === "PENDING")) return instruction(current, false, await clock(tx));
        const status = result ? "PENDING" : failure?.definitive ? "FAILED" : "UNCONFIRMED";
        const payment = await tx.payment.update({ where: { id: current.id }, data: { status, ...(result ? { snapToken: result.token, snapRedirectUrl: result.redirectUrl } : {}) } });
        await tx.paymentEvent.create({ data: { paymentId: current.id, deduplicationKey: "snap-result", source: "SNAP_REQUEST", resultingStatus: status, verification: failure?.definitive ? "REJECTED" : "UNCONFIRMED", errorCode: result ? "SNAP_TOKEN_CREATED" : failure?.reason ?? "SNAP_UNCONFIRMED" } });
        return instruction(payment, false, await clock(tx));
      });
      if (data.status === "FAILED") throw new ApiError(502, "MIDTRANS_REJECTED", "Permintaan pembuatan pembayaran ditolak Midtrans Sandbox. Periksa konfigurasi.");
      return data;
    },
  };
}
