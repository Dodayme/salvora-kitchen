import { randomUUID } from "node:crypto";
import { afterAll, expect, it } from "vitest";
import { createDatabaseClient } from "../../src/lib/db/client";
import { priceBuyerCart } from "../../src/services/pricing";
const db = createDatabaseClient();
afterAll(() => db.$disconnect());
it("applies recurring targeted events, expiration, deactivation and best-discount selection", async () => {
 const rollback = new Error("rollback fixture");
 try { await db.$transaction(async tx => {
   const user = await tx.user.create({ data: { name: "Promo fixture", email: `${randomUUID()}@example.test`, passwordHash: "not-a-login" } });
   const principal = { id: user.id, role: "BUYER" as const };
   const category = await tx.category.create({ data: { name: randomUUID() } });
   const product = await tx.product.create({ data: { name: "Fixture", description: "test", categoryId: category.id, price: 10000, physicalStock: 5 } });
   await tx.cart.create({ data: { userId: user.id, items: { create: { productId: product.id, quantity: 1 } } } });
   await tx.discount.create({ data: { userId: user.id } });
   const promo = await tx.eventPromotion.create({ data: { name: "Event", percentage: 30, maxDiscount: 5000, recipientIds: [user.id], startsAt: new Date(Date.now()-60000), endsAt: new Date(Date.now()+60000) } });
   for (let i=0;i<2;i++) expect(await priceBuyerCart(tx, principal, 1000)).toMatchObject({ discount: 3000, total: 8000, voucher: null, eventPromotion: { id: promo.id } });
   expect(await tx.discount.findUnique({ where: { userId: user.id } })).toMatchObject({ status: "AVAILABLE" });
   await tx.eventPromotion.update({ where: { id: promo.id }, data: { recipientIds: ["someone-else"] } });
   expect((await priceBuyerCart(tx, principal, 0)).discount).toBe(2000);
   await tx.eventPromotion.update({ where: { id: promo.id }, data: { recipientIds: [] } });
   expect((await priceBuyerCart(tx, principal, 0)).discount).toBe(3000);
   await tx.eventPromotion.update({ where: { id: promo.id }, data: { isActive: false } });
   expect((await priceBuyerCart(tx, principal, 0)).discount).toBe(2000);
   await tx.eventPromotion.update({ where: { id: promo.id }, data: { isActive: true, endsAt: new Date(Date.now()-1000) } });
   expect((await priceBuyerCart(tx, principal, 0)).discount).toBe(2000);
   throw rollback;
 }, { timeout: 15000 }); } catch (error) { if (error !== rollback) throw error; }
});
