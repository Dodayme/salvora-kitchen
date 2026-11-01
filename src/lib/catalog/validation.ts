import { z } from "zod";
import { ApiError } from "../api/errors";
import { paginationSchema } from "../api/input";

export const MAX_INTEGER = 2147483647;
export const LOW_STOCK_THRESHOLD = 5;
export const MAX_PHOTO_BYTES = 2000000;
export const idSchema = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
const text = (max: number) => z.string().trim().min(1).max(max).refine(value => !value.includes("\u0000"));
const stock = z.number().int().min(0).max(MAX_INTEGER);
const photoId = z.uuid().nullable().optional();
export const categoryCreateSchema = z.strictObject({ name: text(100), isActive: z.boolean() });
export const categoryPatchSchema = categoryCreateSchema.partial().refine(value => Object.keys(value).length > 0);
export const productCreateSchema = z.strictObject({ categoryId: idSchema, name: text(150), description: text(5000), price: z.number().int().positive().max(MAX_INTEGER), physicalStock: stock, isActive: z.boolean(), photoId });
export const productPatchSchema = productCreateSchema.omit({ physicalStock: true }).partial().refine(value => Object.keys(value).length > 0);
export const stockSchema = z.strictObject({ physicalStock: stock, expectedUpdatedAt: z.iso.datetime() });
const active = z.enum(["true", "false"]).transform(value => value === "true").optional();
export const categoryQuerySchema = paginationSchema.extend({ q: text(100).optional(), isActive: active });
export const publicProductQuerySchema = paginationSchema.extend({ categoryId: idSchema.optional() });
export const adminProductQuerySchema = publicProductQuerySchema.extend({ q: text(100).optional(), isActive: active, availability: z.enum(["AVAILABLE", "LOW", "OUT_OF_STOCK"]).optional() });
export type CategoryQuery = z.output<typeof categoryQuerySchema>;
export type ProductQuery = z.output<typeof adminProductQuerySchema>;

export function queryParameters(url: string) {
  const query = new URL(url).searchParams;
  for (const key of query.keys()) if (query.getAll(key).length !== 1) throw new ApiError(422, "VALIDATION_ERROR", "Parameter query tidak boleh berulang.");
  return Object.fromEntries(query);
}
export function availability(physicalStock: number, reservedStock: number) {
  const available = physicalStock - reservedStock;
  return available === 0 ? "OUT_OF_STOCK" : available <= LOW_STOCK_THRESHOLD ? "LOW" : "AVAILABLE";
}
