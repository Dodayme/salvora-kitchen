import { z } from "zod";
const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const policy = { type: z.literal("NEW_BUYER"), percentage: z.literal(20), maxDiscount: z.literal(100000) };
export const voucherStates = ["AVAILABLE", "RESERVED", "USED"] as const;
export type VoucherState = typeof voucherStates[number];
export const voucherStateLabels: Record<VoucherState, string> = { AVAILABLE: "Tersedia", RESERVED: "Direservasi", USED: "Terpakai" };
export const decodeVoucherPolicy = (value: unknown) => z.object({ ...policy, oncePerAccount: z.literal(true) }).parse(value);
const order = z.object({ id, number: z.string().min(1).max(150) }).nullable();
const voucher = z.object({ ...policy, id, status: z.enum(voucherStates), createdAt: z.iso.datetime(), usedAt: z.iso.datetime().nullable(), reservedOrderId: id.nullable(), usedOrderId: id.nullable(), owner: z.object({ name: z.string().min(1).max(100) }), reservedOrder: order, usedOrder: order, orderNumber: z.string().nullable() }).superRefine((row, ctx) => {
  if (row.reservedOrderId !== (row.reservedOrder?.id ?? null) || row.usedOrderId !== (row.usedOrder?.id ?? null) || row.orderNumber !== (row.usedOrder?.number ?? row.reservedOrder?.number ?? null) || row.status === "AVAILABLE" && (row.reservedOrderId !== null || row.usedOrderId !== null || row.usedAt !== null) || row.status === "RESERVED" && (!row.reservedOrder || row.usedOrder !== null || row.usedAt !== null) || row.status === "USED" && (!row.usedOrder || row.reservedOrder !== null || row.usedAt === null)) ctx.addIssue({ code: "custom", message: "Invalid voucher relations" });
});
export const decodeAdminVouchers = (value: unknown) => z.array(voucher).parse(value);
export function adminVoucherPath(page: number, status: VoucherState | "" = "") {
  if (!Number.isInteger(page) || page < 1 || page > 100000 || status && !voucherStates.includes(status)) return null;
  const query = new URLSearchParams({ page: String(page), pageSize: "10" }); if (status) query.set("status", status); return `/api/admin/vouchers?${query}`;
}
const admin = z.object({ id, name: z.string().min(2).max(100), email: z.email().max(254), role: z.literal("ADMIN") });
export function decodeAdminMe(value: unknown, expectedId?: string) { const result = admin.parse(value); if (expectedId && result.id !== expectedId) throw Error("Unexpected account"); return result; }
export type AdminMe = ReturnType<typeof decodeAdminMe>;
export const adminNamePayload = (name: string) => z.object({ name: z.string().trim().min(2).max(100) }).safeParse({ name });
