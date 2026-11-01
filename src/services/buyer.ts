import { Prisma, type PrismaClient } from "../generated/prisma/client";
import { ApiError } from "../lib/api/errors";
import { paginationSchema, pageMeta } from "../lib/api/input";
import { requireRole, type Principal } from "../lib/auth/access";
import { idSchema, MAX_INTEGER } from "../lib/catalog/validation";
import { addressCreateSchema, addressPatchSchema, cartAddSchema, quantitySchema } from "../lib/buyer/validation";

const missing = () => new ApiError(404, "NOT_FOUND", "Data tidak ditemukan.");
const addressSelect = { id: true, recipientName: true, phone: true, addressLine: true, city: true, province: true, postalCode: true, notes: true } as const;
function money(value: bigint) {
  if (value > BigInt(MAX_INTEGER)) throw new ApiError(409, "CART_TOTAL_LIMIT", "Subtotal keranjang melampaui batas. Kurangi jumlah barang.");
  return Number(value);
}
async function cartView(tx: Prisma.TransactionClient, userId: string) {
  const cart = await tx.cart.findUnique({ where: { userId }, include: { items: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], include: { product: { include: { category: true } } } } } });
  const items = (cart?.items ?? []).map(({ id, quantity, product: p }) => {
    const availableStock = p.physicalStock - p.reservedStock;
    const legacyUrl = p.imageUrl && (/^\/(?!\/)/.test(p.imageUrl) || /^https:\/\//.test(p.imageUrl)) ? p.imageUrl : null;
    return { id, productId: p.id, name: p.name, imageUrl: p.photoId ? `/api/product-photos/${p.photoId}` : legacyUrl,
      unitPrice: p.price, quantity, lineSubtotal: money(BigInt(p.price) * BigInt(quantity)), availableStock,
      isAvailable: p.isActive && p.category.isActive && availableStock >= quantity };
  });
  return { id: cart?.id ?? null, items, subtotal: money(items.reduce((sum, item) => sum + BigInt(item.lineSubtotal), 0n)) };
}

export function createBuyerService(db: PrismaClient) {
  async function mutateCart(principal: Principal | null, action: "add" | "set" | "delete", input: unknown, itemId?: string) {
    const user = requireRole(principal, "BUYER");
    if (itemId !== undefined) idSchema.parse(itemId);
    const addData = action === "add" ? cartAddSchema.parse(input) : null;
    const data = addData ?? (action === "set" ? quantitySchema.parse(input) : null);
    return db.$transaction(async tx => {
      // Serialize the first cart creation and every mutation for this account. No stock is reserved.
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id} FOR UPDATE`;
      const existing = action === "add" ? null : await tx.cartItem.findFirst({ where: { id: itemId, cart: { userId: user.id } } });
      if (action !== "add" && !existing) throw missing();
      if (action === "delete") await tx.cartItem.delete({ where: { id: existing!.id } });
      else {
        const productId = action === "add" ? addData!.productId : existing!.productId;
        // Keep stock/category checks stable until commit; other buyers can still place items in their carts.
        const products = await tx.$queryRaw<Array<{ price: number; available: number; active: boolean }>>`SELECT p.price, p."physicalStock"-p."reservedStock" AS available, (p."isActive" AND c."isActive") AS active FROM "Product" p JOIN "Category" c ON c.id=p."categoryId" WHERE p.id=${productId} FOR SHARE OF p,c`;
        const product = products[0];
        if (!product) throw missing();
        const cart = await tx.cart.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {} });
        const previous = action === "add" ? await tx.cartItem.findUnique({ where: { cartId_productId: { cartId: cart.id, productId } } }) : existing;
        const quantity = data!.quantity + (action === "add" ? previous?.quantity ?? 0 : 0);
        if (!product.active) throw new ApiError(409, "PRODUCT_UNAVAILABLE", "Produk tidak tersedia.");
        if (quantity > MAX_INTEGER || quantity > product.available) throw new ApiError(409, "INSUFFICIENT_STOCK", "Jumlah melebihi stok tersedia.");
        money(BigInt(product.price) * BigInt(quantity));
        if (previous) await tx.cartItem.update({ where: { id: previous.id }, data: { quantity } });
        else await tx.cartItem.create({ data: { cartId: cart.id, productId, quantity } });
      }
      // A deletion must remain possible even when a later price increase makes the remaining cart too large.
      if (action === "delete") return null;
      return cartView(tx, user.id);
    });
  }
  return {
    async addresses(principal: Principal | null, query: unknown) {
      const user = requireRole(principal, "BUYER"), paging = paginationSchema.parse(query);
      return db.$transaction(async tx => {
        const where = { userId: user.id };
        const total = await tx.address.count({ where });
        const data = await tx.address.findMany({ where, select: addressSelect, orderBy: [{ createdAt: "asc" }, { id: "asc" }], skip: (paging.page - 1) * paging.pageSize, take: paging.pageSize });
        return { data, pagination: pageMeta(paging.page, paging.pageSize, total) };
      }, { isolationLevel: "RepeatableRead" });
    },
    async createAddress(principal: Principal | null, input: unknown) {
      const user = requireRole(principal, "BUYER");
      return db.address.create({ data: { ...addressCreateSchema.parse(input), userId: user.id }, select: addressSelect });
    },
    async updateAddress(principal: Principal | null, id: string, input: unknown) {
      const user = requireRole(principal, "BUYER"); idSchema.parse(id);
      const data = addressPatchSchema.parse(input);
      try { return await db.address.update({ where: { id, userId: user.id }, data, select: addressSelect }); }
      catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") throw missing(); throw error; }
    },
    async deleteAddress(principal: Principal | null, id: string) {
      const user = requireRole(principal, "BUYER"); idSchema.parse(id);
      const result = await db.address.deleteMany({ where: { id, userId: user.id } });
      if (!result.count) throw missing();
    },
    cart(principal: Principal | null) { const user = requireRole(principal, "BUYER"); return db.$transaction(tx => cartView(tx, user.id), { isolationLevel: "RepeatableRead" }); },
    addItem: (principal: Principal | null, input: unknown) => mutateCart(principal, "add", input).then(cart => cart!),
    setItem: (principal: Principal | null, id: string, input: unknown) => mutateCart(principal, "set", input, id).then(cart => cart!),
    async deleteItem(principal: Principal | null, id: string) { await mutateCart(principal, "delete", null, id); return null; },
  };
}
