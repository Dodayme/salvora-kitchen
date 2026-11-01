import { z } from "zod";
import { decodePaymentOrder } from "@/lib/payment-client/model";
import { decodeReviews } from "@/lib/catalog-client/model";
import { orderStatuses, paymentStatuses, type OrderStatus } from "@/lib/contracts/status";
const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/), integer = z.number().int().nonnegative().max(2147483647);
const summary = z.object({ id, number: z.string().min(1).max(150), createdAt: z.iso.datetime(), status: z.enum(orderStatuses), paymentStatus: z.enum(paymentStatuses).nullable(), paymentStatuses: z.array(z.enum(paymentStatuses)), channel: z.string().max(64).nullable(), channels: z.array(z.string().max(64)), total: integer, currency: z.literal("IDR"), paymentDeadline: z.iso.datetime(), itemCount: integer, itemSummary: z.array(z.object({ name: z.string().min(1).max(150), quantity: integer.positive() })) });
const reviewFlags = z.object({ items: z.array(z.object({ id, canReview: z.boolean(), reviewId: id.nullable() })), history: z.array(z.object({ fromStatus: z.enum(orderStatuses).nullable(), toStatus: z.enum(orderStatuses), changedAt: z.iso.datetime(), actor: z.enum(["SYSTEM", "ADMIN"]), note: z.string().max(1000).nullable() })) });
export const decodeOrderSummaries = (value: unknown) => z.array(summary).parse(value);
export function decodeBuyerOrder(value: unknown) {
  const base = decodePaymentOrder(value), extra = reviewFlags.parse(value);
  return { ...base, items: base.items.map(item => { const flags = extra.items.find(row => row.id === item.id); if (!flags) throw Error("Missing item flags"); return { ...item, canReview: flags.canReview, reviewId: flags.reviewId }; }),
    history: extra.history.filter(row => row.actor !== "ADMIN" || row.fromStatus !== row.toStatus).map(row => ({ ...row, note: row.actor === "ADMIN" ? null : row.note })) };
}
export type BuyerOrder = ReturnType<typeof decodeBuyerOrder>;
export const canReviewItem = (order: Pick<BuyerOrder, "status">, item: Pick<BuyerOrder["items"][number], "canReview" | "reviewId">) => order.status === "COMPLETED" && item.canReview && item.reviewId === null;
export function orderListPath(page: number, status: OrderStatus | "" = "") {
  if (!Number.isInteger(page) || page < 1 || page > 100000 || status && !orderStatuses.includes(status)) throw Error("Invalid order filter");
  const query = new URLSearchParams({ page: String(page), pageSize: "5" }); if (status) query.set("status", status); return `/api/orders?${query}`;
}
const reviewInput = z.object({ rating: z.number().int().min(1).max(5), comment: z.string().trim().min(10).max(1000).refine(value => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) });
export function reviewPayload(rating: string, comment: string) { return reviewInput.safeParse({ rating: /^[1-5]$/.test(rating) ? Number(rating) : NaN, comment }); }
export const reviewLength = (comment: string) => Array.from(comment.trim()).length;
export const decodeSubmittedReview = (value: unknown) => decodeReviews([value])[0];
