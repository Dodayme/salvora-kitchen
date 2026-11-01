import { z } from "zod";
import { addressInput } from "@/lib/buyer-client/model";
import { orderStatuses } from "@/lib/contracts/status";
const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const money = z.number().int().nonnegative().max(2147483647);
const item = z.object({ productId: id, name: z.string().min(1).max(150), unitPrice: money, quantity: money.positive(), lineSubtotal: money });
const totals = {
  address: addressInput, subtotal: money, discount: money, shippingFee: money, total: money, currency: z.literal("IDR"),
  voucher: z.object({ id, discount: money }).nullable(), shipping: z.object({ mode: z.enum(["MANUAL_DELIVERY", "PICKUP"]), label: z.string().min(1).max(500) }),
};
const quote = z.object({ ...totals, quoteId: id, expiresAt: z.iso.datetime(), items: z.array(item.extend({ cartItemId: id })).min(1), warnings: z.array(z.object({ code: z.string().max(100), message: z.string().max(500) })) });
const order = z.object({ ...totals, id, number: z.string().min(1).max(150), createdAt: z.iso.datetime(), paymentDeadline: z.iso.datetime(), status: z.enum(orderStatuses), items: z.array(item.extend({ id })).min(1) });
export type Quote = z.infer<typeof quote>;
export type CheckoutOrder = z.infer<typeof order>;
export const decodeQuote = (value: unknown) => quote.parse(value);
export const decodeCheckoutOrder = (value: unknown) => order.parse(value);
export const recoverySchema = z.strictObject({ version: z.literal(1), ownerId: id, quoteId: id, key: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/), orderId: id.optional() });
export type CheckoutRecovery = z.infer<typeof recoverySchema>;
export const quoteExpired = (value: Quote, now = Date.now()) => Date.parse(value.expiresAt) <= now;
