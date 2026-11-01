import { createHash, randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "../generated/prisma/client";
import { ApiError } from "../lib/api/errors";
import { requireRole, type Principal } from "../lib/auth/access";
import { deliveryPolicy, PAYMENT_EXPIRY_MINUTES, QUOTE_TTL_MINUTES } from "../lib/checkout/policy";
import { idempotencyKeySchema, orderInputSchema, quoteInputSchema } from "../lib/checkout/validation";
import { priceBuyerCart } from "./pricing";
import { orderDetail, orderDetailInclude } from "../lib/orders/view";

const missing = () => new ApiError(404, "NOT_FOUND", "Data tidak ditemukan.");
const changed = () => new ApiError(409, "CHECKOUT_CHANGED", "Ringkasan checkout berubah. Ambil ringkasan baru dan tinjau sebelum konfirmasi.");
// JSONB changes object key order. Canonical keys keep stored/rebuilt hashes equal.
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value, (_key, current) => current && typeof current === "object" && !Array.isArray(current) ? Object.fromEntries(Object.keys(current).sort().map(key => [key, current[key]])) : current)).digest("hex");
const addressSelect = { recipientName: true, phone: true, addressLine: true, city: true, province: true, postalCode: true, notes: true } as const;
async function now(tx: Prisma.TransactionClient) { return (await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`)[0].now; }

async function snapshot(tx: Prisma.TransactionClient, user: Principal, addressId: string, contact?: { recipientName: string; phone: string }) {
  const address = contact ? { ...contact, addressLine: "Ambil sendiri di Salvora Kitchen", city: "Kota Tanjungpinang", province: "Kepulauan Riau", postalCode: null, notes: null } : await tx.address.findFirst({ where: { id: addressId, userId: user.id }, select: addressSelect });
  if (!address) throw missing();
  const shipping = contact ? { fee: 0, mode: "PICKUP" as const, label: "Ambil sendiri di Salvora Kitchen — gratis. Tunggu status Siap diambil sebelum datang; konfirmasikan lokasi dan waktu pengambilan dengan toko.", policyVersion: "pickup-free-v1" } : deliveryPolicy(address);
  const prices = await priceBuyerCart(tx, user, shipping.fee);
  return { version: 1, addressId, address, ...prices, shipping: { mode: shipping.mode, label: shipping.label }, deliveryPolicyVersion: shipping.policyVersion, paymentExpiryMinutes: PAYMENT_EXPIRY_MINUTES };
}
type Snapshot = Awaited<ReturnType<typeof snapshot>>;
function quoteView(id: string, expiresAt: Date, value: Snapshot) {
  const { address, items, subtotal, discount, shippingFee, total, currency, voucher, shipping } = value;
  return { quoteId: id, expiresAt: expiresAt.toISOString(), address, items, subtotal, discount, shippingFee, total, currency, voucher, shipping,
    warnings: [{ code: "REVIEW_CURRENT_PRICES", message: "Tinjau harga, alamat, ongkir, dan voucher terkini sebelum mengonfirmasi pesanan." }] };
}
export async function orderView(tx: Prisma.TransactionClient, id: string, userId: string) {
  const order = await tx.order.findFirst({ where: { id, userId }, include: orderDetailInclude });
  if (!order) throw missing();
  return orderDetail(order, await now(tx));
}
function retryable(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2034" || error.code === "P2010" && ["40P01", "40001"].includes(String(error.meta?.code)));
}
async function retry<T>(action: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await action(); }
    catch (error) { if (!retryable(error)) throw error; if (attempt >= 2) throw new ApiError(503, "CHECKOUT_BUSY", "Checkout sedang sibuk. Coba kembali dengan Idempotency-Key yang sama.", undefined, 1); }
  }
}

export function createCheckoutService(db: PrismaClient) {
  return {
    async quote(principal: Principal | null, input: unknown) {
      const user = requireRole(principal, "BUYER"), selection = quoteInputSchema.parse(input);
      return retry(() => db.$transaction(async tx => {
        const value = await snapshot(tx, user, "addressId" in selection ? selection.addressId : "", "contact" in selection ? selection.contact : undefined);
        const time = await now(tx), expiresAt = new Date(time.getTime() + QUOTE_TTL_MINUTES * 60000);
        const quote = await tx.checkoutQuote.create({ data: { userId: user.id, inputHash: digest(value), snapshot: value, createdAt: time, expiresAt } });
        return quoteView(quote.id, quote.expiresAt, value);
      }, { isolationLevel: "RepeatableRead" }));
    },
    async order(principal: Principal | null, input: unknown, key: unknown) {
      const user = requireRole(principal, "BUYER"), { quoteId } = orderInputSchema.parse(input);
      const idempotencyKey = idempotencyKeySchema.parse(key), inputHash = digest({ quoteId });
      return retry(() => db.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id} FOR UPDATE`;
        const existing = await tx.order.findUnique({ where: { userId_idempotencyKey: { userId: user.id, idempotencyKey } }, select: { id: true, inputHash: true } });
        if (existing) {
          if (existing.inputHash !== inputHash) throw new ApiError(409, "IDEMPOTENCY_CONFLICT", "Idempotency-Key sudah dipakai untuk konfirmasi yang berbeda.");
          return { data: await orderView(tx, existing.id, user.id), replayed: true };
        }
        if (await tx.order.findFirst({ where: { userId: user.id, inputHash }, select: { id: true } })) throw new ApiError(409, "QUOTE_ALREADY_USED", "Ringkasan ini sudah menghasilkan pesanan. Gunakan Idempotency-Key konfirmasi semula.");
        const quote = await tx.checkoutQuote.findFirst({ where: { id: quoteId, userId: user.id } });
        if (!quote) throw missing();
        const initialTime = await now(tx);
        if (quote.expiresAt <= initialTime) throw new ApiError(409, "QUOTE_EXPIRED", "Ringkasan checkout kedaluwarsa. Ambil ringkasan baru.");
        // Only addressId is taken from the stored snapshot; all material values
        // are rebuilt from current account/catalog data under locks below.
        const stored = quote.snapshot as unknown as Snapshot;
        if (typeof stored.addressId !== "string" || digest(stored) !== quote.inputHash) throw changed();
        const pickup = stored.shipping.mode === "PICKUP";
        if (!pickup) await tx.$queryRaw`SELECT id FROM "Address" WHERE id=${stored.addressId} AND "userId"=${user.id} FOR SHARE`;
        const cartItems = await tx.cartItem.findMany({ where: { cart: { userId: user.id } }, select: { productId: true } });
        const productIds = cartItems.map(item => item.productId).sort();
        if (productIds.length) {
          await tx.$queryRaw(Prisma.sql`SELECT id FROM "Product" WHERE id IN (${Prisma.join(productIds)}) ORDER BY id FOR UPDATE`);
          const products = await tx.product.findMany({ where: { id: { in: productIds } }, select: { categoryId: true } });
          const categoryIds = [...new Set(products.map(p => p.categoryId))].sort();
          if (categoryIds.length) await tx.$queryRaw(Prisma.sql`SELECT id FROM "Category" WHERE id IN (${Prisma.join(categoryIds)}) ORDER BY id FOR SHARE`);
        }
        await tx.$queryRaw`SELECT id FROM "Discount" WHERE "userId"=${user.id} FOR UPDATE`;
        const value = await snapshot(tx, user, stored.addressId, pickup ? stored.address : undefined);
        if (digest(value) !== quote.inputHash) throw changed();
        const time = await now(tx);
        if (quote.expiresAt <= time) throw new ApiError(409, "QUOTE_EXPIRED", "Ringkasan checkout kedaluwarsa. Ambil ringkasan baru.");
        const paymentDeadline = new Date(time.getTime() + PAYMENT_EXPIRY_MINUTES * 60000);
        const { notes, ...address } = value.address;
        const id = randomUUID();
        const order = await tx.order.create({ data: {
          id, number: `SK-${time.toISOString().slice(0, 10).replaceAll("-", "")}-${id}`, userId: user.id, idempotencyKey, inputHash,
          ...address, addressNotes: notes,
          subtotal: value.subtotal, discount: value.discount, shippingFee: value.shippingFee, total: value.total,
          discountId: value.voucher?.id ?? null, shippingMode: value.shipping.mode, shippingLabel: value.shipping.label, createdAt: time, paymentDeadline,
          items: { create: value.items.map(({ productId, name, unitPrice, quantity, lineSubtotal }) => ({ productId, name, unitPrice, quantity, lineSubtotal, reservation: { create: { expiresAt: paymentDeadline, createdAt: time } } })) },
          history: { create: { toStatus: "AWAITING_PAYMENT", actor: "SYSTEM", changedAt: time, note: "Pesanan dibuat; menunggu pembayaran." } },
        }, select: { id: true } });
        for (const item of [...value.items].sort((a, b) => a.productId.localeCompare(b.productId))) {
          const updated = await tx.$queryRaw<Array<{ id: string }>>`UPDATE "Product" SET "reservedStock"="reservedStock"+${item.quantity},"updatedAt"=GREATEST(date_trunc('milliseconds',clock_timestamp()),"updatedAt"+interval '1 millisecond') WHERE id=${item.productId} AND "physicalStock"-"reservedStock">=${item.quantity} RETURNING id`;
          if (!updated.length) throw new ApiError(409, "INSUFFICIENT_STOCK", "Stok berubah. Tinjau ringkasan checkout kembali.");
        }
        if (value.voucher) {
          const updated = await tx.discount.updateMany({ where: { id: value.voucher.id, userId: user.id, status: "AVAILABLE" }, data: { status: "RESERVED", reservedOrderId: order.id } });
          if (updated.count !== 1) throw changed();
        }
        for (const item of value.items) {
          const removed = await tx.cartItem.deleteMany({ where: { id: item.cartItemId, quantity: item.quantity, cart: { userId: user.id } } });
          if (removed.count !== 1) throw changed();
        }
        return { data: await orderView(tx, order.id, user.id), replayed: false };
      }, { timeout: 15000 }));
    },
  };
}
