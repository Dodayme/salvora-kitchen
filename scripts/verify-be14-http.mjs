// Invoked by the guarded BE14 runner. Real loopback Next.js HTTP and TEST DB;
// payment provider is injected only into the local verification service.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { hash } from 'bcryptjs';
import { createDatabaseClient } from '../src/lib/db/client.ts';
import { databaseUrl } from '../src/lib/config/schema.ts';
import { createPaymentVerificationService } from '../src/services/payment-verification.ts';
import { rateLimitKey } from '../src/lib/auth/rate-limit.ts';

const url = databaseUrl(process.env, 'test'), target = new URL(url);
assert.equal(target.port, '55433'); assert.equal(target.pathname, '/salvora_kitchen_test');
assert.ok(['127.0.0.1', 'localhost'].includes(target.hostname));
const db = createDatabaseClient(), run = randomUUID(), secret = randomBytes(32).toString('hex');
const password = randomBytes(20).toString('base64url'), origin = 'https://be14-http.example.test';
const emails = ['buyer', 'other', 'admin'].map(role => `be14-http-${role}-${run}@example.test`);
const ownerIds = [], categoryIds = [], productIds = [], started = Date.now();
let child, passed = 0, phase = 'identity', success = false;
try {
  assert.deepEqual((await db.$queryRaw`SELECT current_database() AS name, inet_server_port() AS port`)[0], { name: 'salvora_kitchen_test', port: 55433 });
  const admin = await db.user.create({ data: { name: 'HTTP Fixture Admin', email: emails[2], passwordHash: await hash(password, 12), role: 'ADMIN' } }); ownerIds.push(admin.id);
  const category = await db.category.create({ data: { name: `BE14 HTTP ${run}` } }); categoryIds.push(category.id);
  const product = await db.product.create({ data: { categoryId: category.id, name: 'HTTP historical product', description: 'Fixture', price: 10000, physicalStock: 20, isDemo: true } }); productIds.push(product.id);
  const reservation = createServer(); reservation.listen(0, '127.0.0.1'); await once(reservation, 'listening'); const port = reservation.address().port; await new Promise(resolve => reservation.close(resolve));
  child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    windowsHide: true, stdio: 'ignore', env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: '', TEST_DATABASE_URL: url, AUTH_SECRET: secret, NEXT_PUBLIC_APP_URL: origin, MIDTRANS_IS_PRODUCTION: 'false', MIDTRANS_SERVER_KEY: 'SB-Mid-server-be14-http-fixture', NEXT_PUBLIC_MIDTRANS_CLIENT_KEY: 'SB-Mid-client-be14-http-fixture', MIDTRANS_WEBHOOK_URL: '', PAYMENT_EXPIRY_MINUTES: '60' },
  });
  let startupError; child.on('error', error => { startupError = error; });
  const base = `http://127.0.0.1:${port}`;
  phase = 'server'; let ready = false;
  for (let i = 0; i < 150; i++) {
    if (startupError || child.exitCode !== null) throw new Error('SERVER_FAILED');
    try { if ((await fetch(base, { signal: AbortSignal.timeout(500) })).status === 200) { ready = true; break; } } catch { /* loopback only */ }
    await delay(100);
  }
  assert.ok(ready);
  async function request(path, { cookie, method = 'GET', body, expected = 200, origin: requestOrigin = origin, extra = {} } = {}) {
    const response = await fetch(base + path, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json', Origin: requestOrigin } : {}), ...extra }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000) });
    assert.equal(response.status, expected); assert.equal(response.headers.get('cache-control'), 'no-store');
    const value = await response.json(); assert.equal(value.meta.requestId, response.headers.get('x-request-id'));
    return { ...value, cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  phase = 'registration_sessions';
  const registered = await request('/api/auth/register', { method: 'POST', body: { name: 'HTTP Fixture Buyer', email: emails[0], password, confirmPassword: password }, expected: 201 });
  ownerIds.push(registered.data.user.id); const buyerCookie = registered.cookie; assert.ok(buyerCookie);
  const other = await request('/api/auth/register', { method: 'POST', body: { name: 'HTTP Other Buyer', email: emails[1], password, confirmPassword: password }, expected: 201 }); ownerIds.push(other.data.user.id);
  const adminLogin = await request('/api/auth/login', { method: 'POST', body: { email: emails[2], password } }); const adminCookie = adminLogin.cookie;
  assert.ok(adminCookie); assert.equal((await request('/api/auth/session', { cookie: buyerCookie })).data.user.id, registered.data.user.id); passed++;
  phase = 'checkout';
  const address = (await request('/api/addresses', { cookie: buyerCookie, method: 'POST', expected: 201, body: { recipientName: 'Fixture', phone: '081200000000', addressLine: 'Historical fixture address', city: 'Tanjungpinang', province: 'Kepulauan Riau' } })).data;
  await request('/api/cart/items', { cookie: buyerCookie, method: 'POST', body: { productId: product.id, quantity: 2 }, expected: 201 });
  const quote = (await request('/api/checkout/quote', { cookie: buyerCookie, method: 'POST', body: { addressId: address.id }, expected: 201 })).data;
  const key = randomUUID(), confirm = () => request('/api/orders', { cookie: buyerCookie, method: 'POST', body: { quoteId: quote.quoteId }, extra: { 'Idempotency-Key': key }, expected: 201 });
  const order = (await confirm()).data;
  const replay = await request('/api/orders', { cookie: buyerCookie, method: 'POST', body: { quoteId: quote.quoteId }, extra: { 'Idempotency-Key': key } }); assert.equal(replay.data.id, order.id); passed++;
  phase = 'guards';
  await request(`/api/orders/${order.id}`, { expected: 401 }); await request(`/api/orders/${order.id}`, { cookie: other.cookie, expected: 404 });
  for (const path of ['/api/admin/orders', '/api/admin/dashboard?from=2000-01-01T00:00:00Z&to=2100-01-01T00:00:00Z', '/api/admin/vouchers', '/api/admin/payments']) { await request(path, { expected: 401 }); await request(path, { cookie: buyerCookie, expected: 403 }); }
  await request(`/api/order-items/${order.items[0].id}/review`, { method: 'POST', cookie: buyerCookie, body: { rating: 5, comment: 'Ulasan fixture yang valid.' }, expected: 409 }); passed++;
  phase = 'payment_mock';
  // Never call the HTTP Snap/reconcile endpoints: those use the real gateway adapter.
  const payment = await db.payment.create({ data: { orderId: order.id, providerOrderId: `SV-${randomUUID()}`, amount: order.total, status: 'PENDING', expiresAt: new Date(order.paymentDeadline) } });
  const now = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 19).replace('T', ' '), mockKey = 'SB-Mid-server-be14-http-local-mock';
  const status = { order_id: payment.providerOrderId, transaction_id: randomUUID(), status_code: '200', gross_amount: `${order.total}.00`, currency: 'IDR', transaction_status: 'settlement', payment_type: 'bank_transfer', transaction_time: now, settlement_time: now };
  let gatewayCalls = 0;
  const verification = createPaymentVerificationService(db, { serverKey: mockKey, gateway: { get: async () => { gatewayCalls++; return status; } } });
  const notification = { ...status, signature_key: createHash('sha512').update(status.order_id + status.status_code + status.gross_amount + mockKey).digest('hex') };
  await verification.notification(notification); await verification.notification(notification);
  assert.ok(gatewayCalls > 0); assert.equal(await db.paymentApplication.count({ where: { orderId: order.id } }), 1); passed++;
  phase = 'fulfillment';
  const statusPath = `/api/admin/orders/${order.id}/status`;
  await request(statusPath, { cookie: adminCookie, method: 'PATCH', body: { status: 'SHIPPED', expectedStatus: 'PROCESSING' }, origin: 'https://wrong.example.test', expected: 403 });
  await request(statusPath, { cookie: adminCookie, method: 'PATCH', body: { status: 'SHIPPED', expectedStatus: 'PROCESSING' } });
  await request(statusPath, { cookie: adminCookie, method: 'PATCH', body: { status: 'COMPLETED', expectedStatus: 'SHIPPED' }, expected: 422 });
  await request(statusPath, { cookie: adminCookie, method: 'PATCH', body: { status: 'COMPLETED', expectedStatus: 'SHIPPED', receiptConfirmed: true, note: 'Konfirmasi penerimaan fixture manual.' } });
  await request(`/api/admin/orders/${order.id}/notes`, { cookie: adminCookie, method: 'POST', body: { note: 'Private operator fixture note' }, expected: 201 });
  await db.product.update({ where: { id: product.id }, data: { name: 'Changed fixture product', price: 15000 } });
  await request(`/api/addresses/${address.id}`, { cookie: buyerCookie, method: 'PATCH', body: { addressLine: 'Changed fixture address' } });
  const detail = (await request(`/api/orders/${order.id}`, { cookie: buyerCookie })).data;
  assert.equal(detail.items[0].name, 'HTTP historical product'); assert.equal(detail.address.addressLine, 'Historical fixture address'); assert.equal(detail.status, 'COMPLETED'); assert.ok(!JSON.stringify(detail).includes('Private operator fixture note')); passed++;
  assert.ok((await request('/api/orders', { cookie: buyerCookie })).data.some(row => row.id === order.id));
  const adminList = (await request(`/api/admin/orders?q=${order.number}&paymentStatus=SUCCESS&channel=bank_transfer`, { cookie: adminCookie })).data;
  assert.ok(adminList.some(row => row.id === order.id && row.buyer.id === registered.data.user.id));
  const adminDetail = (await request(`/api/admin/orders/${order.id}`, { cookie: adminCookie })).data;
  assert.ok(JSON.stringify(adminDetail).includes('Private operator fixture note'));
  assert.ok((await request(`/api/admin/payments?orderId=${order.id}`, { cookie: adminCookie })).data.some(row => row.id === payment.id && row.status === 'SUCCESS'));
  phase = 'reviews';
  const reviewPath = `/api/order-items/${order.items[0].id}/review`, reviewBody = { rating: 5, comment: 'Makanan fixture diterima dengan baik.' };
  await request(reviewPath, { cookie: other.cookie, method: 'POST', body: reviewBody, expected: 404 });
  await request(reviewPath, { cookie: adminCookie, method: 'POST', body: reviewBody, expected: 403 });
  await request(reviewPath, { cookie: buyerCookie, method: 'POST', body: reviewBody, expected: 201 });
  await request(reviewPath, { cookie: buyerCookie, method: 'POST', body: reviewBody, expected: 409 });
  const list = await request(`/api/products/${product.id}/reviews`); assert.deepEqual(list.meta.ratingSummary, { averageRating: 5, reviewCount: 1 });
  assert.ok(!JSON.stringify(list).includes(emails[0])); assert.ok(!JSON.stringify(list).includes(registered.data.user.id));
  assert.equal((await request(`/api/products/${product.id}`)).data.averageRating, 5); passed++;
  phase = 'dashboard_vouchers';
  const dash = (await request('/api/admin/dashboard?from=2000-01-01T00:00:00Z&to=2100-01-01T00:00:00Z', { cookie: adminCookie })).data;
  assert.equal(dash.orderCount, dash.ordersByStatus.reduce((sum, row) => sum + row.count, 0));
  const vouchers = (await request('/api/admin/vouchers?status=USED&pageSize=100', { cookie: adminCookie })).data;
  assert.ok(vouchers.some(v => v.owner.id === registered.data.user.id && v.usedOrder.id === order.id));
  assert.equal((await request('/api/admin/voucher-policy', { cookie: adminCookie })).data.percentage, 20); passed++;
  success = true;
} catch { /* No raw driver/assertion/HTTP data is printed. Phase is a fixed whitelist. */ }
finally {
  if (child?.pid && child.exitCode === null) { const exit = once(child, 'exit'); child.kill(); await exit; }
  try {
    // Include registration records even if a response was lost before ID capture.
    const ids = (await db.user.findMany({ where: { email: { in: emails } }, select: { id: true } })).map(u => u.id);
    const where = { userId: { in: [...new Set([...ids, ...ownerIds])] } };
    await db.rating.deleteMany({ where: { orderItem: { order: where } } }); await db.paymentEvent.deleteMany({ where: { payment: { order: where } } });
    await db.paymentApplication.deleteMany({ where: { order: where } }); await db.payment.deleteMany({ where: { order: where } });
    await db.discount.updateMany({ where, data: { status: 'AVAILABLE', reservedOrderId: null, usedOrderId: null, usedAt: null } });
    await db.stockReservation.deleteMany({ where: { orderItem: { order: where } } }); await db.orderStatusHistory.deleteMany({ where: { order: where } });
    await db.orderItem.deleteMany({ where: { order: where } }); await db.order.deleteMany({ where }); await db.discount.deleteMany({ where });
    await db.user.deleteMany({ where: { id: { in: ids } } }); await db.product.deleteMany({ where: { id: { in: productIds } } }); await db.category.deleteMany({ where: { id: { in: categoryIds } } });
    const keys = [];
    for (let t = started - 900000; t <= Date.now() + 900000; t += 900000) for (const action of ['register', 'login']) {
      keys.push(rateLimitKey(`auth.${action}.global`, 'all', secret, new Date(t)));
      for (const email of emails) keys.push(rateLimitKey(`auth.${action}.email`, email, secret, new Date(t)));
    }
    await db.rateLimit.deleteMany({ where: { key: { in: keys } } });
  } catch { success = false; phase = 'cleanup'; }
  await db.$disconnect();
}
console.log(JSON.stringify({ success, numPassedTests: passed, numFailedTests: success ? 0 : 1, phase: success ? 'complete' : phase, testResults: [] }));
if (!success) process.exitCode = 1;
