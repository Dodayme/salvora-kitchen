import { Prisma, type PrismaClient } from "../generated/prisma/client";
import { ApiError } from "../lib/api/errors";
import { pageMeta } from "../lib/api/input";
import { requireRole, type Principal } from "../lib/auth/access";
import { adminProductQuerySchema, availability, categoryCreateSchema, categoryPatchSchema, categoryQuerySchema, idSchema, LOW_STOCK_THRESHOLD, productCreateSchema, productPatchSchema, publicProductQuerySchema, stockSchema, type CategoryQuery, type ProductQuery } from "../lib/catalog/validation";

const missing = () => new ApiError(404, "NOT_FOUND", "Data tidak ditemukan.");
function databaseError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") throw new ApiError(409, "RESOURCE_EXISTS", "Data dengan identitas yang sama sudah ada.");
    if (error.code === "P2003") throw new ApiError(409, "RESOURCE_IN_USE", "Data masih digunakan atau referensinya berubah.");
    if (error.code === "P2025") throw missing();
  }
  throw error;
}
const productSelect = {
  id: true, category: { select: { id: true, name: true } }, name: true, description: true, price: true, photoId: true,
  imageUrl: true, isActive: true, isDemo: true, physicalStock: true, reservedStock: true, createdAt: true, updatedAt: true,
} as const;
type ProductRecord = Prisma.ProductGetPayload<{ select: typeof productSelect }>;
type RatingSummary = { productId: string; average: number; count: number };

export function createCatalogService(db: PrismaClient) {
  async function productViews(tx: Prisma.TransactionClient, records: ProductRecord[], admin: boolean) {
    const ids = records.map(record => record.id);
    const ratings = ids.length ? await tx.$queryRaw<RatingSummary[]>(Prisma.sql`SELECT oi."productId", avg(r.rating)::float8 AS average, count(*)::int AS count FROM "Rating" r JOIN "OrderItem" oi ON oi.id=r."orderItemId" WHERE oi."productId" IN (${Prisma.join(ids)}) GROUP BY oi."productId"`) : [];
    const byId = new Map(ratings.map(rating => [rating.productId, rating]));
    return records.map(record => {
      const rating = byId.get(record.id);
      const legacyUrl = record.imageUrl && (/^\/(?!\/)/.test(record.imageUrl) || /^https:\/\//.test(record.imageUrl)) ? record.imageUrl : null;
      return {
        id: record.id, category: record.category, name: record.name, description: record.description, price: record.price,
        imageUrl: record.photoId ? `/api/product-photos/${record.photoId}` : legacyUrl,
        isActive: record.isActive, isDemo: record.isDemo, availableStock: record.physicalStock - record.reservedStock,
        availability: availability(record.physicalStock, record.reservedStock), averageRating: rating?.average ?? null, reviewCount: rating?.count ?? 0,
        ...(admin ? { physicalStock: record.physicalStock, reservedStock: record.reservedStock, photoId: record.photoId, createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString() } : {}),
      };
    });
  }

  async function detail(id: string, admin: boolean) {
    idSchema.parse(id);
    return db.$transaction(async tx => {
      const record = await tx.product.findFirst({ where: { id, ...(admin ? {} : { isActive: true, category: { isActive: true } }) }, select: productSelect });
      if (!record) throw missing();
      return (await productViews(tx, [record], admin))[0];
    }, { isolationLevel: "RepeatableRead" });
  }

  async function listProducts(query: ProductQuery, admin: boolean) {
    const predicates: Prisma.Sql[] = admin ? [] : [Prisma.sql`p."isActive"=true AND c."isActive"=true`];
    if (query.categoryId) predicates.push(Prisma.sql`p."categoryId"=${query.categoryId}`);
    if (query.isActive !== undefined) predicates.push(Prisma.sql`p."isActive"=${query.isActive}`);
    // Escape wildcard characters so q searches a literal substring, not arbitrary LIKE patterns.
    if (query.q) predicates.push(Prisma.sql`p.name ILIKE ${`%${query.q.replace(/[\\%_]/g, "\\$&")}%`}`);
    if (query.availability === "OUT_OF_STOCK") predicates.push(Prisma.sql`p."physicalStock"-p."reservedStock"=0`);
    if (query.availability === "LOW") predicates.push(Prisma.sql`p."physicalStock"-p."reservedStock" BETWEEN 1 AND ${LOW_STOCK_THRESHOLD}`);
    if (query.availability === "AVAILABLE") predicates.push(Prisma.sql`p."physicalStock"-p."reservedStock">${LOW_STOCK_THRESHOLD}`);
    const where = predicates.length ? Prisma.sql`WHERE ${Prisma.join(predicates, " AND ")}` : Prisma.empty;
    return db.$transaction(async tx => {
      const [count] = await tx.$queryRaw<Array<{ total: number }>>(Prisma.sql`SELECT count(*)::int AS total FROM "Product" p JOIN "Category" c ON c.id=p."categoryId" ${where}`);
      const ids = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT p.id FROM "Product" p JOIN "Category" c ON c.id=p."categoryId" ${where} ORDER BY p.name ASC,p.id ASC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
      const records = ids.length ? await tx.product.findMany({ where: { id: { in: ids.map(value => value.id) } }, select: productSelect, orderBy: [{ name: "asc" }, { id: "asc" }] }) : [];
      return { data: await productViews(tx, records, admin), pagination: pageMeta(query.page, query.pageSize, count.total) };
    }, { isolationLevel: "RepeatableRead" });
  }

  async function listCategories(query: CategoryQuery, admin: boolean) {
    const where = { ...(admin ? {} : { isActive: true }), ...(query.isActive === undefined ? {} : { isActive: query.isActive }), ...(query.q ? { name: { contains: query.q, mode: "insensitive" as const } } : {}) };
    return db.$transaction(async tx => {
      const total = await tx.category.count({ where });
      const records = await tx.category.findMany({ where, orderBy: [{ name: "asc" }, { id: "asc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize, select: { id: true, name: true, isActive: true, isDemo: true, _count: { select: { products: { where: admin ? {} : { isActive: true } } } } } });
      return { data: records.map(({ _count, ...record }) => ({ ...record, productCount: _count.products })), pagination: pageMeta(query.page, query.pageSize, total) };
    }, { isolationLevel: "RepeatableRead" });
  }

  async function categoryReference(tx: Prisma.TransactionClient, categoryId: string) {
    if (!await tx.category.findUnique({ where: { id: categoryId }, select: { id: true } })) throw new ApiError(422, "VALIDATION_ERROR", "Kategori tidak ditemukan.", [{ path: "categoryId", code: "not_found" }]);
  }
  async function photoReference(tx: Prisma.TransactionClient, photoId: string | null | undefined) {
    if (!photoId) return { photoId: null, photoKey: null, imageUrl: null };
    const photo = await tx.productPhoto.findUnique({ where: { id: photoId }, select: { id: true, key: true } });
    if (!photo) throw new ApiError(422, "VALIDATION_ERROR", "Foto tidak ditemukan.", [{ path: "photoId", code: "not_found" }]);
    return { photoId: photo.id, photoKey: photo.key, imageUrl: `/api/product-photos/${photo.id}` };
  }

  return {
    publicProducts: (query: unknown) => listProducts(publicProductQuerySchema.parse(query), false),
    publicCategories: (query: unknown) => listCategories(categoryQuerySchema.pick({ page: true, pageSize: true }).parse(query), false),
    publicProduct: (id: string) => detail(id, false),
    adminProducts(principal: Principal | null, query: unknown) { requireRole(principal, "ADMIN"); return listProducts(adminProductQuerySchema.parse(query), true); },
    adminCategories(principal: Principal | null, query: unknown) { requireRole(principal, "ADMIN"); return listCategories(categoryQuerySchema.parse(query), true); },
    adminProduct(principal: Principal | null, id: string) { requireRole(principal, "ADMIN"); return detail(id, true); },

    async createCategory(principal: Principal | null, input: unknown) {
      requireRole(principal, "ADMIN");
      const data = categoryCreateSchema.parse(input);
      try { const record = await db.category.create({ data, select: { id: true, name: true, isActive: true, isDemo: true } }); return { ...record, productCount: 0 }; }
      catch (error) { databaseError(error); }
    },
    async updateCategory(principal: Principal | null, id: string, input: unknown) {
      requireRole(principal, "ADMIN"); idSchema.parse(id);
      const data = categoryPatchSchema.parse(input);
      try {
        const record = await db.category.update({ where: { id }, data, select: { id: true, name: true, isActive: true, isDemo: true, _count: { select: { products: true } } } });
        const { _count, ...view } = record;
        return { ...view, productCount: _count.products };
      } catch (error) { databaseError(error); }
    },
    async deleteCategory(principal: Principal | null, id: string) {
      requireRole(principal, "ADMIN"); idSchema.parse(id);
      try { await db.category.delete({ where: { id } }); }
      catch (error) { databaseError(error); }
    },
    async createProduct(principal: Principal | null, input: unknown) {
      requireRole(principal, "ADMIN");
      const { photoId, ...data } = productCreateSchema.parse(input);
      try {
        const id = await db.$transaction(async tx => {
          await categoryReference(tx, data.categoryId);
          const photo = await photoReference(tx, photoId);
          return (await tx.product.create({ data: { ...data, ...photo }, select: { id: true } })).id;
        });
        return detail(id, true);
      } catch (error) { databaseError(error); }
    },
    async updateProduct(principal: Principal | null, id: string, input: unknown) {
      requireRole(principal, "ADMIN"); idSchema.parse(id);
      const { photoId, ...data } = productPatchSchema.parse(input);
      try {
        await db.$transaction(async tx => {
          await tx.$queryRaw`SELECT id FROM "Product" WHERE id=${id} FOR UPDATE`;
          const current = await tx.product.findUnique({ where: { id }, select: { updatedAt: true } });
          if (!current) throw missing();
          if (data.categoryId) await categoryReference(tx, data.categoryId);
          const photo = photoId === undefined ? {} : await photoReference(tx, photoId);
          await tx.product.update({ where: { id }, data: { ...data, ...photo, updatedAt: new Date(Math.max(Date.now(), current.updatedAt.getTime() + 1)) } });
        });
        return detail(id, true);
      } catch (error) { databaseError(error); }
    },
    async updateStock(principal: Principal | null, id: string, input: unknown) {
      requireRole(principal, "ADMIN"); idSchema.parse(id);
      const data = stockSchema.parse(input);
      const updated = await db.$queryRaw<Array<{ id: string }>>`UPDATE "Product" SET "physicalStock"=${data.physicalStock},"updatedAt"=GREATEST(date_trunc('milliseconds',clock_timestamp()),"updatedAt"+interval '1 millisecond') WHERE id=${id} AND "updatedAt"=${new Date(data.expectedUpdatedAt)} AND "reservedStock"<=${data.physicalStock} RETURNING id`;
      if (!updated.length) {
        const current = await db.product.findUnique({ where: { id }, select: { updatedAt: true, reservedStock: true } });
        if (!current) throw missing();
        if (current.updatedAt.getTime() !== new Date(data.expectedUpdatedAt).getTime()) throw new ApiError(409, "RESOURCE_VERSION_CONFLICT", "Data produk berubah. Muat ulang sebelum mengatur stok.");
        throw new ApiError(409, "STOCK_RESERVED", "Stok fisik tidak boleh kurang dari stok yang dicadangkan.");
      }
      return detail(id, true);
    },
  };
}
