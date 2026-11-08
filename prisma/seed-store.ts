import type { PrismaClient } from "../src/generated/prisma/client";
import products from "./store-products.json";

export async function seedStoreCatalog(db: PrismaClient) {
  await db.$transaction(async tx => {
    // Keep historical order references while removing demo items from sale.
    await tx.product.updateMany({ where: { isDemo: true, isActive: true }, data: { isActive: false } });
    for (const name of ["Cookies", "Risol", "Pastry"]) {
      const category = await tx.category.upsert({ where: { name }, update: { isDemo: false, isActive: true }, create: { name } });
      for (const item of products.filter(product => product.category === name)) {
        const { category: _category, ...product } = item;
        const data = { ...product, price: product.price || 1, categoryId: category.id, description: `${product.name} dari Salvora Kitchen.${name === "Cookies" ? " Harga per buah." : ""}`, isDemo: false, isActive: product.price > 0 };
        await tx.product.upsert({ where: { id: product.id }, update: data, create: data });
      }
    }
  });
}

