import type { PrismaClient } from "../src/generated/prisma/client";

// Shared by the normal CLI and the separately authorized fresh-database verifier.
// The caller chooses/validates the target; this function never reads environment.
export async function seedDemoCatalog(db: PrismaClient) {
  await db.$transaction(async tx => {
    const categories = [{ id: "demo-category-risol", name: "Risol" }, { id: "demo-category-cookies", name: "Cookies" }];
    for (const category of categories) {
      const existing = await tx.category.findUnique({ where: { id: category.id } });
      if (existing && !existing.isDemo) throw new Error("Seed ID occupied by non-demo record");
      await tx.category.upsert({ where: { id: category.id }, update: {}, create: { ...category, isDemo: true } });
    }
    const products = [
      { id: "demo-product-risol", categoryId: "demo-category-risol", name: "Risol — Data Demo", price: 5000, physicalStock: 20 },
      { id: "demo-product-cookies", categoryId: "demo-category-cookies", name: "Cookies — Data Demo", price: 25000, physicalStock: 10 },
    ];
    for (const product of products) {
      const existing = await tx.product.findUnique({ where: { id: product.id } });
      if (existing && !existing.isDemo) throw new Error("Seed ID occupied by non-demo record");
      await tx.product.upsert({ where: { id: product.id }, update: {}, create: { ...product, description: "Contoh pengembangan Salvora. Nama, harga, satuan dan stok belum menjadi data toko resmi.", isDemo: true } });
    }
  });
}
