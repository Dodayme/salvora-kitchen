/** Synthetic period/inventory fixtures only; never payment or fulfillment proof. */
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import { dashboardPath, dashboardRange, decodeDashboard } from "../src/lib/admin-client/dashboard-model.ts";
import { createDashboardController } from "../src/lib/admin-client/dashboard-controller.ts";
export async function verifyDashboardClient({ db, run, first, second, productId, categoryId, adminEmail, password, stockIds, origin }) {
  const range = dashboardRange("2094-04-15", "2094-04-15");
  assert.equal(await db.order.count({ where: { createdAt: { gte: new Date(range.from), lt: new Date(range.to) } } }), 0, "Choose a clean fixture period; never alter existing orders");
  const admin = await db.user.create({ data: { email: adminEmail, name: "FE08 Admin Fixture", passwordHash: await hash(password, 12), role: "ADMIN" } });
  await first.request("/api/auth/login", { method: "POST", json: { email: adminEmail, password } });
  const times = [Date.parse(range.from), Date.parse(range.from) + 1, Date.parse(range.to) - 1, Date.parse(range.to), Date.parse(range.from) - 1];
  const statuses = ["AWAITING_PAYMENT", "COMPLETED", "NEEDS_ATTENTION", "PROCESSING", "SHIPPED"];
  for (let i = 0; i < times.length; i++) await db.order.create({ data: { id: `fe08-${run}-order-${i}`, number: `F8-${run}-${i}`, userId: first.user.id, idempotencyKey: randomUUID(), inputHash: randomBytes(32).toString("hex"), recipientName: "Synthetic fixture", phone: "0800000000", addressLine: "Test snapshot", city: "Tanjungpinang", province: "Kepulauan Riau", subtotal: 10000, discount: 0, shippingFee: 10000, total: 20000, shippingLabel: "Manual delivery fixture", status: statuses[i], createdAt: new Date(times[i]), paymentDeadline: new Date(times[i] + 3600000), items: { create: { productId, name: "Snapshot product fixture", unitPrice: 10000, quantity: 1, lineSubtotal: 10000 } } } });
  // Global active count must include products whose parent category is inactive.
  await db.category.update({ where: { id: categoryId }, data: { isActive: false } });
  for (let i = 0; i < 16; i++) {
    const id = `fe08-${run}-stock-${i}`; stockIds.push(id);
    await db.product.create({ data: { id, categoryId, name: `000 FE08 fixture ${String(i).padStart(2, "0")}`, description: "Synthetic inventory fixture", price: 1000, isActive: i % 3 !== 0, isDemo: true, physicalStock: i < 13 ? 10 : i === 13 ? 8 : i === 14 ? 4 : 0, reservedStock: i < 13 ? 9 : i === 13 ? 3 : i === 14 ? 4 : 0 } });
  }
  const [expected] = await db.$queryRaw`SELECT count(*) FILTER(WHERE "isActive")::int AS active, count(*) FILTER(WHERE "physicalStock"-"reservedStock" BETWEEN 1 AND 5)::int AS low, count(*) FILTER(WHERE "physicalStock"-"reservedStock"=0)::int AS out FROM "Product"`;
  const rows = await db.$queryRaw`SELECT id,name,"isActive","isDemo","physicalStock","reservedStock",("physicalStock"-"reservedStock")::int AS "availableStock" FROM "Product" WHERE "physicalStock"-"reservedStock" BETWEEN 1 AND 5 ORDER BY "physicalStock"-"reservedStock",name,id LIMIT 10`;
  const inventoryBefore = await db.product.findMany({ where: { id: { in: [productId, ...stockIds] } }, orderBy: { id: "asc" } });
  const ordersBefore = await db.order.findMany({ where: { userId: first.user.id }, orderBy: { id: "asc" } });
  const controller = createDashboardController({ request: first.request, authorized: () => true });
  await controller.apply(range.fromDate, range.toDate); const result = controller.getSnapshot(); assert.equal(result.phase, "ready");
  const report = result.report; assert.equal(report.orderCount, 3); assert.equal(report.ordersByStatus.reduce((sum, item) => sum + item.count, 0), 3); assert.equal(report.ordersByStatus.length, 6);
  for (const status of ["AWAITING_PAYMENT", "COMPLETED", "NEEDS_ATTENTION"]) assert.equal(report.ordersByStatus.find(row => row.status === status).count, 1);
  for (const status of ["PROCESSING", "SHIPPED", "EXPIRED"]) assert.equal(report.ordersByStatus.find(row => row.status === status).count, 0);
  assert.equal(report.latestOrders.length, 3); assert.ok(report.latestOrders.some(row => Date.parse(row.createdAt) === Date.parse(range.from))); assert.ok(report.latestOrders.every(row => Date.parse(row.createdAt) < Date.parse(range.to)));
  assert.equal(report.activeProductCount, expected.active); assert.equal(report.lowStockCount, expected.low); assert.equal(report.outOfStockCount, expected.out); assert.ok(report.lowStockCount > 10); assert.deepEqual(report.lowStockProducts, rows); assert.equal(report.lowStockProducts.length, 10); assert.ok(report.lowStockProducts.some(row => !row.isActive));
  await controller.apply("2095-01-01", "2095-01-01"); const empty = controller.getSnapshot().report; assert.equal(empty.orderCount, 0); assert.equal(empty.latestOrders.length, 0); assert.ok(empty.ordersByStatus.every(row => row.count === 0)); assert.equal(empty.activeProductCount, report.activeProductCount); assert.equal(empty.lowStockCount, report.lowStockCount); assert.deepEqual(empty.lowStockProducts, report.lowStockProducts);
  assert.deepEqual(await db.product.findMany({ where: { id: { in: [productId, ...stockIds] } }, orderBy: { id: "asc" } }), inventoryBefore);
  assert.deepEqual(await db.order.findMany({ where: { userId: first.user.id }, orderBy: { id: "asc" } }), ordersBefore);
  assert.equal((await first.request(dashboardPath(range), { decode: decodeDashboard })).data.inventoryScope, "CURRENT_ALL_PRODUCTS");
  const anonymous = await fetch(origin + dashboardPath(range)); assert.equal(anonymous.status, 401);
  let forbidden = false; try { await second.request(dashboardPath(range)); } catch (error) { forbidden = error.status === 403; } assert.ok(forbidden);
  await db.session.deleteMany({ where: { userId: admin.id } }); await controller.refresh(); assert.equal(controller.getSnapshot().phase, "error"); assert.equal(controller.getSnapshot().report, undefined); assert.equal(controller.getSnapshot().error.status, 401); controller.dispose();
  return { range, case: "admin controller/HTTP: WIB from included/to excluded, three orders and all statuses, empty period preserves global inventory, 10-row snippet/full counts with reserved/inactive/zero stock, 401/403/revoked session; GET leaves fixture orders/products unchanged" };
}
