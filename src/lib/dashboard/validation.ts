import { z } from "zod";
import { paginationSchema } from "../api/input";

export const dashboardQuerySchema = z.strictObject({ from: z.iso.datetime(), to: z.iso.datetime() }).refine(value => new Date(value.from) < new Date(value.to), { path: ["to"], message: "to harus setelah from." });
export const voucherQuerySchema = paginationSchema.extend({ status: z.enum(["AVAILABLE", "RESERVED", "USED"]).optional() });
export const emptyQuerySchema = z.strictObject({});
