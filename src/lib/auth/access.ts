import { ApiError } from "../api/errors";

export type Principal = { id: string; role: "BUYER" | "ADMIN" };
// Principal must come from a server-resolved session (BE-03), never request JSON.
export function requirePrincipal(principal: Principal | null): Principal {
  if (!principal) throw new ApiError(401, "UNAUTHENTICATED", "Silakan masuk terlebih dahulu.");
  return principal;
}
export function requireRole(principal: Principal | null, role: Principal["role"]) {
  const user = requirePrincipal(principal);
  if (user.role !== role) throw new ApiError(403, "FORBIDDEN", "Akses tidak diizinkan.");
  return user;
}
export function requireOwner(principal: Principal | null, ownerId: string, allowAdmin = false) {
  const user = requirePrincipal(principal);
  if (user.id !== ownerId && !(allowAdmin && user.role === "ADMIN")) throw new ApiError(403, "FORBIDDEN", "Akses tidak diizinkan.");
  return user;
}
export function checkOrigin(request: Request, appUrl: string) {
  if (request.headers.get("origin") !== new URL(appUrl).origin) throw new ApiError(403, "INVALID_ORIGIN", "Asal permintaan tidak diizinkan.");
}
