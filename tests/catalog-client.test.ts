import { describe, expect, it } from "vitest";
import { catalogQuery, catalogHref, safeProductImage, validQuantity, canPurchase, decodeProduct, decodeProducts, decodeCategories, decodeReviews, decodeCart } from "@/lib/catalog-client/model";
const product = { id: "product-1", category: { id: "category-1", name: "Risol" }, name: "Risol demo", description: "Deskripsi contoh", price: 3500, imageUrl: null, isActive: true, isDemo: true, availableStock: 4, availability: "LOW" as const, averageRating: null, reviewCount: 0 };
describe("Catalog URL/state inputs", () => {
  it.each(["page=0", "page=-1", "page=1.5", "page=1e2", "page=100001", "page=1&page=2", "categoryId=a&categoryId=b", "categoryId=", "categoryId=..%2Fsecret", "q=unsupported"])("rejects unsupported or ambiguous filter %s", query => { expect(catalogQuery(new URLSearchParams(query))).toBeNull(); });
  it("keeps deep-linked category/page and makes explicit first-page category URLs", () => {
    expect(catalogQuery(new URLSearchParams("page=2&categoryId=category-1"))).toEqual({ page: 2, categoryId: "category-1" });
    expect(catalogQuery(new URLSearchParams())).toEqual({ page: 1 });
    expect(catalogHref(2, "category-1")).toBe("/menu?categoryId=category-1&page=2");
    expect(catalogHref(1, "category-1")).toBe("/menu?categoryId=category-1"); expect(catalogHref()).toBe("/menu");
  });
  it.each(["0", "-1", "1.5", "1e2", "", " 1", "5", "9007199254740992"])("prevents invalid/out-of-stock quantity %s", value => { expect(validQuantity(value, 4)).toBe(false); });
  it("does not treat reserved/empty or inactive stock as purchasable", () => {
    expect(validQuantity("4", 4)).toBe(true); expect(validQuantity("1", 0)).toBe(false);
    expect(canPurchase(product)).toBe(true); expect(canPurchase({ ...product, availableStock: 0 })).toBe(false); expect(canPurchase({ ...product, availability: "OUT_OF_STOCK" })).toBe(false); expect(canPurchase({ ...product, isActive: false })).toBe(false);
  });
});
describe("Public DTOs and imagery", () => {
  it.each([null, "javascript:alert(1)", "data:image/svg+xml,anything", "http://example.test/photo.png", "//example.test/photo.png", "/\\example.test/photo.png", "https://private:credential@example.test/photo.png", "/api/auth/session", "/x/../api/auth/session"])("rejects unsafe/unrelated image %s", source => { expect(safeProductImage(source)).toBeNull(); });
  it("allows public same-origin photos and HTTPS without making server optimizer fetch them", () => {
    for (const source of ["/api/product-photos/photo-1", "/images/product.webp", "https://example.test/public-photo.png"]) expect(safeProductImage(source)).toBe(source);
  });
  it("keeps null ratings/photo and strips server/admin-only fields", () => {
    const result = decodeProduct({ ...product, reservedStock: 100, passwordHash: "PRIVATE_SENTINEL" });
    expect(result).toEqual(product); expect(JSON.stringify(result)).not.toContain("PRIVATE_SENTINEL"); expect(decodeProducts([product])[0].price).toBe(3500);
  });
  it("does not accept malformed price/availability/rating DTOs", () => {
    for (const wrong of [{ price: 1.5 }, { price: -1 }, { availability: "UNKNOWN" }, { averageRating: 8 }, { reviewCount: -1 }]) expect(() => decodeProduct({ ...product, ...wrong })).toThrow();
  });
  it("preserves exact active category counts and demo labels", () => {
    expect(decodeCategories([{ id: "c", name: "Cookies", isActive: true, isDemo: true, productCount: 0 }])[0]).toMatchObject({ productCount: 0, isDemo: true });
  });
  it("whitelists review author output and keeps user text as plain text data", () => {
    const rows = decodeReviews([{ id: "r", productId: product.id, rating: 5, comment: "<script>fixture</script>", author: { displayName: "Pembeli", email: "PRIVATE_SENTINEL" }, createdAt: "2026-10-24T00:00:00Z" }]);
    expect(rows[0].comment).toBe("<script>fixture</script>"); expect(rows[0].author).toEqual({ displayName: "Pembeli" });
  });
  it("does not invent cart quantity when checking an uncertain addition", () => {
    expect(decodeCart({ id: null, items: [], subtotal: 0 })).toEqual({ id: null, items: [], subtotal: 0 });
    expect(() => decodeCart({ id: null, items: [], subtotal: -1 })).toThrow();
  });
});
