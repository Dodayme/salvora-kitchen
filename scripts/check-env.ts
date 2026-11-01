import nextEnv from "@next/env";
import { appConfig, paymentConfig, snapConfig } from "../src/lib/config/schema";
import { ApiError } from "../src/lib/api/errors";

nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production", { info: () => {}, error: () => {} });
try {
  if (process.argv.includes("--payment")) paymentConfig(process.env);
  else if (process.argv.includes("--snap")) snapConfig(process.env);
  else appConfig(process.env);
  console.log("Konfigurasi valid. Koneksi database/provider belum diuji.");
} catch (error) {
  console.error(error instanceof ApiError ? error.publicMessage : "Konfigurasi server tidak valid.");
  process.exitCode = 1;
}
