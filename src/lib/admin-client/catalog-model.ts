import { z } from "zod";
import { decodeCategories, decodeProduct } from "@/lib/catalog-client/model";
const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/), int = z.number().int().nonnegative().max(2147483647);
const text = (max: number) => z.string().trim().min(1).max(max).refine(value => !value.includes("\u0000"));
const extra = z.object({ physicalStock: int, reservedStock: int, photoId: z.uuid().nullable(), createdAt: z.iso.datetime(), updatedAt: z.iso.datetime() });
export function decodeAdminProduct(value: unknown) { const result = { ...decodeProduct(value), ...extra.parse(value) }; if (result.availableStock !== result.physicalStock - result.reservedStock || result.availability !== (result.availableStock === 0 ? "OUT_OF_STOCK" : result.availableStock <= 5 ? "LOW" : "AVAILABLE")) throw Error("Invalid stock summary"); return result; }
export type AdminProduct = ReturnType<typeof decodeAdminProduct>;
export const decodeAdminProducts = (value: unknown) => z.array(z.unknown().transform(decodeAdminProduct)).parse(value);
export const decodeAdminCategory = (value: unknown) => decodeCategories([value])[0];
export const categoryPayload = (name: string, isActive: boolean) => z.object({ name: text(100), isActive: z.boolean() }).safeParse({ name, isActive });
export type ProductDraft = { categoryId: string; name: string; description: string; price: string; physicalStock: string; isActive: boolean; photoId: string | null };
const numberInput = z.string().regex(/^\d+$/).transform(Number).pipe(int);
const metadata = z.object({ categoryId: id, name: text(150), description: text(5000), price: numberInput.pipe(int.positive()), isActive: z.boolean(), photoId: z.uuid().nullable() });
export function productPayload(value: ProductDraft, editing: boolean) { return editing ? metadata.safeParse(value) : metadata.extend({ physicalStock: numberInput }).safeParse(value); }
export const stockPayload = (physicalStock: string, expectedUpdatedAt: string) => z.object({ physicalStock: numberInput, expectedUpdatedAt: z.iso.datetime() }).safeParse({ physicalStock, expectedUpdatedAt });
export const PHOTO_BYTES = 2000000;
export function photoIssue(files: Pick<File, "size" | "type">[]) { return files.length !== 1 ? "Pilih tepat satu foto." : !["image/jpeg", "image/png", "image/webp"].includes(files[0].type) ? "Gunakan JPEG, PNG atau WebP." : files[0].size < 1 || files[0].size > PHOTO_BYTES ? "Ukuran foto harus 1–2.000.000 byte (maksimal 2 MB)." : null; }
export function photoForm(file: File) { const issue = photoIssue([file]); if (issue) throw Error(issue); const form = new FormData(); form.append("file", file); return form; }
export const decodeUploadedPhoto = (value: unknown) => z.object({ photoId: z.uuid(), url: z.string() }).refine(row => row.url === `/api/product-photos/${row.photoId}`).parse(value);
export type CatalogFilter = { q: string; isActive: "" | "true" | "false"; availability: "" | "AVAILABLE" | "LOW" | "OUT_OF_STOCK"; categoryId: string };
export const emptyCatalogFilter: CatalogFilter = { q: "", isActive: "", availability: "", categoryId: "" };
export function catalogAdminPath(kind: "products" | "categories", page: number, filter: CatalogFilter) {
  const query = new URLSearchParams({ page: String(page), pageSize: "10" });
  if (!Number.isInteger(page) || page < 1 || page > 100000 || Array.from(filter.q.trim()).length > 100 || filter.q.includes("\u0000") || !["", "true", "false"].includes(filter.isActive) || !["", "AVAILABLE", "LOW", "OUT_OF_STOCK"].includes(filter.availability) || filter.categoryId && !id.safeParse(filter.categoryId).success) return null;
  if (filter.q.trim()) query.set("q", filter.q.trim()); if (filter.isActive) query.set("isActive", filter.isActive);
  if (kind === "products") { if (filter.availability) query.set("availability", filter.availability); if (filter.categoryId) query.set("categoryId", filter.categoryId); }
  return `/api/admin/${kind}?${query}`;
}
