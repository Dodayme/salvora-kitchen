import nextEnv from "@next/env";
import { createDatabaseClient } from "../src/lib/db/client";
import { seedDemoCatalog } from "./seed-catalog";

nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production", { info: () => {}, error: () => {} });
const db = createDatabaseClient();
try {
  await seedDemoCatalog(db);
  console.log("Seed katalog demo selesai; data yang sudah ada tidak direset. Admin dibuat terpisah melalui db:admin.");
} catch {
  console.error("Seed gagal; perubahan transaksi dibatalkan. Detail koneksi/data rahasia tidak dicetak.");
  process.exitCode = 1;
} finally { await db.$disconnect(); }
