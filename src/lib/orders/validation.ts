import { z } from "zod";
import { paginationSchema } from "../api/input";
import { idSchema } from "../catalog/validation";
import { orderStatuses, paymentStatuses } from "../contracts/status";

const text = (max: number) => z.string().trim().min(1).max(max).refine(value => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value));
const range = { from: z.iso.datetime().optional(), to: z.iso.datetime().optional() };
const dateRange = (value: { from?: string; to?: string }, ctx: z.RefinementCtx) => {
  if (value.from && value.to && new Date(value.from) >= new Date(value.to)) ctx.addIssue({ code: "custom", path: ["to"], message: "to harus setelah from." });
};
export const buyerOrderQuerySchema = paginationSchema.extend({ status: z.enum(orderStatuses).optional() });
export const adminOrderQuerySchema = paginationSchema.extend({ q: text(50).optional(), status: z.enum(orderStatuses).optional(), paymentStatus: z.enum(paymentStatuses).optional(), channel: text(64).regex(/^[A-Za-z0-9_-]+$/).optional(), ...range }).superRefine(dateRange);
export const adminPaymentQuerySchema = paginationSchema.extend({ status: z.enum(paymentStatuses).optional(), orderId: idSchema.optional(), channel: text(64).regex(/^[A-Za-z0-9_-]+$/).optional(), ...range }).superRefine(dateRange);
export const orderNoteSchema = z.strictObject({ note: text(1000) });
export const fulfillmentSchema = z.strictObject({ status: z.enum(["SHIPPED", "READY_FOR_PICKUP", "COMPLETED"]), expectedStatus: z.enum(orderStatuses), note: text(1000).optional(), receiptConfirmed: z.boolean().optional() });
export type FulfillmentInput = z.output<typeof fulfillmentSchema>;
