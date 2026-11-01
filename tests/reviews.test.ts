import { describe, expect, it, vi } from "vitest";
import { Prisma, type PrismaClient } from "../src/generated/prisma/client";
import { createReviewService } from "../src/services/reviews";
import { reviewInputSchema } from "../src/lib/reviews/validation";
import { reviewHandlers } from "../src/lib/reviews/http";

const buyer = { id: "buyer", role: "BUYER" as const }, admin = { id: "admin", role: "ADMIN" as const };
const input = { rating: 5, comment: "Makanannya enak sekali." }, time = new Date("2026-10-23T00:00:00Z"), secret = "private-data-not-for-public";
function fixture() {
  const row = { id: "review", rating: 5, comment: input.comment, createdAt: time, orderItemId: secret, raw: secret,
    orderItem: { productId: "product", order: { userId: secret, addressLine: secret, user: { name: "Nama Tampilan", email: secret, passwordHash: secret } } } };
  const item = { id: "item", order: { status: "COMPLETED" }, rating: null as { id: string } | null };
  const tx = {
    product: { findFirst: vi.fn(async () => ({ id: "product" }) as { id: string } | null) },
    orderItem: { findFirst: vi.fn(async () => item as typeof item | null) },
    rating: { aggregate: vi.fn(async () => ({ _count: { _all: 3 }, _avg: { rating: 4 as number | null } })), findMany: vi.fn(async () => [row]), create: vi.fn(async () => row) },
    $queryRaw: vi.fn(async () => []),
  };
  const raw = { orderItem: { findFirst: vi.fn(async () => ({ orderId: "order" }) as { orderId: string } | null) }, $transaction: vi.fn(async (action: (client: typeof tx) => unknown) => action(tx)) };
  const service = createReviewService(raw as unknown as PrismaClient);
  return { row, item, tx, raw, service };
}
const known = (code: string) => new Prisma.PrismaClientKnownRequestError(secret, { code, clientVersion: "mock" });

describe("BE-12 validasi ulasan", () => {
  it("rating integer 1–5 dan komentar setelah trim pada batas 10/1000", () => {
    expect(reviewInputSchema.parse({ rating: 1, comment: `  ${"a".repeat(10)}  ` })).toEqual({ rating: 1, comment: "a".repeat(10) });
    expect(reviewInputSchema.safeParse({ rating: 5, comment: "a".repeat(1000) }).success).toBe(true);
    for (const rating of [0, 6, 1.5, "5", null]) expect(reviewInputSchema.safeParse({ ...input, rating }).success).toBe(false);
    for (const comment of [" ".repeat(20), "a".repeat(9), "a".repeat(1001), "valid text\u0000bad"]) expect(reviewInputSchema.safeParse({ ...input, comment }).success).toBe(false);
  });
  it("menolak productId/userId/orderId dan field asing dari browser", () => {
    for (const key of ["productId", "userId", "orderId", "author", "isVerified"]) expect(reviewInputSchema.safeParse({ ...input, [key]: "injected" }).success).toBe(false);
  });
});

describe("Penyimpanan dengan mock; bukan bukti lock PostgreSQL", () => {
  it("anonim/admin ditolak sebelum database", async () => {
    const f = fixture();
    await expect(f.service.create(null, "item", input)).rejects.toMatchObject({ status: 401 });
    await expect(f.service.create(admin, "item", input)).rejects.toMatchObject({ status: 403 });
    expect(f.raw.orderItem.findFirst).not.toHaveBeenCalled(); expect(f.raw.$transaction).not.toHaveBeenCalled();
  });
  it("item asing/tidak ada 404 dengan lookup scoped, tanpa transaksi tulis", async () => {
    const f = fixture(); f.raw.orderItem.findFirst.mockResolvedValue(null);
    await expect(f.service.create(buyer, "item", input)).rejects.toMatchObject({ status: 404 });
    expect(f.raw.orderItem.findFirst).toHaveBeenCalledWith({ where: { id: "item", order: { userId: buyer.id } }, select: { orderId: true } });
    expect(f.raw.$transaction).not.toHaveBeenCalled();
  });
  it("status diperiksa ulang setelah lock, semua status selain COMPLETED ditolak", async () => {
    const f = fixture();
    for (const status of ["AWAITING_PAYMENT", "PROCESSING", "SHIPPED", "EXPIRED", "NEEDS_ATTENTION"]) {
      f.item.order.status = status;
      await expect(f.service.create(buyer, "item", input)).rejects.toMatchObject({ status: 409, code: "ORDER_NOT_COMPLETED" });
    }
    expect(f.tx.rating.create).not.toHaveBeenCalled();
    const [userLock, orderLock] = f.tx.$queryRaw.mock.calls as unknown as Array<[TemplateStringsArray, ...unknown[]]>;
    expect(userLock[0].join("?")).toContain('FROM "User"'); expect(orderLock[0].join("?")).toContain('FROM "Order"');
    expect(f.tx.orderItem.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "item", orderId: "order", order: { userId: buyer.id } } }));
    expect(f.tx.$queryRaw.mock.invocationCallOrder[1]).toBeLessThan(f.tx.orderItem.findFirst.mock.invocationCallOrder[0]);
  });
  it("item tidak lagi ditemukan setelah lock ditolak", async () => {
    const f = fixture(); f.tx.orderItem.findFirst.mockResolvedValue(null);
    await expect(f.service.create(buyer, "item", input)).rejects.toMatchObject({ status: 404 }); expect(f.tx.rating.create).not.toHaveBeenCalled();
  });
  it("satu item satu ulasan; existing maupun unique conflict dipetakan 409", async () => {
    const f = fixture(); f.item.rating = { id: "old" };
    await expect(f.service.create(buyer, "item", input)).rejects.toMatchObject({ status: 409, code: "REVIEW_EXISTS" });
    expect(f.tx.rating.create).not.toHaveBeenCalled(); f.item.rating = null; f.tx.rating.create.mockRejectedValue(known("P2002"));
    await expect(f.service.create(buyer, "item", input)).rejects.toMatchObject({ status: 409, code: "REVIEW_EXISTS" });
  });
  it("menyimpan relasi item saja dan DTO publik tidak mengekspos identitas internal", async () => {
    const f = fixture(), result = await f.service.create(buyer, "item", { ...input, comment: ` ${input.comment} ` });
    expect(f.tx.rating.create).toHaveBeenCalledWith(expect.objectContaining({ data: { orderItemId: "item", ...input } }));
    expect(result).toEqual({ id: "review", productId: "product", ...input, author: { displayName: "Nama Tampilan" }, createdAt: time.toISOString() });
    expect(JSON.stringify(result)).not.toContain(secret);
  });
  it("pembelian produk sama pada item berbeda tidak dibatasi oleh productId", async () => {
    const f = fixture(); await f.service.create(buyer, "item", input);
    f.item.id = "item2"; await f.service.create(buyer, "item2", input);
    expect(f.tx.rating.create).toHaveBeenNthCalledWith(2, expect.objectContaining({ data: { orderItemId: "item2", ...input } }));
  });
  it("serialization conflict menjadi 503 terkontrol", async () => {
    const f = fixture(); f.tx.rating.create.mockRejectedValue(known("P2034"));
    await expect(f.service.create(buyer, "item", input)).rejects.toMatchObject({ status: 503, code: "REVIEW_BUSY" });
  });
});

describe("Daftar publik dan ringkasan rating", () => {
  it("produk/kategori nonaktif atau tidak ada 404 sebelum membaca rating", async () => {
    const f = fixture(); f.tx.product.findFirst.mockResolvedValue(null);
    await expect(f.service.list("product", {})).rejects.toMatchObject({ status: 404 });
    expect(f.tx.product.findFirst).toHaveBeenCalledWith({ where: { id: "product", isActive: true, category: { isActive: true } }, select: { id: true } });
    expect(f.tx.rating.findMany).not.toHaveBeenCalled();
  });
  it("count/average seluruh produk dan halaman memakai snapshot transaksi sama", async () => {
    const f = fixture(), result = await f.service.list("product", { page: "2", pageSize: "2" });
    expect(result.summary).toEqual({ averageRating: 4, reviewCount: 3 }); expect(result.pagination).toMatchObject({ total: 3, page: 2, pageSize: 2, totalPages: 2 });
    expect(f.tx.rating.aggregate).toHaveBeenCalledWith({ where: { orderItem: { productId: "product" } }, _count: { _all: true }, _avg: { rating: true } });
    expect(f.tx.rating.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { orderItem: { productId: "product" } }, skip: 2, take: 2, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }));
    expect(f.raw.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "RepeatableRead" }); expect(JSON.stringify(result)).not.toContain(secret);
  });
  it("produk tanpa ulasan dan halaman di luar hasil mengembalikan array kosong", async () => {
    const f = fixture(); f.tx.rating.findMany.mockResolvedValue([]); f.tx.rating.aggregate.mockResolvedValue({ _count: { _all: 0 }, _avg: { rating: null } });
    expect(await f.service.list("product", { page: "9" })).toMatchObject({ data: [], summary: { averageRating: null, reviewCount: 0 }, pagination: { page: 9, totalPages: 0 } });
  });
});

describe("HTTP handler mock", () => {
  const request = (body: unknown = input, origin = "https://app.test") => new Request("https://app.test/api/order-items/item/review", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  it("publik tanpa sesi, metadata ringkasan dan query duplikat ditolak", async () => {
    const f = fixture(), principal = vi.fn(async () => null), handlers = reviewHandlers(() => ({ service: f.service, principal, appUrl: "https://app.test" }));
    const response = await handlers.list(new Request("https://app.test/api/products/product/reviews"), "product");
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ success: true, meta: { ratingSummary: { averageRating: 4, reviewCount: 3 }, pagination: { total: 3 } } }); expect(principal).not.toHaveBeenCalled();
    expect((await handlers.list(new Request("https://app.test/api/products/product/reviews?page=1&page=2"), "product")).status).toBe(422);
  });
  it("Origin/sesi/role menolak sebelum penyimpanan, respons privat", async () => {
    const f = fixture(); let principal: typeof buyer | typeof admin | null = null;
    const handlers = reviewHandlers(() => ({ service: f.service, principal: async () => principal, appUrl: "https://app.test" }));
    expect((await handlers.create(request(), "item")).status).toBe(401); principal = admin; expect((await handlers.create(request(), "item")).status).toBe(403);
    principal = buyer; const response = await handlers.create(request(input, "https://evil.test"), "item");
    expect(response.status).toBe(403); expect(response.headers.get("vary")).toBe("Cookie"); expect(response.headers.get("cache-control")).toBe("no-store"); expect(f.tx.rating.create).not.toHaveBeenCalled();
  });
  it("payload tak sah 422, sukses 201 dan error database tidak membocorkan detail", async () => {
    const f = fixture(), handlers = reviewHandlers(() => ({ service: f.service, principal: async () => buyer, appUrl: "https://app.test" }));
    expect((await handlers.create(request({ ...input, productId: "other" }), "item")).status).toBe(422);
    const success = await handlers.create(request(), "item"); expect(success.status).toBe(201); expect(JSON.stringify(await success.json())).not.toContain(secret);
    f.tx.rating.create.mockRejectedValue(new Error(secret)); const failure = await handlers.create(request(), "item"); expect(failure.status).toBe(500); expect(await failure.text()).not.toContain(secret);
  });
});
