import { z } from "zod";
import { phoneSchema } from "@/lib/contracts/phone";
import { idSchema, MAX_INTEGER } from "../catalog/validation";

const text = (max: number) => z.string().trim().min(1).max(max).refine(value => !value.includes("\u0000"));
export const addressCreateSchema = z.strictObject({
  recipientName: text(100), phone: phoneSchema,
  addressLine: text(2000), city: text(100), province: text(100),
  postalCode: text(16).nullable().optional(), notes: text(1000).nullable().optional(),
});
export const addressPatchSchema = addressCreateSchema.partial().refine(value => Object.keys(value).length > 0);
export const quantitySchema = z.strictObject({ quantity: z.number().int().positive().max(MAX_INTEGER) });
export const cartAddSchema = quantitySchema.extend({ productId: idSchema });
