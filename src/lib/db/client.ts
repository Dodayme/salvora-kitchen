import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { databaseUrl, type Environment } from "../config/schema";

// Shared by server/CLI/tests. Callers must never send the client/records to the browser.
export function createDatabaseClient(environment: Environment = process.env) {
  const connectionString = environment.NODE_ENV === "test"
    ? databaseUrl(environment, "test")
    : databaseUrl(environment);
  return new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 5, connectionTimeoutMillis: 5000 }) });
}
