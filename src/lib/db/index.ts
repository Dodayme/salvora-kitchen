import "server-only";
import { createDatabaseClient } from "./client";
import { PrismaClient } from "../../generated/prisma/client";

const globalDatabase = globalThis as unknown as {
  salvoraDatabase?: ReturnType<typeof createDatabaseClient>;
  salvoraDatabaseConstructor?: typeof PrismaClient;
};

// Lazy to keep build and the static home independent of provisioning.
export function getDatabase() {
  // Fast Refresh preserves globals, including the old Prisma runtime schema.
  // Replace that client when generated code changes (for example a new enum).
  if (globalDatabase.salvoraDatabase && globalDatabase.salvoraDatabaseConstructor !== PrismaClient) {
    const previous = globalDatabase.salvoraDatabase;
    const replacement = createDatabaseClient();
    globalDatabase.salvoraDatabase = replacement;
    globalDatabase.salvoraDatabaseConstructor = PrismaClient;
    void previous.$disconnect().catch(() => {});
  }
  globalDatabase.salvoraDatabase ??= createDatabaseClient();
  globalDatabase.salvoraDatabaseConstructor = PrismaClient;
  return globalDatabase.salvoraDatabase;
}
