import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../src/generated/prisma/client";
import { assertFulfillment } from "../src/lib/orders/fulfillment";
import { adminOrderQuerySchema, adminPaymentQuerySchema, buyerOrderQuerySchema, fulfillmentSchema, orderNoteSchema } from "../src/lib/orders/validation";
import { orderDetail, orderSummary } from "../src/lib/orders/view";
import { createOrderService } from "../src/services/orders";
import { orderHandlers } from "../src/lib/orders/http";
import { queryParameters } from "../src/lib/catalog/validation";

const time = new Date("2026-10-23T00:00:00Z"), deadline = new Date(time.getTime() + 3600000);
const buyer = { id: "buyer", role: "BUYER" as const }, admin = { id: "admin", role: "ADMIN" as const }, secret = "private-token-session-credential-sentinel";
function record() {
  return {
    id: "order", number: "SK-001", userId: buyer.id, createdAt: time, status: "PROCESSING", total: 26000, subtotal: 20000, discount: 4000, discountId: "voucher", shippingFee: 10000, currency: "IDR", paymentDeadline: deadline,
    recipientName: "Snapshot Recipient", phone: "081200000000", addressLine: "Snapshot Address", city: "Tanjungpinang", province: "Kepulauan Riau", postalCode: null, addressNotes: null, shippingMode: "MANUAL_DELIVERY", shippingLabel: "Manual", attentionReason: null,
    items: [{ id: "item", productId: "product", name: "Historical Product", quantity: 2, unitPrice: 10000, lineSubtotal: 20000, rating: null, reservation: { status: "CONSUMED" } }],
    user: { id: buyer.id, name: "Buyer Name", passwordHash: secret },
    payments: [{ id: "payment", providerOrderId: "SV-fixture", provider: "MIDTRANS", status: "SUCCESS", amount: 26000, currency: "IDR", channel: "bank_transfer", createdAt: time, expiresAt: deadline, paidAt: time, midtransTransactionId: "tx", snapToken: secret, snapRedirectUrl: secret, events: [], rawPayload: secret }],
    application: { paymentId: "payment", payment: { id: "payment", status: "SUCCESS", paidAt: time, midtransTransactionId: "tx", amount: 26000, currency: "IDR" } },
    history: [
      { id: "h1", fromStatus: "AWAITING_PAYMENT", toStatus: "PROCESSING", changedAt: time, actor: "SYSTEM", note: "Payment applied", actorUser: null },
      { id: "h2", fromStatus: "PROCESSING", toStatus: "PROCESSING", changedAt: time, actor: "ADMIN", note: "Internal handling note", actorUser: { id: admin.id, name: "Admin", passwordHash: secret } },
      { id: "h3", fromStatus: "PROCESSING", toStatus: "SHIPPED", changedAt: time, actor: "ADMIN", note: "Private admin transition note", actorUser: { id: admin.id, name: "Admin", passwordHash: secret } },
    ],
  };
}
const dto = (value = record(), isAdmin = false) => orderDetail(value as unknown as Parameters<typeof orderDetail>[0], time, isAdmin);
function mockDb(value = record()) {
  const tx = {
    $queryRaw: vi.fn(async () => [{ time }]),
    order: { findFirst: vi.fn(async () => value), findUnique: vi.fn(async () => ({ userId: buyer.id })), findUniqueOrThrow: vi.fn(async () => value), count: vi.fn(async () => 1), findMany: vi.fn(async () => [value]), updateMany: vi.fn(async () => ({ count: 1 })) },
    payment: { count: vi.fn(async () => 1), findMany: vi.fn(async () => value.payments.map(p => ({ ...p, orderId: value.id, order: { number: value.number } }))) },
    orderStatusHistory: { create: vi.fn(async () => ({})) },
  };
  const db = { ...tx, $transaction: vi.fn(async (action: (client: typeof tx) => unknown) => action(tx)) };
  return { db: db as unknown as PrismaClient, tx, raw: db };
}
describe("BE-11 validation dan aturan fulfillment murni", () => {
  it("query membatasi status, kanal, tanggal UTC, pagination dan field asing", () => {
    expect(adminOrderQuerySchema.parse({ paymentStatus: "SUCCESS", channel: "bank_transfer", from: time.toISOString(), to: deadline.toISOString() }).pageSize).toBe(20);
    for (const q of [{ status: "ACTIVE" }, { paymentStatus: "paid" }, { from: deadline.toISOString(), to: time.toISOString() }, { channel: "bad/channel" }, { from: "invalid" }, { pageSize: "101" }, { userId: buyer.id }]) expect(() => adminOrderQuerySchema.parse(q)).toThrow();
    expect(() => buyerOrderQuerySchema.parse({ paymentStatus: "SUCCESS" })).toThrow();
    expect(() => adminPaymentQuerySchema.parse({ orderId: "../order" })).toThrow();
    expect(() => queryParameters("https://app.test/api/orders?status=SHIPPED&status=COMPLETED")).toThrow();
  });
  it("mutation tidak menerima harga, isPaid, hapus status atau catatan kosong/terlalu panjang", () => {
    for (const body of [{ status: "SUCCESS", expectedStatus: "PROCESSING" }, { status: "SHIPPED", expectedStatus: "PROCESSING", isPaid: true }, { status: "SHIPPED" }]) expect(() => fulfillmentSchema.parse(body)).toThrow();
    for (const note of ["   ", "x".repeat(1001), "unsafe\u0000"]) expect(() => orderNoteSchema.parse({ note })).toThrow();
  });
  it("PROCESSING ke SHIPPED hanya untuk applied success dan reservasi consumed", () => {
    const input = fulfillmentSchema.parse({ status: "SHIPPED", expectedStatus: "PROCESSING" });
    expect(() => assertFulfillment(record(), input, true)).not.toThrow();
    const cases = [
      { ...record(), application: null },
      { ...record(), application: { ...record().application, payment: { ...record().application.payment, status: "PENDING" } } },
      { ...record(), application: { ...record().application, payment: { ...record().application.payment, paidAt: new Date(deadline.getTime() + 1) } } },
      { ...record(), application: { ...record().application, payment: { ...record().application.payment, amount: 1 } } },
      { ...record(), items: [{ reservation: { status: "RESERVED" } }] },
    ];
    for (const value of cases) expect(() => assertFulfillment(value, input, true)).toThrow(expect.objectContaining({ code: "ORDER_PAYMENT_NOT_FULFILLABLE" }));
  });
  it("attempt lain aktif, sukses ganda, refund atau reversal menahan pemenuhan", () => {
    for (const status of ["CREATED", "PENDING", "UNCONFIRMED", "SUCCESS", "REFUNDED", "PARTIALLY_REFUNDED", "REVERSED"]) expect(() => assertFulfillment({ ...record(), payments: [...record().payments, { id: "other", status }] }, { status: "SHIPPED", expectedStatus: "PROCESSING" }, true)).toThrow();
  });
  it("transisi ilegal dan expectedStatus stale ditolak", () => {
    for (const status of ["AWAITING_PAYMENT", "EXPIRED", "NEEDS_ATTENTION", "COMPLETED"]) expect(() => assertFulfillment({ ...record(), status }, { status: "SHIPPED", expectedStatus: status as "PROCESSING" }, true)).toThrow();
    expect(() => assertFulfillment(record(), { status: "COMPLETED", expectedStatus: "PROCESSING" }, true)).toThrow(expect.objectContaining({ code: "ORDER_TRANSITION_INVALID" }));
    expect(() => assertFulfillment(record(), { status: "SHIPPED", expectedStatus: "SHIPPED" }, true)).toThrow(expect.objectContaining({ code: "ORDER_STATUS_CONFLICT" }));
  });
  it("Selesai membutuhkan keputusan aktif, receiptConfirmed true dan catatan", () => {
    const order = { ...record(), status: "SHIPPED" }, input = { status: "COMPLETED" as const, expectedStatus: "SHIPPED" as const, receiptConfirmed: true, note: "Penerima mengonfirmasi melalui telepon." };
    expect(() => assertFulfillment(order, input, false)).toThrow(expect.objectContaining({ code: "RECEIPT_POLICY_PENDING" }));
    expect(() => assertFulfillment(order, { ...input, receiptConfirmed: false }, true)).toThrow(expect.objectContaining({ code: "RECEIPT_CONFIRMATION_REQUIRED" }));
    expect(() => assertFulfillment(order, { ...input, note: undefined }, true)).toThrow();
    expect(() => assertFulfillment(order, input, true)).not.toThrow();
  });
});
describe("DTO snapshot, pembayaran dan privasi", () => {
  it("menampilkan snapshot dan seluruh percobaan tanpa token/password/raw payload", () => {
    const value = dto(); expect(value.address.addressLine).toBe("Snapshot Address"); expect(value.items[0].name).toBe("Historical Product"); expect(value.total).toBe(26000);
    expect(JSON.stringify(value)).not.toContain(secret); expect(value.payments[0]).not.toHaveProperty("midtransTransactionId");
    expect(value.history).toHaveLength(2); expect(value.history[1].note).toBeNull(); expect(value.history[1]).not.toHaveProperty("actorUser");
  });
  it("admin mendapat catatan/pelaku aman, tanpa hak bayar/ulas sebagai pembeli", () => {
    const value = dto({ ...record(), status: "COMPLETED" }, true);
    expect(value.history).toHaveLength(3); expect(value.history[1].actorUser).toEqual({ id: admin.id, name: "Admin" });
    expect(JSON.stringify(value)).not.toContain(secret); expect(value.canPay).toBe(false); expect(value.items[0].canReview).toBe(false);
  });
  it("canReview hanya untuk item selesai yang belum diulas", () => {
    expect(dto().items[0].canReview).toBe(false); expect(dto({ ...record(), status: "COMPLETED" }).items[0].canReview).toBe(true);
    const value = record(); value.status = "COMPLETED"; value.items[0].rating = { id: "review" } as never;
    expect(dto(value).items[0].canReview).toBe(false);
  });
  it("attempt gagal/pending baru tidak menutupi sukses; semua status/kanal tetap terlihat", () => {
    const value = record(); value.payments.push({ ...value.payments[0], id: "later", status: "PENDING", channel: "credit_card" });
    const summary = orderSummary(value as unknown as Parameters<typeof orderSummary>[0]);
    expect(summary.paymentStatus).toBe("SUCCESS"); expect(summary.paymentStatuses).toEqual(["SUCCESS", "PENDING"]); expect(summary.channels).toEqual(["bank_transfer", "credit_card"]);
    expect(summary).not.toHaveProperty("address"); expect(summary).not.toHaveProperty("userId");
  });
});
describe("Service dengan Prisma mock; bukan bukti transaksi/concurrency PostgreSQL", () => {
  it("akses ditolak sebelum database dan detail di-scope ke owner", async () => {
    const f = mockDb(), service = createOrderService(f.db);
    await expect(service.buyerOrders(null, {})).rejects.toMatchObject({ status: 401 });
    await expect(service.adminOrders(buyer, {})).rejects.toMatchObject({ status: 403 });
    expect(f.raw.$transaction).not.toHaveBeenCalled();
    f.tx.order.findFirst.mockResolvedValueOnce(null as never);
    await expect(service.detail(buyer, "foreign")).rejects.toMatchObject({ status: 404 });
    expect(f.tx.order.findFirst).toHaveBeenLastCalledWith(expect.objectContaining({ where: { id: "foreign", userId: buyer.id } }));
  });
  it("daftar buyer selalu filter owner, paginasi dan urutan stabil", async () => {
    const f = mockDb(), result = await createOrderService(f.db).buyerOrders(buyer, { page: "2", pageSize: "1", status: "PROCESSING" });
    expect(f.tx.order.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: buyer.id, status: "PROCESSING" }, skip: 1, take: 1, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }));
    expect(result.pagination.total).toBe(1); expect(result.data[0]).not.toHaveProperty("buyer"); expect(JSON.stringify(result)).not.toContain(secret);
  });
  it("filter pembayaran+kanal admin mengikat attempt yang sama dan tanggal createdAt", async () => {
    const f = mockDb(), result = await createOrderService(f.db).adminOrders(admin, { q: "SK-", paymentStatus: "SUCCESS", channel: "bank_transfer", from: time.toISOString(), to: deadline.toISOString() });
    expect(f.tx.order.count).toHaveBeenCalledWith({ where: { number: { contains: "SK-", mode: "insensitive" }, payments: { some: { status: "SUCCESS", channel: "bank_transfer" } }, createdAt: { gte: time, lt: deadline } } });
    expect(result.data[0].buyer).toEqual({ id: buyer.id, name: "Buyer Name" }); expect(JSON.stringify(result)).not.toContain(secret);
  });
  it("monitor pembayaran hanya DTO aman, tidak membuka provider atau menulis status", async () => {
    const f = mockDb(), result = await createOrderService(f.db).adminPayments(admin, { orderId: "order", status: "SUCCESS" });
    expect(result.data[0]).toMatchObject({ orderId: "order", orderNumber: "SK-001", status: "SUCCESS" }); expect(JSON.stringify(result)).not.toContain(secret);
    expect(f.tx.order.updateMany).not.toHaveBeenCalled(); expect(f.tx.orderStatusHistory.create).not.toHaveBeenCalled();
  });
  it("fulfillment mencatat pelaku/status dan hanya memperbarui status order", async () => {
    const f = mockDb(); await createOrderService(f.db).fulfill(admin, "order", { status: "SHIPPED", expectedStatus: "PROCESSING" });
    expect(f.tx.order.updateMany).toHaveBeenCalledWith({ where: { id: "order", status: "PROCESSING" }, data: { status: "SHIPPED" } });
    expect(f.tx.orderStatusHistory.create).toHaveBeenCalledWith({ data: expect.objectContaining({ actor: "ADMIN", actorUserId: admin.id, fromStatus: "PROCESSING", toStatus: "SHIPPED", changedAt: time }) });
  });
  it("stale update tidak menulis riwayat; note tidak mengubah status/nominal", async () => {
    const f = mockDb(), service = createOrderService(f.db); f.tx.order.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.fulfill(admin, "order", { status: "SHIPPED", expectedStatus: "PROCESSING" })).rejects.toMatchObject({ status: 409 }); expect(f.tx.orderStatusHistory.create).not.toHaveBeenCalled();
    f.tx.order.updateMany.mockClear(); await service.addNote(admin, "order", { note: "Periksa refund melalui prosedur toko." });
    expect(f.tx.order.updateMany).not.toHaveBeenCalled(); expect(f.tx.orderStatusHistory.create).toHaveBeenCalledWith({ data: expect.objectContaining({ fromStatus: "PROCESSING", toStatus: "PROCESSING", actorUserId: admin.id }) });
  });
  it("Selesai merekam konfirmasi/pelaku tanpa mengubah snapshot atau pembayaran", async () => {
    const f = mockDb({ ...record(), status: "SHIPPED" });
    await createOrderService(f.db).fulfill(admin, "order", { status: "COMPLETED", expectedStatus: "SHIPPED", receiptConfirmed: true, note: "Penerima mengonfirmasi melalui telepon." });
    expect(f.tx.order.updateMany).toHaveBeenCalledWith({ where: { id: "order", status: "SHIPPED" }, data: { status: "COMPLETED" } });
    expect(f.tx.orderStatusHistory.create).toHaveBeenCalledWith({ data: expect.objectContaining({ actorUserId: admin.id, fromStatus: "SHIPPED", toStatus: "COMPLETED", note: "Penerimaan dikonfirmasi admin. Penerima mengonfirmasi melalui telepon." }) });
  });
  it("admin detail tidak di-scope ke akun admin; note pada NEEDS_ATTENTION tetap tidak memaksa status", async () => {
    const f = mockDb({ ...record(), status: "NEEDS_ATTENTION", attentionReason: "PAYMENT_REFUND_OR_REVERSAL" as never }), service = createOrderService(f.db);
    await service.detail(admin, "order"); expect(f.tx.order.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "order" } }));
    await service.addNote(admin, "order", { note: "Hubungi pembeli untuk pemeriksaan." });
    expect(f.tx.order.updateMany).not.toHaveBeenCalled(); expect(f.tx.orderStatusHistory.create).toHaveBeenCalledWith({ data: expect.objectContaining({ fromStatus: "NEEDS_ATTENTION", toStatus: "NEEDS_ATTENTION" }) });
  });
});
describe("HTTP handler mock: akses, Origin, payload, header privat", () => {
  it("anonim/buyer ditolak pada admin dan Origin salah tidak memanggil service", async () => {
    const f = mockDb(); let principal: typeof buyer | typeof admin | null = null;
    const handlers = orderHandlers(() => ({ service: createOrderService(f.db), principal: async () => principal, appUrl: "https://app.test" }));
    expect((await handlers.adminOrders(new Request("https://app.test/api/admin/orders"))).status).toBe(401);
    principal = buyer; expect((await handlers.adminPayments(new Request("https://app.test/api/admin/payments"))).status).toBe(403);
    principal = admin;
    const response = await handlers.fulfill(new Request("https://app.test/api/admin/orders/order/status", { method: "PATCH", headers: { Origin: "https://evil.test", "Content-Type": "application/json" }, body: "{}" }), "order");
    expect(response.status).toBe(403); expect(response.headers.get("vary")).toBe("Cookie"); expect(response.headers.get("cache-control")).toBe("no-store"); expect(f.raw.$transaction).not.toHaveBeenCalled();
  });
  it("duplicate filter dan input isPaid ditolak; GET owner tidak membutuhkan Origin", async () => {
    const f = mockDb(); const handlers = orderHandlers(() => ({ service: createOrderService(f.db), principal: async () => admin, appUrl: "https://app.test" }));
    expect((await handlers.adminOrders(new Request("https://app.test/api/admin/orders?status=SHIPPED&status=COMPLETED"))).status).toBe(422);
    const bad = await handlers.fulfill(new Request("https://app.test/api/admin/orders/order/status", { method: "PATCH", headers: { Origin: "https://app.test", "Content-Type": "application/json" }, body: JSON.stringify({ status: "SHIPPED", expectedStatus: "PROCESSING", isPaid: true }) }), "order"); expect(bad.status).toBe(422);
    const response = await handlers.detail(new Request("https://app.test/api/orders/order"), "order"); expect(response.status).toBe(200); expect(JSON.stringify(await response.json())).not.toContain(secret);
  });
});

describe("Pemenuhan ambil sendiri", () => {
  it("hanya dapat siap diambil setelah pembayaran terverifikasi dan tidak boleh dikirim", () => {
    const order = { ...record(), shippingMode: "PICKUP" };
    expect(() => assertFulfillment(order, { status: "READY_FOR_PICKUP", expectedStatus: "PROCESSING" }, true)).not.toThrow();
    expect(() => assertFulfillment(order, { status: "SHIPPED", expectedStatus: "PROCESSING" }, true)).toThrow();
    expect(() => assertFulfillment({ ...order, application: null }, { status: "READY_FOR_PICKUP", expectedStatus: "PROCESSING" }, true)).toThrow();
    expect(() => assertFulfillment(record(), { status: "READY_FOR_PICKUP", expectedStatus: "PROCESSING" }, true)).toThrow();
  });
  it("selesai hanya sesudah siap diambil dan admin mengonfirmasi penyerahan", () => {
    const order = { ...record(), shippingMode: "PICKUP", status: "READY_FOR_PICKUP" };
    expect(() => assertFulfillment(order, { status: "COMPLETED", expectedStatus: "READY_FOR_PICKUP" }, true)).toThrow();
    expect(() => assertFulfillment(order, { status: "COMPLETED", expectedStatus: "READY_FOR_PICKUP", receiptConfirmed: true, note: "Diserahkan ke pembeli." }, true)).not.toThrow();
  });
});
