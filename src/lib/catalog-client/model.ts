import { z } from "zod";
const id = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
const integer = z.number().int().nonnegative().max(2147483647);
const category = z.object({ id, name: z.string().min(1).max(100), isActive: z.boolean(), isDemo: z.boolean(), productCount: integer });
const product = z.object({ id, category: z.object({ id, name: z.string().min(1).max(100) }), name: z.string().min(1).max(150), description: z.string().max(5000), price: integer.positive(), imageUrl: z.string().nullable(), isActive: z.boolean(), isDemo: z.boolean(), availableStock: integer, availability: z.enum(["AVAILABLE", "LOW", "OUT_OF_STOCK"]), averageRating: z.number().min(1).max(5).nullable(), reviewCount: integer });
const review = z.object({ id, productId: id, rating: z.number().int().min(1).max(5), comment: z.string().max(1000), author: z.object({ displayName: z.string().min(1).max(100) }), createdAt: z.iso.datetime() });
const cart = z.object({ id: id.nullable(), subtotal: integer, items: z.array(z.object({ id, productId: id, name: z.string(), imageUrl: z.string().nullable(), unitPrice: integer, quantity: integer.positive(), lineSubtotal: integer, availableStock: integer, isAvailable: z.boolean() })) });
export type Product = z.infer<typeof product>;
export type Category = z.infer<typeof category>;
export type Review = z.infer<typeof review>;
export const decodeProducts = (data: unknown) => z.array(product).parse(data);
export const decodeProduct = (data: unknown) => product.parse(data);
export const decodeCategories = (data: unknown) => z.array(category).parse(data);
export const decodeReviews = (data: unknown) => z.array(review).parse(data);
export const decodeCart = (data: unknown) => cart.parse(data);
export const validProductId = (value: string) => id.safeParse(value).success;
export function catalogQuery(params: URLSearchParams) {
  for (const key of params.keys()) if (!["page", "categoryId"].includes(key) || params.getAll(key).length !== 1) return null;
  const page = params.get("page") ?? "1", categoryId = params.get("categoryId") ?? undefined;
  if (!/^[1-9]\d*$/.test(page) || Number(page) > 100000 || categoryId !== undefined && !validProductId(categoryId)) return null;
  return { page: Number(page), categoryId };
}
export function catalogHref(page = 1, categoryId?: string) {
  const query = new URLSearchParams();
  if (categoryId) query.set("categoryId", categoryId);
  if (page !== 1) query.set("page", String(page));
  return `/menu${query.size ? `?${query}` : ""}`;
}
export function safeProductImage(value: string | null) {
  if (!value || /[\\\x00-\x20\x7f]/.test(value) || value.startsWith("//")) return null;
  try {
    const url = new URL(value, "https://salvora.invalid");
    if (url.username || url.password || url.hash) return null;
    if (value.startsWith("/")) {
      if (url.origin !== "https://salvora.invalid" || url.pathname.startsWith("/api/") && !/^\/api\/product-photos\/[A-Za-z0-9_-]+$/.test(url.pathname)) return null;
      return value;
    }
    return url.protocol === "https:" ? value : null;
  } catch { return null; }
}
export const validQuantity = (value: string, available: number) => /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) <= available && Number(value) <= 2147483647;
export const canPurchase = (product: Product) => product.isActive && product.availableStock > 0 && product.availability !== "OUT_OF_STOCK";
