import "server-only";
import { getAppConfig } from "../config/server";
import { getDatabase } from "../db";
import { createAuthService } from "../../services/auth";
import { requireRole, requirePrincipal } from "./access";
import { sessionToken } from "./session";

export function authContext() {
  const settings = getAppConfig();
  return { settings, service: createAuthService(getDatabase(), settings) };
}

export async function requireSessionUser(request: Request, role?: "BUYER" | "ADMIN") {
  const { service } = authContext();
  const user = await service.currentUser(sessionToken(request));
  return role ? requireRole(user, role) : requirePrincipal(user);
}
