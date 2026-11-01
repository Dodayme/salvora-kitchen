import nextEnv from "@next/env";
import { createDatabaseClient } from "../src/lib/db/client";

nextEnv.loadEnvConfig(process.cwd(), true, { info: () => {}, error: () => {} });
const db = createDatabaseClient();
try {
  const info = await db.$queryRaw<Array<{ database: string; version: string }>>`SELECT current_database() AS database, current_setting('server_version') AS version`;
  const [categories, products, admins, orders] = await Promise.all([
    db.category.count({ where: { isDemo: true } }), db.product.count({ where: { isDemo: true } }), db.user.count({ where: { role: "ADMIN" } }), db.order.count(),
  ]);
  console.log(JSON.stringify({ ...info[0], demoCategories: categories, demoProducts: products, adminCount: admins, orderCount: orders }));
} catch {
  console.error("Pemeriksaan database gagal; periksa konfigurasi, layanan dan migrasi Salvora. Kredensial/detail query tidak dicetak.");
  process.exitCode = 1;
} finally { await db.$disconnect(); }
