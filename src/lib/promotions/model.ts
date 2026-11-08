import { z } from "zod";
export const promotionInput = z.strictObject({
  photoId: z.uuid().nullable().optional(),
  name: z.string().trim().min(2).max(100),
  percentage: z.number().int().min(1).max(99),
  maxDiscount: z.number().int().min(1).max(2147483647),
  startsAt: z.iso.datetime({ offset: true }), endsAt: z.iso.datetime({ offset: true }),
  emails: z.array(z.email().max(254)).max(200),
  audience: z.enum(["ALL", "SELECTED"]),
}).refine(v => Date.parse(v.endsAt) > Date.parse(v.startsAt), { message: "Waktu berakhir harus setelah mulai." })
.refine(v => v.audience === "ALL" || v.emails.length > 0, { message: "Isi email penerima." });
export const promotionView = z.object({ photoId: z.uuid().nullable().optional(), id: z.string(), name: z.string(), percentage: z.number(), maxDiscount: z.number(), startsAt: z.string(), endsAt: z.string(), recipientIds: z.array(z.string()), isActive: z.boolean() });
export const decodePromotions = (value: unknown) => z.array(promotionView).parse(value);
export function eventDiscount(subtotal: number, percentage: number, cap: number) {
  return Number([BigInt(subtotal) * BigInt(percentage) / 100n, BigInt(cap)].reduce((a, b) => a < b ? a : b));
}
