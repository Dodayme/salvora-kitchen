import type { Prisma } from "../../generated/prisma/client";
import { canStartPayment } from "../../services/payments";

export const orderDetailInclude = {
  items: { orderBy: { id: "asc" }, include: { rating: { select: { id: true } } } },
  payments: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], include: { events: true } },
  history: { orderBy: [{ changedAt: "asc" }, { id: "asc" }], include: { actorUser: { select: { id: true, name: true } } } },
} satisfies Prisma.OrderInclude;
type Detail = Prisma.OrderGetPayload<{ include: typeof orderDetailInclude }>;
type Payment = Pick<Detail["payments"][number], "id" | "providerOrderId" | "provider" | "status" | "amount" | "currency" | "channel" | "createdAt" | "expiresAt" | "paidAt">;
export function paymentView(p: Payment) {
  return { id: p.id, providerOrderId: p.providerOrderId, provider: p.provider, status: p.status, amount: p.amount, currency: p.currency, channel: p.channel, createdAt: p.createdAt.toISOString(), expiresAt: p.expiresAt.toISOString(), paidAt: p.paidAt?.toISOString() ?? null };
}
type Summary = Pick<Detail, "id" | "number" | "createdAt" | "status" | "total" | "currency" | "paymentDeadline"> & { items: Array<{ quantity: number; name: string }>; payments: Array<{ status: Payment["status"]; channel: string | null }> };
export function orderSummary(order: Summary) {
  const prioritized = ["REVERSED", "REFUNDED", "PARTIALLY_REFUNDED", "SUCCESS"] as const;
  const payment = prioritized.map(status => order.payments.findLast(p => p.status === status)).find(Boolean) ?? order.payments.at(-1);
  return { id: order.id, number: order.number, createdAt: order.createdAt.toISOString(), status: order.status,
    paymentStatus: payment?.status ?? null, paymentStatuses: [...new Set(order.payments.map(p => p.status))],
    channel: payment?.channel ?? null, channels: [...new Set(order.payments.flatMap(p => p.channel ? [p.channel] : []))],
    total: order.total, currency: order.currency, paymentDeadline: order.paymentDeadline.toISOString(),
    itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0), itemSummary: order.items.map(item => ({ name: item.name, quantity: item.quantity })) };
}
export function orderDetail(order: Detail, time: Date, admin = false) {
  return { ...orderSummary(order),
    items: order.items.map(item => ({ id: item.id, productId: item.productId, name: item.name, unitPrice: item.unitPrice, quantity: item.quantity, lineSubtotal: item.lineSubtotal, canReview: !admin && order.status === "COMPLETED" && !item.rating, reviewId: item.rating?.id ?? null })),
    address: { recipientName: order.recipientName, phone: order.phone, addressLine: order.addressLine, city: order.city, province: order.province, postalCode: order.postalCode, notes: order.addressNotes },
    subtotal: order.subtotal, discount: order.discount, shippingFee: order.shippingFee,
    voucher: order.discountId ? { id: order.discountId, discount: order.discount } : null,
    shipping: { mode: order.shippingMode, label: order.shippingLabel }, payments: order.payments.map(paymentView),
    history: order.history.filter(h => admin || h.actor !== "ADMIN" || h.fromStatus !== h.toStatus).map(h => ({ fromStatus: h.fromStatus, toStatus: h.toStatus, changedAt: h.changedAt.toISOString(), actor: h.actor, note: admin || h.actor === "SYSTEM" ? h.note : null, ...(admin ? { actorUser: h.actorUser ? { id: h.actorUser.id, name: h.actorUser.name } : null } : {}) })),
    canPay: !admin && canStartPayment(order, time), canReconcile: order.payments.length > 0 || order.status === "AWAITING_PAYMENT" && order.paymentDeadline <= time, attentionReason: order.attentionReason };
}
