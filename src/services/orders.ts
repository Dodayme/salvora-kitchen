import { Prisma, type PrismaClient } from "../generated/prisma/client";
import { ApiError } from "../lib/api/errors";
import { pageMeta } from "../lib/api/input";
import { requirePrincipal, requireRole, type Principal } from "../lib/auth/access";
import { idSchema } from "../lib/catalog/validation";
import { adminOrderQuerySchema, adminPaymentQuerySchema, buyerOrderQuerySchema, fulfillmentSchema, orderNoteSchema } from "../lib/orders/validation";
import { orderDetail, orderDetailInclude, orderSummary, paymentView } from "../lib/orders/view";
import { assertFulfillment } from "../lib/orders/fulfillment";

const missing = () => new ApiError(404, "NOT_FOUND", "Data tidak ditemukan.");
async function clock(tx: Prisma.TransactionClient) { return (await tx.$queryRaw<Array<{ time: Date }>>`SELECT clock_timestamp() AS time`)[0].time; }
const range = (q: { from?: string; to?: string }) => ({ ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lt: new Date(q.to) } : {}) });
const summaryInclude = { items: { orderBy: { id: "asc" }, select: { name: true, quantity: true } }, payments: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { status: true, channel: true } }, user: { select: { id: true, name: true } } } satisfies Prisma.OrderInclude;
async function detail(tx: Prisma.TransactionClient, id: string, user: Principal) {
  const order = await tx.order.findFirst({ where: { id, ...(user.role === "ADMIN" ? {} : { userId: user.id }) }, include: orderDetailInclude });
  if (!order) throw missing();
  return orderDetail(order, await clock(tx), user.role === "ADMIN");
}
async function retry<T>(action: () => Promise<T>) {
  for (let attempt = 0; ; attempt++) try { return await action(); } catch (error) {
    const again = error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2034" || error.code === "P2010" && ["40P01", "40001"].includes(String(error.meta?.code)));
    if (!again) throw error;
    if (attempt >= 2) throw new ApiError(503, "ORDER_BUSY", "Pesanan sedang diperbarui. Muat ulang sebelum mencoba lagi.", undefined, 1);
  }
}
export function createOrderService(db: PrismaClient, settings = { completionEnabled: true }) {
  return {
    async buyerOrders(principal: Principal | null, input: unknown) {
      const user = requireRole(principal, "BUYER"), q = buyerOrderQuerySchema.parse(input);
      const where: Prisma.OrderWhereInput = { userId: user.id, ...(q.status ? { status: q.status } : {}) };
      return db.$transaction(async tx => {
        const total = await tx.order.count({ where });
        const rows = await tx.order.findMany({ where, include: summaryInclude, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (q.page - 1) * q.pageSize, take: q.pageSize });
        return { data: rows.map(orderSummary), pagination: pageMeta(q.page, q.pageSize, total) };
      }, { isolationLevel: "RepeatableRead" });
    },
    async detail(principal: Principal | null, id: string) {
      const user = requirePrincipal(principal); idSchema.parse(id);
      return db.$transaction(tx => detail(tx, id, user), { isolationLevel: "RepeatableRead" });
    },
    async adminOrders(principal: Principal | null, input: unknown) {
      requireRole(principal, "ADMIN"); const q = adminOrderQuerySchema.parse(input);
      const where: Prisma.OrderWhereInput = { ...(q.q ? { number: { contains: q.q, mode: "insensitive" } } : {}), ...(q.status ? { status: q.status } : {}), createdAt: range(q), ...(q.paymentStatus || q.channel ? { payments: { some: { ...(q.paymentStatus ? { status: q.paymentStatus } : {}), ...(q.channel ? { channel: q.channel } : {}) } } } : {}) };
      return db.$transaction(async tx => {
        const total = await tx.order.count({ where });
        const rows = await tx.order.findMany({ where, include: summaryInclude, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (q.page - 1) * q.pageSize, take: q.pageSize });
        return { data: rows.map(order => ({ ...orderSummary(order), buyer: { id: order.user.id, name: order.user.name } })), pagination: pageMeta(q.page, q.pageSize, total) };
      }, { isolationLevel: "RepeatableRead" });
    },
    async adminPayments(principal: Principal | null, input: unknown) {
      requireRole(principal, "ADMIN"); const q = adminPaymentQuerySchema.parse(input);
      const where: Prisma.PaymentWhereInput = { ...(q.status ? { status: q.status } : {}), ...(q.orderId ? { orderId: q.orderId } : {}), ...(q.channel ? { channel: q.channel } : {}), createdAt: range(q) };
      return db.$transaction(async tx => {
        const total = await tx.payment.count({ where });
        const rows = await tx.payment.findMany({ where, include: { order: { select: { number: true } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (q.page - 1) * q.pageSize, take: q.pageSize });
        return { data: rows.map(p => ({ ...paymentView(p), orderId: p.orderId, orderNumber: p.order.number })), pagination: pageMeta(q.page, q.pageSize, total) };
      }, { isolationLevel: "RepeatableRead" });
    },
    async fulfill(principal: Principal | null, id: string, input: unknown) {
      const user = requireRole(principal, "ADMIN"); idSchema.parse(id); const value = fulfillmentSchema.parse(input);
      const identity = await db.order.findUnique({ where: { id }, select: { userId: true } }); if (!identity) throw missing();
      return retry(() => db.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM "User" WHERE id=${identity.userId} FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM "Order" WHERE id=${id} FOR UPDATE`;
        const order = await tx.order.findUniqueOrThrow({ where: { id }, include: { application: { include: { payment: true } }, payments: { select: { id: true, status: true } }, items: { include: { reservation: true } } } });
        assertFulfillment(order, value, settings.completionEnabled);
        const updated = await tx.order.updateMany({ where: { id, status: value.expectedStatus }, data: { status: value.status } });
        if (updated.count !== 1) throw new ApiError(409, "ORDER_STATUS_CONFLICT", "Status pesanan sudah berubah.");
        await tx.orderStatusHistory.create({ data: { orderId: id, fromStatus: order.status, toStatus: value.status, actor: "ADMIN", actorUserId: user.id, changedAt: await clock(tx), note: value.status === "COMPLETED" ? `Penerimaan dikonfirmasi admin. ${value.note}` : value.note ?? (value.status === "READY_FOR_PICKUP" ? "Pesanan siap diambil di toko." : "Admin mencatat pesanan dikirim melalui delivery manual.") } });
        return detail(tx, id, user);
      }, { timeout: 15000 }));
    },
    async addNote(principal: Principal | null, id: string, input: unknown) {
      const user = requireRole(principal, "ADMIN"); idSchema.parse(id); const { note } = orderNoteSchema.parse(input);
      const identity = await db.order.findUnique({ where: { id }, select: { userId: true } }); if (!identity) throw missing();
      return retry(() => db.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM "User" WHERE id=${identity.userId} FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM "Order" WHERE id=${id} FOR UPDATE`;
        const order = await tx.order.findUniqueOrThrow({ where: { id }, select: { status: true } });
        await tx.orderStatusHistory.create({ data: { orderId: id, fromStatus: order.status, toStatus: order.status, actor: "ADMIN", actorUserId: user.id, changedAt: await clock(tx), note } });
        return detail(tx, id, user);
      }, { timeout: 15000 }));
    },
  };
}
