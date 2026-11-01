import { describe, expect, it, vi } from "vitest";
import { adminNamePayload, adminVoucherPath, decodeAdminMe, decodeAdminVouchers, decodeVoucherPolicy } from "../src/lib/admin-client/account-model";
import { decodeSession } from "../src/lib/auth-client/model";
import { createSessionStore } from "../src/lib/auth-client/session-store";
import { createAdminAction } from "../src/lib/admin-client/action-controller";
import { ApiClientError, type apiRequest } from "../src/lib/http/client";
const stamp = "2026-10-25T01:00:00.000Z", profile = { id: "admin", name: "Admin fixture", email: "admin@example.test", role: "ADMIN" };
const raw = { id: "v", type: "NEW_BUYER", percentage: 20, maxDiscount: 100000, status: "AVAILABLE", createdAt: stamp, usedAt: null, reservedOrderId: null, usedOrderId: null, owner: { id: "buyer", name: "Buyer fixture", email: "private" }, reservedOrder: null, usedOrder: null, orderNumber: null };
describe("fixed admin voucher reads", () => {
  it("decodes exact policy and strips unknown fields", () => { expect(decodeVoucherPolicy({ type: "NEW_BUYER", percentage: 20, maxDiscount: 100000, oncePerAccount: true, minimum: 1 })).not.toHaveProperty("minimum"); });
  it.each([{ percentage: 10 }, { maxDiscount: 200000 }, { type: "GENERAL" }, { oncePerAccount: false }])("rejects policy changes instead of inventing controls %#", patch => expect(() => decodeVoucherPolicy({ type: "NEW_BUYER", percentage: 20, maxDiscount: 100000, oncePerAccount: true, ...patch })).toThrow());
  it("keeps only buyer name and validates order relationships for all states", () => {
    const values = [raw, { ...raw, id: "r", status: "RESERVED", reservedOrderId: "o1", reservedOrder: { id: "o1", number: "N1" }, orderNumber: "N1" }, { ...raw, id: "u", status: "USED", usedAt: stamp, usedOrderId: "o2", usedOrder: { id: "o2", number: "N2" }, orderNumber: "N2" }];
    const result = decodeAdminVouchers(values); expect(result).toHaveLength(3); expect(result[0].owner).toEqual({ name: "Buyer fixture" }); expect(result[2].usedOrder?.id).toBe("o2");
  });
  it.each([{ status: "ACTIVE" }, { status: "USED" }, { reservedOrderId: "foreign" }, { orderNumber: "invented" }, { percentage: 10 }, { status: "RESERVED", reservedOrderId: "o", reservedOrder: { id: "foreign", number: "N" }, orderNumber: "N" }])("rejects inconsistent voucher DTO %#", patch => expect(() => decodeAdminVouchers([{ ...raw, ...patch }])).toThrow());
  it("encodes only pagination/status with no mutation fields", () => { expect(adminVoucherPath(2, "USED")).toBe("/api/admin/vouchers?page=2&pageSize=10&status=USED"); expect(adminVoucherPath(1)).toBe("/api/admin/vouchers?page=1&pageSize=10"); expect(adminVoucherPath(0)).toBeNull(); expect(adminVoucherPath(100001)).toBeNull(); expect(adminVoucherPath(1, "ACTIVE" as never)).toBeNull(); });
});
describe("own admin profile", () => {
  it("sends name only, trimmed, without identity/role/email fields", () => expect(adminNamePayload(" New name ").data).toEqual({ name: "New name" }));
  it.each(["", "  ", "a", "x".repeat(101)])("rejects invalid name %#", name => expect(adminNamePayload(name).success).toBe(false));
  it("matches server code point lengths for names and session revalidation", () => { const name = "😀".repeat(100); expect(adminNamePayload(name).success).toBe(true); expect(decodeAdminMe({ ...profile, name }).name).toBe(name); expect(decodeSession({ user: { ...profile, name } }).user?.name).toBe(name); expect(adminNamePayload("😀".repeat(101)).success).toBe(false); expect(() => decodeSession({ user: { ...profile, name: "😀".repeat(101) } })).toThrow(); });
  it("strips secrets and rejects foreign/BUYER profile", () => { expect(decodeAdminMe({ ...profile, passwordHash: "private" }, "admin")).toEqual(profile); expect(() => decodeAdminMe(profile, "foreign")).toThrow(); expect(() => decodeAdminMe({ ...profile, role: "BUYER" })).toThrow(); });
  it("refreshes confirmed session/header data after save without using draft as authority", async () => {
    let name = profile.name; const calls: string[] = [];
    const request = (async (path: string) => { calls.push(path); return { data: { user: { ...profile, name } }, meta: { requestId: "r" } }; }) as typeof apiRequest;
    const store = createSessionStore(request); await store.refresh(true); name = "Server confirmed name"; await store.refresh(true); expect(store.getSnapshot().user?.name).toBe(name); expect(calls).toEqual(["/api/auth/session", "/api/auth/session"]);
  });
  it("blocks replay after a saved PATCH loses its response", async () => {
    const operation = vi.fn(async () => { throw new ApiClientError(0, "NETWORK_ERROR", "", "network"); }); const controller = createAdminAction({ request: vi.fn() as unknown as typeof apiRequest, authorized: () => true });
    await controller.run(operation, vi.fn()); controller.reset(); await controller.run(operation, vi.fn()); expect(operation).toHaveBeenCalledOnce(); expect(controller.getSnapshot().phase).toBe("needsReload");
  });
});
