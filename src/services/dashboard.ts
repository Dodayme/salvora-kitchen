import { Prisma, type PrismaClient } from "../generated/prisma/client";
import { requireRole, type Principal } from "../lib/auth/access";
import { pageMeta } from "../lib/api/input";
import { LOW_STOCK_THRESHOLD } from "../lib/catalog/validation";
import { orderStatuses } from "../lib/contracts/status";
import { orderSummary } from "../lib/orders/view";
import { dashboardQuerySchema, emptyQuerySchema, voucherQuerySchema } from "../lib/dashboard/validation";

const LIST_LIMIT = 10;
type StockRow = { id: string; name: string; isActive: boolean; isDemo: boolean; physicalStock: number; reservedStock: number; availableStock: number };
const voucherSelect = {
  id: true, type: true, percentage: true, maxDiscount: true, status: true, createdAt: true, usedAt: true, reservedOrderId: true, usedOrderId: true,
  user: { select: { id: true, name: true } }, reservedOrder: { select: { id: true, number: true } }, usedOrder: { select: { id: true, number: true } },
} satisfies Prisma.DiscountSelect;

export function createDashboardService(db: PrismaClient) {
  return {
    async dashboard(principal: Principal | null, input: unknown) {
      requireRole(principal, "ADMIN");
      const q = dashboardQuerySchema.parse(input);
      const where = { createdAt: { gte: new Date(q.from), lt: new Date(q.to) } };
      return db.$transaction(async tx => {
        const activeProductCount = await tx.product.count({ where: { isActive: true } });
        const groups = await tx.order.groupBy({ by: ["status"], where, _count: { _all: true } });
        const ordersByStatus = orderStatuses.map(status => ({ status, count: groups.find(group => group.status === status)?._count._all ?? 0 }));
        const latest = await tx.order.findMany({ where, take: LIST_LIMIT, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: {
          id: true, number: true, createdAt: true, status: true, total: true, currency: true, paymentDeadline: true,
          items: { orderBy: { id: "asc" }, select: { name: true, quantity: true } },
          payments: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { status: true, channel: true } },
        } });
        // Inventory is current, global, and includes inactive products for admin operations.
        const [counts] = await tx.$queryRaw<Array<{ low: number; out: number }>>(Prisma.sql`SELECT count(*) FILTER (WHERE "physicalStock"-"reservedStock" BETWEEN 1 AND ${LOW_STOCK_THRESHOLD})::int AS low, count(*) FILTER (WHERE "physicalStock"-"reservedStock"=0)::int AS out FROM "Product"`);
        const stock = (predicate: Prisma.Sql) => tx.$queryRaw<StockRow[]>(Prisma.sql`SELECT id,name,"isActive","isDemo","physicalStock","reservedStock",("physicalStock"-"reservedStock")::int AS "availableStock" FROM "Product" WHERE ${predicate} ORDER BY "physicalStock"-"reservedStock" ASC,name ASC,id ASC LIMIT ${LIST_LIMIT}`);
        const lowStockProducts = await stock(Prisma.sql`"physicalStock"-"reservedStock" BETWEEN 1 AND ${LOW_STOCK_THRESHOLD}`);
        const outOfStockProducts = await stock(Prisma.sql`"physicalStock"-"reservedStock"=0`);
        return {
          period: { from: new Date(q.from).toISOString(), to: new Date(q.to).toISOString() }, activeProductCount,
          orderCount: ordersByStatus.reduce((sum, group) => sum + group.count, 0), ordersByStatus, latestOrders: latest.map(orderSummary),
          inventoryScope: "CURRENT_ALL_PRODUCTS" as const, lowStockThreshold: LOW_STOCK_THRESHOLD, listLimit: LIST_LIMIT,
          lowStockCount: counts.low, outOfStockCount: counts.out, lowStockProducts, outOfStockProducts,
        };
      }, { isolationLevel: "RepeatableRead" });
    },
    async vouchers(principal: Principal | null, input: unknown) {
      requireRole(principal, "ADMIN"); const q = voucherQuerySchema.parse(input);
      const where = { ...(q.status ? { status: q.status } : {}) };
      return db.$transaction(async tx => {
        const total = await tx.discount.count({ where });
        const rows = await tx.discount.findMany({ where, select: voucherSelect, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (q.page - 1) * q.pageSize, take: q.pageSize });
        return { data: rows.map(row => ({
          id: row.id, type: row.type, percentage: row.percentage, maxDiscount: row.maxDiscount, status: row.status,
          createdAt: row.createdAt.toISOString(), usedAt: row.usedAt?.toISOString() ?? null, reservedOrderId: row.reservedOrderId, usedOrderId: row.usedOrderId,
          owner: { id: row.user.id, name: row.user.name }, reservedOrder: row.reservedOrder ? { id: row.reservedOrder.id, number: row.reservedOrder.number } : null,
          usedOrder: row.usedOrder ? { id: row.usedOrder.id, number: row.usedOrder.number } : null, orderNumber: row.usedOrder?.number ?? row.reservedOrder?.number ?? null,
        })), pagination: pageMeta(q.page, q.pageSize, total) };
      }, { isolationLevel: "RepeatableRead" });
    },
    async policy(principal: Principal | null, input: unknown) {
      requireRole(principal, "ADMIN"); emptyQuerySchema.parse(input);
      return { type: "NEW_BUYER" as const, percentage: 20, maxDiscount: 100000, oncePerAccount: true };
    },
  };
}
