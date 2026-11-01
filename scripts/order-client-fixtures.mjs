/** FE-07 read/review fixtures. COMPLETED rows are synthetic; not a fulfillment/payment proof. */
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import { decodeBuyerOrder, decodeOrderSummaries } from "../src/lib/order-client/model.ts";
import { createReviewController } from "../src/lib/order-client/review-controller.ts";
export async function verifyOrderClient({ db, run, first, second, productId, extraProductId, categoryId, adminEmail, password }) {
  const admin = await db.user.create({ data: { email: adminEmail, name: "FE07 Admin Fixture", passwordHash: await hash(password, 12), role: "ADMIN" } });
  await db.product.create({ data: { id: extraProductId, categoryId, name: "FE07 extra product", description: "New isolated test fixture", price: 5000, physicalStock: 10, isDemo: true } });
  const ids = Array.from({ length: 6 }, (_, i) => `fe07-${run}-order-${i}`);
  const statuses = ["COMPLETED", "COMPLETED", "SHIPPED", "SHIPPED", "PROCESSING", "NEEDS_ATTENTION"];
  for (let i = 0; i < ids.length; i++) await db.order.create({ data: {
    id: ids[i], number: `F7-${run}-${i}`, userId: first.user.id, idempotencyKey: randomUUID(), inputHash: randomBytes(32).toString("hex"),
    recipientName: "Snapshot recipient", phone: "0800000000", addressLine: "Immutable fixture snapshot", city: "Tanjungpinang", province: "Kepulauan Riau", subtotal: 15000, discount: 0, shippingFee: 10000, total: 25000, shippingLabel: "Manual delivery fixture", status: statuses[i], paymentDeadline: new Date(Date.now() + 3600000),
    items: { create: [{ productId, name: "Historical risol name", unitPrice: 10000, quantity: 1, lineSubtotal: 10000 }, { productId: extraProductId, name: "Historical extra name", unitPrice: 5000, quantity: 1, lineSubtotal: 5000 }] },
    history: { create: [{ actor: "SYSTEM", fromStatus: null, toStatus: statuses[i], note: "Synthetic fixture, not payment proof" }, { actor: "ADMIN", actorUserId: admin.id, fromStatus: statuses[i], toStatus: statuses[i], note: "PRIVATE-ADMIN-FIXTURE-NOTE" }] },
  } });
  const page1 = await first.request("/api/orders?page=1&pageSize=5", { decode: decodeOrderSummaries }), page2 = await first.request("/api/orders?page=2&pageSize=5", { decode: decodeOrderSummaries });
  assert.equal(page1.data.length, 5); assert.equal(page2.data.length, 2); assert.equal(page1.meta.pagination.total, 7); assert.ok(page1.data.every(row => !page2.data.some(other => other.id === row.id)));
  const completed = await first.request("/api/orders?status=COMPLETED&page=1&pageSize=5", { decode: decodeOrderSummaries }); assert.equal(completed.meta.pagination.total, 2); assert.ok(completed.data.every(row => row.status === "COMPLETED"));
  assert.equal((await first.request("/api/orders?page=999&pageSize=5", { decode: decodeOrderSummaries })).data.length, 0);
  assert.equal((await first.request("/api/orders?status=EXPIRED&page=1&pageSize=5", { decode: decodeOrderSummaries })).data.length, 0);
  const detail = (await first.request(`/api/orders/${ids[0]}`, { decode: decodeBuyerOrder })).data; assert.equal(detail.items.length, 2); assert.ok(detail.items.every(item => item.canReview && !item.reviewId));
  assert.equal(detail.total, 25000); assert.equal(detail.items.find(item => item.productId === productId).unitPrice, 10000);
  const raw = (await first.request(`/api/orders/${ids[0]}`)).data; assert.ok(!JSON.stringify(raw).includes("PRIVATE-ADMIN")); assert.ok(!JSON.stringify(raw).includes("actorUser")); assert.equal(detail.history.length, 1);
  await db.address.update({ where: { id: first.address.id }, data: { addressLine: "Edited live address fixture" } });
  assert.equal((await first.request(`/api/orders/${ids[0]}`, { decode: decodeBuyerOrder })).data.address.addressLine, "Immutable fixture snapshot");
  let foreign = false; try { await second.request(`/api/orders/${ids[0]}`, { decode: decodeBuyerOrder }); } catch (error) { foreign = error.status === 404; } assert.ok(foreign);
  const inventory = () => db.product.findMany({ where: { id: { in: [productId, extraProductId] } }, orderBy: { id: "asc" }, select: { id: true, physicalStock: true, reservedStock: true } });
  const orders = () => db.order.findMany({ where: { userId: first.user.id }, orderBy: { id: "asc" } });
  const inventoryBefore = await inventory(), ordersBefore = await orders();
  const item = detail.items.find(item => item.productId === productId); let refreshed = 0;
  const create = target => createReviewController({ itemId: target.id, productId: target.productId, request: first.request, authorized: () => true, eligible: () => true, saved: () => { refreshed++; } });
  const lost = create(item); first.loseReview(); await Promise.all([lost.submit("5", "  <script>fixture text, not HTML</script>  "), lost.submit("5", "Must not replay this comment")]);
  assert.equal(lost.getSnapshot().phase, "needsReload"); assert.equal(first.reviewCalls.length, 1); assert.equal(await db.rating.count({ where: { orderItemId: item.id } }), 1);
  await lost.submit("4", "No automatic retry or replay"); assert.equal(first.reviewCalls.length, 1);
  const latest = (await first.request(`/api/orders/${ids[0]}`, { decode: decodeBuyerOrder })).data;
  assert.equal(latest.items.find(row => row.id === item.id).canReview, false); assert.ok(latest.items.find(row => row.id === item.id).reviewId); assert.equal(latest.items.find(row => row.productId === extraProductId).canReview, true);
  const duplicate = create(item); await duplicate.submit("4", "Duplicate fixture review"); assert.equal(duplicate.getSnapshot().error.code, "REVIEW_EXISTS"); assert.equal(duplicate.getSnapshot().phase, "needsReload");
  const another = (await first.request(`/api/orders/${ids[1]}`, { decode: decodeBuyerOrder })).data.items.find(row => row.productId === productId);
  const success = create(another); await success.submit("3", "Repeat purchase fixture review"); assert.equal(success.getSnapshot().phase, "saved"); assert.equal(refreshed, 1);
  const pending = (await first.request(`/api/orders/${ids[2]}`, { decode: decodeBuyerOrder })).data.items.find(row => row.productId === productId);
  const notCompleted = create(pending); await notCompleted.submit("4", "Pending order cannot review"); assert.equal(notCompleted.getSnapshot().error.code, "ORDER_NOT_COMPLETED"); assert.equal(notCompleted.getSnapshot().phase, "needsReload");
  foreign = false; try { await second.request(`/api/order-items/${item.id}/review`, { method: "POST", json: { rating: 5, comment: "Foreign owner is rejected" } }); } catch (error) { foreign = error.status === 404; } assert.ok(foreign);
  const reviews = await first.request(`/api/products/${productId}/reviews?page=1&pageSize=1`);
  assert.equal(reviews.data.length, 1); assert.equal(reviews.meta.pagination.total, 2); assert.equal(reviews.meta.ratingSummary.averageRating, 4); assert.equal(reviews.meta.ratingSummary.reviewCount, 2); assert.deepEqual(Object.keys(reviews.data[0].author), ["displayName"]); assert.ok(!("orderItemId" in reviews.data[0]));
  const literal = await db.rating.findUniqueOrThrow({ where: { orderItemId: item.id } }); assert.equal(literal.comment, "<script>fixture text, not HTML</script>");
  const unicodeItem = latest.items.find(row => row.productId === extraProductId);
  for (const length of [9, 1001]) { let invalid = false; try { await first.request(`/api/order-items/${unicodeItem.id}/review`, { method: "POST", json: { rating: 5, comment: "😀".repeat(length) } }); } catch (error) { invalid = error.status === 422; } assert.ok(invalid); }
  assert.equal(await db.rating.count({ where: { orderItemId: unicodeItem.id } }), 0);
  const unicode = await first.request(`/api/order-items/${unicodeItem.id}/review`, { method: "POST", json: { rating: 5, comment: "😀".repeat(1000) } }); assert.equal(Array.from(unicode.data.comment).length, 1000);
  assert.deepEqual(await inventory(), inventoryBefore); assert.deepEqual(await orders(), ordersBefore);
  await first.request("/api/auth/login", { method: "POST", json: { email: adminEmail, password } });
  let forbidden = false; try { await first.request("/api/orders?page=1&pageSize=5", { decode: decodeOrderSummaries }); } catch (error) { forbidden = error.status === 403; } assert.ok(forbidden);
  return "buyer list 5+2/filter/empty, multi-item snapshot/private history/foreign 404/admin 403, review response lost without replay/duplicate 409/not-completed 409/repeat purchase 201, aggregate 4 from 2 reviews, Unicode comment 9/1001 rejected and 1000 accepted; synthetic completed fixtures only";
}
