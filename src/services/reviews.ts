import { Prisma, type PrismaClient } from "../generated/prisma/client";
import { ApiError } from "../lib/api/errors";
import { pageMeta } from "../lib/api/input";
import { requireRole, type Principal } from "../lib/auth/access";
import { idSchema } from "../lib/catalog/validation";
import { reviewInputSchema, reviewQuerySchema } from "../lib/reviews/validation";

const missing = () => new ApiError(404, "NOT_FOUND", "Data tidak ditemukan.");
const duplicate = () => new ApiError(409, "REVIEW_EXISTS", "Item pesanan sudah diulas.");
const reviewSelect = {
  id: true, rating: true, comment: true, createdAt: true,
  orderItem: { select: { productId: true, order: { select: { user: { select: { name: true } } } } } },
} satisfies Prisma.RatingSelect;
type Review = Prisma.RatingGetPayload<{ select: typeof reviewSelect }>;
function reviewView(row: Review) {
  return { id: row.id, productId: row.orderItem.productId, rating: row.rating, comment: row.comment, author: { displayName: row.orderItem.order.user.name }, createdAt: row.createdAt.toISOString() };
}

export function createReviewService(db: PrismaClient) {
  return {
    async list(productId: string, input: unknown) {
      idSchema.parse(productId); const q = reviewQuerySchema.parse(input);
      return db.$transaction(async tx => {
        const product = await tx.product.findFirst({ where: { id: productId, isActive: true, category: { isActive: true } }, select: { id: true } });
        if (!product) throw missing();
        const where = { orderItem: { productId } };
        const aggregate = await tx.rating.aggregate({ where, _count: { _all: true }, _avg: { rating: true } });
        const rows = await tx.rating.findMany({ where, select: reviewSelect, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (q.page - 1) * q.pageSize, take: q.pageSize });
        return { data: rows.map(reviewView), pagination: pageMeta(q.page, q.pageSize, aggregate._count._all), summary: { averageRating: aggregate._avg.rating, reviewCount: aggregate._count._all } };
      }, { isolationLevel: "RepeatableRead" });
    },
    async create(principal: Principal | null, itemId: string, input: unknown) {
      const user = requireRole(principal, "BUYER"); idSchema.parse(itemId); const value = reviewInputSchema.parse(input);
      const identity = await db.orderItem.findFirst({ where: { id: itemId, order: { userId: user.id } }, select: { orderId: true } });
      if (!identity) throw missing();
      try {
        return await db.$transaction(async tx => {
          // Same ordering as fulfillment/webhook: revalidate ownership/status after locks.
          await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id} FOR UPDATE`;
          await tx.$queryRaw`SELECT id FROM "Order" WHERE id=${identity.orderId} AND "userId"=${user.id} FOR UPDATE`;
          const item = await tx.orderItem.findFirst({ where: { id: itemId, orderId: identity.orderId, order: { userId: user.id } }, select: { id: true, order: { select: { status: true } }, rating: { select: { id: true } } } });
          if (!item) throw missing();
          if (item.order.status !== "COMPLETED") throw new ApiError(409, "ORDER_NOT_COMPLETED", "Ulasan hanya untuk item pesanan yang sudah Selesai.");
          if (item.rating) throw duplicate();
          // Product/author are derived through the immutable item relation, never client JSON.
          const row = await tx.rating.create({ data: { orderItemId: item.id, rating: value.rating, comment: value.comment }, select: reviewSelect });
          return reviewView(row);
        }, { timeout: 15000 });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === "P2002") throw duplicate();
          if (error.code === "P2034") throw new ApiError(503, "REVIEW_BUSY", "Pesanan sedang diperbarui. Coba lagi setelah memuat ulang.", undefined, 1);
        }
        throw error;
      }
    },
  };
}
