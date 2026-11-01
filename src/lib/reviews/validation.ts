import { z } from "zod";
import { paginationSchema } from "../api/input";

export const reviewQuerySchema = paginationSchema;
export const reviewInputSchema = z.strictObject({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().min(10).max(1000).refine(value => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)),
});
