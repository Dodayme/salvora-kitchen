import nextEnv from "@next/env";
import { createDatabaseClient } from "../src/lib/db/client";
import { seedStoreCatalog } from "./seed-store";

nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production", { info: () => {}, error: () => {} });
const db = createDatabaseClient();
try {
  await seedStoreCatalog(db);
  console.log("Katalog toko diperbarui; demo dinonaktifkan. Stok yang sudah ada dipertahankan.");
} catch {
  console.error("Seed gagal; perubahan transaksi dibatalkan. Detail koneksi/data rahasia tidak dicetak.");
  process.exitCode = 1;
} finally { await db.$disconnect(); }
