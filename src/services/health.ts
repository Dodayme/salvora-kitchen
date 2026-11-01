import "server-only";
import { getAppConfig } from "@/lib/config/server";

export function configurationHealth() {
  getAppConfig();
  return { application: "salvora-kitchen", configuration: "valid" as const, database: "not_checked" as const, payment: "not_checked" as const };
}
