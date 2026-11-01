import nextEnv from "@next/env";
import { defineConfig } from "prisma/config";
import { databaseUrl } from "./src/lib/config/schema";

nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production", { info: () => {}, error: () => {} });
const testTarget = process.env.SALVORA_DATABASE_TARGET === "test";
const url = databaseUrl(process.env, testTarget ? "test" : "app");
const shadowDatabaseUrl = !testTarget && process.env.SHADOW_DATABASE_URL ? databaseUrl(process.env, "shadow") : undefined;
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "node --import tsx prisma/seed.ts" },
  datasource: { url, ...(shadowDatabaseUrl ? { shadowDatabaseUrl } : {}) },
});
