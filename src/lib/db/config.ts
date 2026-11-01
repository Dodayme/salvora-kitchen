import "server-only";
import { databaseUrl } from "../config/schema";

// Validated configuration only; getDatabase() is the lazy server-side client.
export function getDatabaseConfig() {
  const connectionString = process.env.NODE_ENV === "test"
    ? databaseUrl(process.env, "test")
    : databaseUrl(process.env);
  return { connectionString };
}
