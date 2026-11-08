import type { Prisma } from "../generated/prisma/client";
import { ApiError } from "../lib/api/errors";
import { requireRole, type Principal } from "../lib/auth/access";
import { newBuyerDiscount, payableTotal, productSubtotal } from "../lib/pricing/money";
import { eventDiscount } from "../lib/promotions/model";
import { firstPurchaseEligible } from "./vouchers";

// Read inside the caller's consistent transaction. These are server inputs for
// BE-07, not a public quote or a reservation; checkout must revalidate at commit.
export async function readPricingInputs(tx: Prisma.TransactionClient, principal: Principal | null) {
  const user = requireRole(principal, "BUYER");
  const cart = await tx.cart.findUnique({ where: { userId: user.id }, include: { items: { orderBy: { id: "asc" }, include: { product: { include: { category: true } } } } } });
  if (!cart?.items.length) throw new ApiError(409, "CART_EMPTY", "Keranjang masih kosong.");
  const items = cart.items.map(({ id, quantity, product: p }) => {
    if (!p.isActive || !p.category.isActive) throw new ApiError(409, "PRODUCT_UNAVAILABLE", "Ada produk yang tidak tersedia.");
    if (quantity > p.physicalStock - p.reservedStock) throw new ApiError(409, "INSUFFICIENT_STOCK", "Jumlah barang melebihi stok tersedia.");
    return { cartItemId: id, productId: p.id, name: p.name, unitPrice: p.price, quantity, lineSubtotal: productSubtotal([{ unitPrice: p.price, quantity }]) };
  });
  const subtotal = productSubtotal(items.map(({ unitPrice, quantity }) => ({ unitPrice, quantity })));
  const voucher = await tx.discount.findUnique({ where: { userId: user.id }, select: { id: true, status: true } });
  const eligibleVoucherId = voucher?.status === "AVAILABLE" && await firstPurchaseEligible(tx, user.id) ? voucher.id : null;
  return { items, subtotal, eligibleVoucherId };
}

// shippingFee must be chosen by server delivery policy. There is deliberately
// no default while delivery pricing is still an open decision for BE-07.
export async function priceBuyerCart(tx: Prisma.TransactionClient, principal: Principal | null, shippingFee: number) {
  const { items, subtotal, eligibleVoucherId } = await readPricingInputs(tx, principal);
  const buyerDiscount = newBuyerDiscount(subtotal, eligibleVoucherId !== null);
  const time = (await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`)[0].now;
  const user = requireRole(principal, "BUYER");
  const promotions = await tx.eventPromotion.findMany({ where: { isActive: true, startsAt: { lte: time }, endsAt: { gt: time }, OR: [{ recipientIds: { isEmpty: true } }, { recipientIds: { has: user.id } }] }, orderBy: { id: "asc" } });
  let discount = buyerDiscount;
  let eventPromotion: { id: string; name: string } | null = null;
  for (const promotion of promotions) {
    const amount = eventDiscount(subtotal, promotion.percentage, promotion.maxDiscount);
    if (amount > discount) { discount = amount; eventPromotion = { id: promotion.id, name: promotion.name }; }
  }
  const total = payableTotal(subtotal, discount, shippingFee);
  return { items, subtotal, discount, shippingFee, total, currency: "IDR" as const,
    eventPromotion, voucher: eligibleVoucherId && !eventPromotion ? { id: eligibleVoucherId, discount } : null };
}
