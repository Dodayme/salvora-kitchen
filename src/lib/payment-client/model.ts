import { z } from "zod";
import { decodeCheckoutOrder } from "@/lib/checkout-client/model";
import { paymentStatuses } from "@/lib/contracts/status";
const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/), money = z.number().int().nonnegative().max(2147483647);
const payment = z.object({ id, status: z.enum(paymentStatuses), amount: money, currency: z.literal("IDR"), channel: z.string().max(64).nullable(), createdAt: z.iso.datetime(), expiresAt: z.iso.datetime(), paidAt: z.iso.datetime().nullable() });
const orderExtra = z.object({ paymentStatus: z.enum(paymentStatuses).nullable(), paymentStatuses: z.array(z.enum(paymentStatuses)), canPay: z.boolean(), canReconcile: z.boolean(), attentionReason: z.string().max(1000).nullable(), payments: z.array(payment) });
export function decodePaymentOrder(value: unknown) { return { ...decodeCheckoutOrder(value), ...orderExtra.parse(value) }; }
export type PaymentOrder = ReturnType<typeof decodePaymentOrder>;
const instruction = z.object({ orderId: id, paymentId: id, providerOrderId: z.string().min(1).max(50), status: z.enum(paymentStatuses), snapToken: z.uuid().nullable(), redirectUrl: z.string().nullable(), expiresAt: z.iso.datetime(), reused: z.boolean() }).superRefine((value, context) => {
  if (value.snapToken === null && value.redirectUrl === null) return;
  try {
    if (!value.snapToken || !value.redirectUrl || value.status !== "PENDING") throw Error();
    const url = new URL(value.redirectUrl);
    if (url.origin !== "https://app.sandbox.midtrans.com" || url.username || url.password || url.search || url.hash || !/^\/snap\/v\d+\/(redirection|vtweb)\/[a-f0-9-]{36}$/.test(url.pathname) || !url.pathname.endsWith(`/${value.snapToken}`)) throw Error();
  } catch { context.addIssue({ code: "custom", message: "Invalid Sandbox instruction" }); }
});
export const decodeInstruction = (value: unknown) => instruction.parse(value);
export const decodeReconciled = (value: unknown) => z.object({ order: z.unknown().transform(decodePaymentOrder), reconciledAt: z.iso.datetime() }).parse(value);
export const validOrderId = (value: string) => id.safeParse(value).success;
export function canRequestPayment(order: PaymentOrder, now = Date.now()) {
  return order.canPay && order.status === "AWAITING_PAYMENT" && Date.parse(order.paymentDeadline) > now && !order.paymentStatuses.some(value => ["CREATED", "UNCONFIRMED", "SUCCESS", "REFUNDED", "PARTIALLY_REFUNDED", "REVERSED"].includes(value));
}
export function remainingPaymentTime(deadline: string, now = Date.now()) {
  const seconds = Math.max(0, Math.ceil((Date.parse(deadline) - now) / 1000));
  return { seconds, label: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` };
}
