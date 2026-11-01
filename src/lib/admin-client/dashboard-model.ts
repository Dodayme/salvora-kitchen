import { z } from "zod";
import { decodeOrderSummaries } from "@/lib/order-client/model";
import { orderStatuses } from "@/lib/contracts/status";
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const stock = z.object({ id: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/), name: z.string().min(1).max(150), isActive: z.boolean(), isDemo: z.boolean(), physicalStock: count, reservedStock: count, availableStock: count }).refine(row => row.availableStock === row.physicalStock - row.reservedStock);
const dashboard = z.object({ period: z.object({ from: z.iso.datetime(), to: z.iso.datetime() }), activeProductCount: count, orderCount: count,
  ordersByStatus: z.array(z.object({ status: z.enum(orderStatuses), count })).length(orderStatuses.length), latestOrders: z.unknown().transform(decodeOrderSummaries),
  inventoryScope: z.literal("CURRENT_ALL_PRODUCTS"), lowStockThreshold: z.literal(5), listLimit: z.literal(10), lowStockCount: count, outOfStockCount: count, lowStockProducts: z.array(stock).max(10), outOfStockProducts: z.array(stock).max(10),
}).superRefine((value, context) => {
  const total = value.ordersByStatus.reduce((sum, row) => sum + row.count, 0), from = Date.parse(value.period.from), to = Date.parse(value.period.to);
  if (new Set(value.ordersByStatus.map(row => row.status)).size !== orderStatuses.length || !Number.isSafeInteger(total) || total !== value.orderCount || from >= to || value.latestOrders.length > Math.min(value.orderCount, 10) || value.latestOrders.some(row => Date.parse(row.createdAt) < from || Date.parse(row.createdAt) >= to) || value.lowStockProducts.length > value.lowStockCount || value.outOfStockProducts.length > value.outOfStockCount || value.lowStockProducts.some(row => row.availableStock < 1 || row.availableStock > 5) || value.outOfStockProducts.some(row => row.availableStock !== 0)) context.addIssue({ code: "custom", message: "Inconsistent dashboard snapshot" });
});
export type Dashboard = z.infer<typeof dashboard>;
export type StockSummary = z.infer<typeof stock>;
export const decodeDashboard = (value: unknown) => dashboard.parse(value);
export type DashboardRange = { fromDate: string; toDate: string; from: string; to: string };
const DAY = 86400000, WIB = 7 * 3600000;
function dayStart(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = Date.parse(`${value}T00:00:00+07:00`);
  return Number.isFinite(time) && new Date(time + WIB).toISOString().slice(0, 10) === value ? time : null;
}
/** UI dates are inclusive calendar days in WIB; server upper bound is exclusive UTC. */
export function dashboardRange(fromDate: string, toDate: string): DashboardRange | null {
  const from = dayStart(fromDate), to = dayStart(toDate);
  if (from === null || to === null || from > to) return null;
  return { fromDate, toDate, from: new Date(from).toISOString(), to: new Date(to + DAY).toISOString() };
}
export function todayWib(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", calendar: "gregory", numberingSystem: "latn", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (name: Intl.DateTimeFormatPartTypes) => parts.find(value => value.type === name)!.value;
  return `${part("year").padStart(4, "0")}-${part("month")}-${part("day")}`;
}
export const dashboardPath = (range: DashboardRange) => `/api/admin/dashboard?${new URLSearchParams({ from: range.from, to: range.to })}`;
