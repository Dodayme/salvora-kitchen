import { describe, expect, it, vi } from "vitest";
import type { Prisma, PrismaClient } from "../src/generated/prisma/client";
import { createDashboardService } from "../src/services/dashboard";
import { dashboardHandlers } from "../src/lib/dashboard/http";
import { dashboardQuerySchema, voucherQuerySchema } from "../src/lib/dashboard/validation";
import { newBuyerDiscount } from "../src/lib/pricing/money";

const admin = { id: "admin", role: "ADMIN" as const }, buyer = { id: "buyer", role: "BUYER" as const };
const period = { from: "2026-10-01T00:00:00Z", to: "2026-11-01T00:00:00Z" };
const time = new Date("2026-10-23T00:00:00Z"), secret = "private-value-must-not-be-exposed";
function fixture() {
  const voucher = { id: "voucher", type: "NEW_BUYER", percentage: 20, maxDiscount: 100000, status: "AVAILABLE", createdAt: time, usedAt: null as Date | null, reservedOrderId: null as string | null, usedOrderId: null as string | null,
    user: { id: buyer.id, name: "Buyer", email: secret, passwordHash: secret }, reservedOrder: null as { id: string; number: string } | null, usedOrder: null as { id: string; number: string } | null, internal: secret };
  const tx = {
    product: { count: vi.fn(async () => 3) },
    order: {
      groupBy: vi.fn(async () => [{ status: "PROCESSING", _count: { _all: 2 } }, { status: "NEEDS_ATTENTION", _count: { _all: 1 } }]),
      findMany: vi.fn(async () => [{ id: "order", number: "SK-001", createdAt: time, status: "PROCESSING", total: 26000, currency: "IDR", paymentDeadline: time,
        items: [{ name: "Historical Item", quantity: 2 }], payments: [{ status: "SUCCESS", channel: "bank_transfer" }, { status: "PENDING", channel: "credit_card" }], phone: secret, addressLine: secret, snapToken: secret }]),
    },
    discount: { count: vi.fn(async () => 1), findMany: vi.fn(async () => [voucher]) },
    $queryRaw: vi.fn(async (query: Prisma.Sql): Promise<unknown[]> => { void query; return []; }),
  };
  tx.$queryRaw.mockResolvedValueOnce([{ low: 12, out: 1 }]).mockResolvedValueOnce([{ id: "product", name: "Low", isActive: false, isDemo: true, physicalStock: 8, reservedStock: 5, availableStock: 3 }]).mockResolvedValueOnce([{ id: "zero", name: "Zero", isActive: true, isDemo: false, physicalStock: 2, reservedStock: 2, availableStock: 0 }]);
  const raw = { $transaction: vi.fn(async (action: (client: typeof tx) => unknown) => action(tx)) };
  return { tx, raw, voucher, service: createDashboardService(raw as unknown as PrismaClient) };
}

describe("BE-13 input dan izin", () => {
  it("mewajibkan periode UTC terurut dan menolak field di luar kontrak", () => {
    expect(dashboardQuerySchema.safeParse(period).success).toBe(true);
    for (const input of [{}, { ...period, to: period.from }, { ...period, from: period.to }, { ...period, from: "2026-10-01" }, { ...period, from: "invalid" }, { ...period, total: 1 }]) expect(dashboardQuerySchema.safeParse(input).success).toBe(false);
  });
  it("validasi voucher ketat, pagination dibatasi dan bukan input edit kebijakan", () => {
    expect(voucherQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    for (const input of [{ status: "EXPIRED" }, { page: "0" }, { pageSize: "101" }, { percentage: 50 }, { userId: buyer.id }]) expect(voucherQuerySchema.safeParse(input).success).toBe(false);
  });
  it("semua operasi hanya admin, sebelum akses database", async () => {
    const f = fixture();
    for (const principal of [null, buyer]) {
      const expected = principal ? 403 : 401;
      await expect(f.service.dashboard(principal, period)).rejects.toMatchObject({ status: expected });
      await expect(f.service.vouchers(principal, {})).rejects.toMatchObject({ status: expected });
      await expect(f.service.policy(principal, {})).rejects.toMatchObject({ status: expected });
    }
    expect(f.raw.$transaction).not.toHaveBeenCalled();
  });
});

describe("Dashboard dengan Prisma mock, bukan bukti agregasi PostgreSQL", () => {
  it("memakai periode sama, status nol lengkap dan total dari kelompok status", async () => {
    const f = fixture(), value = await f.service.dashboard(admin, period);
    expect(value.orderCount).toBe(3); expect(value.ordersByStatus).toHaveLength(7);
    expect(value.ordersByStatus.find(row => row.status === "COMPLETED")?.count).toBe(0);
    const where = { createdAt: { gte: new Date(period.from), lt: new Date(period.to) } };
    expect(f.tx.order.groupBy).toHaveBeenCalledWith({ by: ["status"], where, _count: { _all: true } });
    expect(f.tx.order.findMany).toHaveBeenCalledWith(expect.objectContaining({ where, take: 10, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }));
    expect(f.raw.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "RepeatableRead" });
  });
  it("produk aktif tidak difilter stok; inventaris global memakai selisih reservasi dan ambang 1–5", async () => {
    const f = fixture(), value = await f.service.dashboard(admin, period);
    expect(f.tx.product.count).toHaveBeenCalledWith({ where: { isActive: true } });
    expect(value.activeProductCount).toBe(3); expect(value.lowStockCount).toBe(12); expect(value.lowStockProducts).toHaveLength(1);
    expect(value.lowStockProducts[0]).toMatchObject({ availableStock: 3, isActive: false }); expect(value.outOfStockProducts[0].availableStock).toBe(0);
    expect(value.inventoryScope).toBe("CURRENT_ALL_PRODUCTS"); expect(value.lowStockThreshold).toBe(5);
    const [countQuery, lowQuery, outQuery] = f.tx.$queryRaw.mock.calls.map(([query]) => query);
    expect(countQuery.sql).toContain('"physicalStock"-"reservedStock"'); expect(countQuery.values).toContain(5);
    expect(lowQuery.sql).toContain("BETWEEN 1 AND ?"); expect(lowQuery.values).toEqual([5, 10]);
    expect(outQuery.sql).toContain('"physicalStock"-"reservedStock"=0'); expect(outQuery.sql).not.toContain('"isActive"=true');
  });
  it("ringkasan snapshot aman dan attempt pending tidak menutupi sukses", async () => {
    const f = fixture(), value = await f.service.dashboard(admin, period);
    expect(value.latestOrders[0]).toMatchObject({ itemSummary: [{ name: "Historical Item", quantity: 2 }], paymentStatus: "SUCCESS", paymentStatuses: ["SUCCESS", "PENDING"] });
    expect(JSON.stringify(value)).not.toContain(secret); expect(value).not.toHaveProperty("revenue"); expect(value).not.toHaveProperty("customerCount");
  });
  it("keadaan kosong menghasilkan nol dan daftar kosong", async () => {
    const f = fixture(); f.tx.product.count.mockResolvedValue(0); f.tx.order.groupBy.mockResolvedValue([]); f.tx.order.findMany.mockResolvedValue([]);
    f.tx.$queryRaw.mockReset().mockResolvedValueOnce([{ low: 0, out: 0 }]).mockResolvedValue([]);
    const value = await f.service.dashboard(admin, period);
    expect(value.orderCount).toBe(0); expect(value.ordersByStatus.every(row => row.count === 0)).toBe(true);
    expect(value).toMatchObject({ activeProductCount: 0, lowStockCount: 0, outOfStockCount: 0, latestOrders: [], lowStockProducts: [], outOfStockProducts: [] });
  });
});

describe("Pemantauan voucher hanya baca", () => {
  it("status persisted, owner whitelist dan relasi reservasi ditampilkan tanpa secret", async () => {
    const f = fixture(); f.voucher.status = "RESERVED"; f.voucher.reservedOrderId = "reserved"; f.voucher.reservedOrder = { id: "reserved", number: "SK-R" };
    const value = await f.service.vouchers(admin, { status: "RESERVED", page: "2", pageSize: "5" });
    expect(f.tx.discount.count).toHaveBeenCalledWith({ where: { status: "RESERVED" } });
    expect(f.tx.discount.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: "RESERVED" }, skip: 5, take: 5, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }));
    expect(value.data[0]).toMatchObject({ status: "RESERVED", owner: { id: buyer.id, name: "Buyer" }, orderNumber: "SK-R", usedOrder: null });
    expect(JSON.stringify(value)).not.toContain(secret); expect(value.pagination).toMatchObject({ page: 2, pageSize: 5, total: 1 });
  });
  it("AVAILABLE dan USED berasal dari baris database, tidak direkonstruksi dari tenggat", async () => {
    const f = fixture(); expect((await f.service.vouchers(admin, {})).data[0]).toMatchObject({ status: "AVAILABLE", orderNumber: null, usedAt: null });
    f.voucher.status = "USED"; f.voucher.usedOrderId = "used"; f.voucher.usedOrder = { id: "used", number: "SK-U" }; f.voucher.usedAt = time;
    expect((await f.service.vouchers(admin, {})).data[0]).toMatchObject({ status: "USED", orderNumber: "SK-U", usedOrderId: "used", usedAt: time.toISOString() });
    expect(Object.keys(f.tx.discount).sort()).toEqual(["count", "findMany"]);
  });
  it("kebijakan tetap sesuai kalkulator checkout tanpa akses database", async () => {
    const f = fixture(), policy = await f.service.policy(admin, {});
    expect(policy).toEqual({ type: "NEW_BUYER", percentage: 20, maxDiscount: 100000, oncePerAccount: true });
    expect(newBuyerDiscount(100000, true)).toBe(100000 * policy.percentage / 100);
    expect(newBuyerDiscount(1000000, true)).toBe(policy.maxDiscount);
    await expect(f.service.policy(admin, { percentage: "50" })).rejects.toThrow();
    expect(f.raw.$transaction).not.toHaveBeenCalled();
  });
});

describe("HTTP handler mock", () => {
  it("401/403 dan headers privat, duplikat/query asing ditolak", async () => {
    const f = fixture(); let principal: typeof admin | typeof buyer | null = null;
    const handlers = dashboardHandlers(() => ({ service: f.service, principal: async () => principal }));
    expect((await handlers.dashboard(new Request("https://app.test/api/admin/dashboard"))).status).toBe(401);
    principal = buyer; expect((await handlers.vouchers(new Request("https://app.test/api/admin/vouchers"))).status).toBe(403);
    principal = admin;
    const bad = await handlers.vouchers(new Request("https://app.test/api/admin/vouchers?status=USED&status=AVAILABLE"));
    expect(bad.status).toBe(422); expect(bad.headers.get("vary")).toBe("Cookie"); expect(bad.headers.get("cache-control")).toBe("no-store");
    expect((await handlers.policy(new Request("https://app.test/api/admin/voucher-policy?reset=true"))).status).toBe(422);
    expect(f.raw.$transaction).not.toHaveBeenCalled();
  });
  it("GET admin tanpa Origin, envelope pagination dan kegagalan DB tidak membocorkan output", async () => {
    const f = fixture(), handlers = dashboardHandlers(() => ({ service: f.service, principal: async () => admin }));
    const response = await handlers.vouchers(new Request("https://app.test/api/admin/vouchers"));
    expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ success: true, meta: { pagination: { total: 1 } } });
    f.tx.discount.count.mockRejectedValue(new Error(secret));
    const failure = await handlers.vouchers(new Request("https://app.test/api/admin/vouchers"));
    expect(failure.status).toBe(500); expect(await failure.text()).not.toContain(secret);
  });
});
