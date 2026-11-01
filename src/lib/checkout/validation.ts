import { z } from "zod";
import { phoneSchema } from "@/lib/contracts/phone";
import { idSchema } from "../catalog/validation";

const contactText = (max: number) => z.string().trim().min(1).max(max).refine(value => !/[\u0000-\u001f]/.test(value));
export const pickupContactSchema = z.strictObject({ recipientName: contactText(100), phone: phoneSchema });
export const quoteInputSchema = z.union([
  z.strictObject({ addressId: idSchema, shippingMode: z.literal("MANUAL_DELIVERY").optional() }),
  z.strictObject({ shippingMode: z.literal("PICKUP"), contact: pickupContactSchema }),
]);
export const orderInputSchema = z.strictObject({ quoteId: idSchema });
export const idempotencyKeySchema = z.string().min(16).max(128).regex(/^[A-Za-z0-9_-]+$/);
