import { describe, expect, it, vi } from "vitest";
import { catalogAdminPath, categoryPayload, decodeAdminProduct, decodeUploadedPhoto, emptyCatalogFilter, photoForm, photoIssue, productPayload, stockPayload, type ProductDraft } from "../src/lib/admin-client/catalog-model";
import { createAdminAction, createModalControls } from "../src/lib/admin-client/action-controller";
import { ApiClientError, createApiClient, type apiRequest } from "../src/lib/http/client";
const uuid = "12345678-1234-4123-8123-123456789abc", stamp = "2026-10-25T00:00:00.000Z";
const draft: ProductDraft = { categoryId: "cat-1", name: " Risol ", description: " Isi ", price: "14000", physicalStock: "5", isActive: true, photoId: null };
const raw = { id: "p", category: { id: "c", name: "C" }, name: "P", description: "D", price: 1, imageUrl: null, isActive: true, isDemo: false, physicalStock: 10, reservedStock: 5, availableStock: 5, availability: "LOW", photoId: null, averageRating: null, reviewCount: 0, createdAt: stamp, updatedAt: stamp };
describe("admin catalog payload and server data", () => {
  it("whitelists metadata and keeps physical stock only on create", () => {
    const value = { ...draft, reservedStock: 99, userId: "foreign", photoKey: "private" };
    expect(productPayload(value, false).data).toEqual({ categoryId: "cat-1", name: "Risol", description: "Isi", price: 14000, physicalStock: 5, isActive: true, photoId: null });
    expect(productPayload(value, true).data).not.toHaveProperty("physicalStock");
    expect(productPayload(value, true).data).not.toHaveProperty("reservedStock");
  });
  it.each(["0", "-1", "1.5", "10.000", "1e3", "2147483648", "", "NaN"])("rejects invalid price %s", price => expect(productPayload({ ...draft, price }, false).success).toBe(false));
  it("allows zero initial stock; validates stock version and numeric bounds", () => {
    expect(productPayload({ ...draft, physicalStock: "0" }, false).success).toBe(true);
    expect(stockPayload("2147483647", stamp).success).toBe(true);
    expect(stockPayload("2147483648", stamp).success).toBe(false);
    expect(stockPayload("4", "yesterday").success).toBe(false);
  });
  it("matches Unicode code point limits, trims and rejects NUL", () => {
    expect(categoryPayload("😀".repeat(100), false).success).toBe(true);
    expect(categoryPayload("😀".repeat(101), true).success).toBe(false);
    expect(categoryPayload(" x\0 ", true).success).toBe(false);
    expect(categoryPayload("  ", true).success).toBe(false);
    expect(productPayload({ ...draft, description: "x".repeat(5001) }, true).success).toBe(false);
  });
  it("checks server stock arithmetic/labels and strips internal unknown fields", () => {
    expect(decodeAdminProduct({ ...raw, photoKey: "private" })).not.toHaveProperty("photoKey");
    expect(() => decodeAdminProduct({ ...raw, availableStock: 6 })).toThrow();
    expect(() => decodeAdminProduct({ ...raw, availability: "AVAILABLE" })).toThrow();
    expect(() => decodeAdminProduct({ ...raw, reservedStock: 11, availableStock: -1 })).toThrow();
  });
  it("encodes literal search and pages/filter; category queries omit product fields", () => {
    const filter = { ...emptyCatalogFilter, q: " 50%_ ", categoryId: "cat", availability: "LOW" as const, isActive: "false" as const };
    const path = catalogAdminPath("products", 2, filter)!;
    expect(new URL(path, "https://fixture.invalid").searchParams.get("q")).toBe("50%_");
    expect(path).toContain("page=2&pageSize=10"); expect(path).toContain("availability=LOW");
    expect(catalogAdminPath("categories", 1, filter)).not.toContain("categoryId");
    expect(catalogAdminPath("products", 0, filter)).toBeNull();
    expect(catalogAdminPath("products", 1, { ...filter, categoryId: "../x" })).toBeNull();
    expect(catalogAdminPath("products", 1, { ...filter, q: "x".repeat(101) })).toBeNull();
  });
});
describe("single photo upload", () => {
  it.each(["image/jpeg", "image/png", "image/webp"])("accepts exact maximum bytes for %s", type => expect(photoIssue([{ type, size: 2000000 }])).toBeNull());
  it("rejects missing/multiple, empty, oversized, unsupported files", () => {
    for (const files of [[], [{ type: "image/png", size: 0 }], [{ type: "image/png", size: 2000001 }], [{ type: "image/svg+xml", size: 10 }], [{ type: "image/png", size: 1 }, { type: "image/png", size: 1 }]]) expect(photoIssue(files)).toBeTruthy();
  });
  it("builds one multipart file and lets fetch set Content-Type", async () => {
    const file = new File(["fake"], "demo.png", { type: "image/png" }), form = photoForm(file);
    expect([...form.keys()]).toEqual(["file"]);
    const transport = vi.fn(async (_path, options) => { expect(new Headers(options?.headers).has("Content-Type")).toBe(false); expect(options?.body).toBe(form); return Response.json({ success: true, data: { photoId: uuid, url: `/api/product-photos/${uuid}` }, meta: { requestId: "r" } }); });
    await createApiClient(transport)("/api/admin/product-photos", { method: "POST", form, decode: decodeUploadedPhoto });
  });
  it("accepts only the matching local photo URL", () => {
    expect(decodeUploadedPhoto({ photoId: uuid, url: `/api/product-photos/${uuid}` }).photoId).toBe(uuid);
    for (const url of ["https://foreign.invalid/a", "/api/product-photos/other", "javascript:x"]) expect(() => decodeUploadedPhoto({ photoId: uuid, url })).toThrow();
  });
});
function setup() {
  let allowed = true, clock = 0; const closed = vi.fn(), gate = createModalControls(closed);
  const request = vi.fn(async () => ({ data: "ok", meta: { requestId: "r" } }));
  const controller = createAdminAction({ request: request as unknown as typeof apiRequest, authorized: () => allowed, ...gate, now: () => clock });
  return { request, controller, gate, closed, revoke: () => { allowed = false; }, advance: () => { clock += 10000; } };
}
describe("catalog mutations and modal lifecycle", () => {
  it("locks double clicks, upload versus save, and close until the request settles", async () => {
    const f = setup(); let resolve!: () => void;
    const pending = f.controller.run(async () => { await new Promise<void>(done => { resolve = done; }); return { data: 1, meta: { requestId: "r" } }; }, () => f.gate.close());
    const other = createAdminAction({ request: f.request as unknown as typeof apiRequest, authorized: () => true, ...f.gate });
    const operation = vi.fn(); await f.controller.run(operation, vi.fn()); await other.run(operation, vi.fn());
    f.gate.close(); expect(f.closed).not.toHaveBeenCalled(); expect(operation).not.toHaveBeenCalled();
    resolve(); await pending; expect(f.closed).toHaveBeenCalledOnce(); expect(f.controller.getSnapshot().phase).toBe("saved");
  });
  it.each([new ApiClientError(409, "RESOURCE_VERSION_CONFLICT", ""), new ApiClientError(409, "STOCK_RESERVED", ""), new ApiClientError(503, "UNAVAILABLE", ""), new ApiClientError(0, "NETWORK_ERROR", "", "network"), new Error("unknown")])("requires reload without replay for uncertain or conflicting result %#", async error => {
    const f = setup(), operation = vi.fn(async () => { throw error; });
    await f.controller.run(operation, vi.fn()); f.controller.reset(); await f.controller.run(operation, vi.fn());
    expect(f.controller.getSnapshot().phase).toBe("needsReload"); expect(operation).toHaveBeenCalledOnce(); expect(f.gate.canStart()).toBe(true);
  });
  it("allows correction after duplicate/422 and respects rate-limit cooldown", async () => {
    const f = setup();
    for (const error of [new ApiClientError(409, "RESOURCE_EXISTS", ""), new ApiClientError(422, "VALIDATION_ERROR", ""), new ApiClientError(429, "RATE_LIMITED", "", "http", undefined, [], 10)]) {
      await f.controller.run(async () => { throw error; }, vi.fn()); expect(f.controller.getSnapshot().phase).toBe("editing");
    }
    const operation = vi.fn(async () => ({ data: 1, meta: { requestId: "r" } }));
    f.controller.reset(); await f.controller.run(operation, vi.fn()); expect(operation).not.toHaveBeenCalled();
    f.advance(); await f.controller.run(operation, vi.fn()); expect(operation).toHaveBeenCalledOnce();
  });
  it.each(["revoke", "dispose"])("ignores late success after %s", async mode => {
    const f = setup(), done = vi.fn(); let resolve!: () => void;
    const pending = f.controller.run(async () => { await new Promise<void>(value => { resolve = value; }); return { data: 1, meta: { requestId: "r" } }; }, done);
    if (mode === "revoke") f.revoke(); else f.controller.dispose(); resolve(); await pending;
    expect(done).not.toHaveBeenCalled(); expect(f.controller.getSnapshot().phase).not.toBe("saved");
  });
});
