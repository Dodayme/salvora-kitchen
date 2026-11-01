import { z } from "zod";
import { decodeOrderSummaries } from "@/lib/order-client/model";
import { decodePaymentOrder } from "@/lib/payment-client/model";
import { dashboardRange } from "@/lib/admin-client/dashboard-model";
import { orderStatuses, paymentStatuses, type OrderStatus } from "@/lib/contracts/status";
const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const note = z.string().trim().min(1).max(1000).refine(value => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value));
const actor = z.object({ name: z.string().min(1).max(100) }).nullable();
const history = z.array(z.object({ fromStatus: z.enum(orderStatuses).nullable(), toStatus: z.enum(orderStatuses), changedAt: z.iso.datetime(), actor: z.enum(["SYSTEM", "ADMIN"]), actorUser: actor, note: z.string().nullable() }));
const payment = z.object({ id, status: z.enum(paymentStatuses), amount: z.number().int().nonnegative().max(2147483647), currency: z.literal("IDR"), channel: z.string().max(64).nullable(), createdAt: z.iso.datetime(), expiresAt: z.iso.datetime(), paidAt: z.iso.datetime().nullable() });
export function decodeAdminOrders(value: unknown) {
  const summaries = decodeOrderSummaries(value), buyers = z.array(z.object({ buyer: z.object({ name: z.string().min(1).max(100) }) })).parse(value);
  return summaries.map((row, index) => ({ ...row, buyer: buyers[index].buyer }));
}
export function decodeAdminOrder(value: unknown, expectedId?: string) {
  const result = { ...decodePaymentOrder(value), history: z.object({ history }).parse(value).history };
  if (expectedId && result.id !== expectedId) throw Error("Unexpected order");
  return result;
}
export type AdminOrder = ReturnType<typeof decodeAdminOrder>;
export const decodeAdminPayments = (value: unknown) => z.array(payment.extend({ orderId: id, orderNumber: z.string().min(1).max(150) })).parse(value);
export type AdminPayment = ReturnType<typeof decodeAdminPayments>[number];
export const notePayload = (value: string) => z.object({ note }).safeParse({ note: value });
export function fulfillmentPayload(expectedStatus: OrderStatus, target: "SHIPPED" | "READY_FOR_PICKUP" | "COMPLETED", value: string, confirmed: boolean) {
  const parsed = z.object({ status: z.enum(["SHIPPED", "READY_FOR_PICKUP", "COMPLETED"]), expectedStatus: z.enum(orderStatuses), note: note.optional(), receiptConfirmed: z.literal(true).optional() }).superRefine((row, context) => {
    if (!(row.expectedStatus === "PROCESSING" && ["SHIPPED", "READY_FOR_PICKUP"].includes(row.status) || ["SHIPPED", "READY_FOR_PICKUP"].includes(row.expectedStatus) && row.status === "COMPLETED")) context.addIssue({ code: "custom", message: "Invalid transition" });
    if (row.status === "COMPLETED" && (!row.note || row.receiptConfirmed !== true)) context.addIssue({ code: "custom", message: "Receipt confirmation required" });
  });
  return parsed.safeParse({ status: target, expectedStatus, ...(value.trim() ? { note: value } : {}), ...(target === "COMPLETED" && confirmed ? { receiptConfirmed: true } : {}) });
}
/** A UI candidate only; application/reservation evidence remains private and is checked by the server. */
export function fulfillmentCandidate(order: Pick<AdminOrder, "status" | "payments" | "paymentStatus"> & { shipping?: { mode: string } }) {
  if (order.paymentStatus !== "SUCCESS" || order.payments.filter(row => row.status === "SUCCESS").length !== 1 || order.payments.some(row => ["CREATED", "PENDING", "UNCONFIRMED", "REFUNDED", "PARTIALLY_REFUNDED", "REVERSED"].includes(row.status))) return null;
  return order.status === "PROCESSING" ? order.shipping?.mode === "PICKUP" ? "READY_FOR_PICKUP" as const : "SHIPPED" as const : ["SHIPPED", "READY_FOR_PICKUP"].includes(order.status) ? "COMPLETED" as const : null;
}
export type AdminOrderFilter = { q: string; status: string; paymentStatus: string; channel: string; fromDate: string; toDate: string; orderId: string };
export const emptyOrderFilter: AdminOrderFilter = { q: "", status: "", paymentStatus: "", channel: "", fromDate: "", toDate: "", orderId: "" };
export function adminOrdersPath(kind: "orders" | "payments", page: number, filter: AdminOrderFilter) {
  if (!Number.isInteger(page) || page < 1 || page > 100000) return null;
  const query = new URLSearchParams({ page: String(page), pageSize: "10" }), q = filter.q.trim(), channel = filter.channel.trim();
  if (channel && !/^[A-Za-z0-9_-]{1,64}$/.test(channel) || filter.paymentStatus && !paymentStatuses.includes(filter.paymentStatus as typeof paymentStatuses[number])) return null;
  if (filter.fromDate || filter.toDate) { const range = dashboardRange(filter.fromDate, filter.toDate); if (!range) return null; query.set("from", range.from); query.set("to", range.to); }
  if (channel) query.set("channel", channel);
  if (kind === "orders") {
    if (Array.from(q).length > 50 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(q) || filter.status && !orderStatuses.includes(filter.status as OrderStatus)) return null;
    if (q) query.set("q", q); if (filter.status) query.set("status", filter.status); if (filter.paymentStatus) query.set("paymentStatus", filter.paymentStatus);
  } else {
    if (filter.orderId && !id.safeParse(filter.orderId).success) return null;
    if (filter.orderId) query.set("orderId", filter.orderId); if (filter.paymentStatus) query.set("status", filter.paymentStatus);
  }
  return `/api/admin/${kind}?${query}`;
}
