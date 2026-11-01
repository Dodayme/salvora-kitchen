import { createHmac } from "node:crypto";
import type { PrismaClient } from "../../generated/prisma/client";
import { ApiError } from "../api/errors";

export const AUTH_WINDOW_MS = 15 * 60 * 1000;
export const authLimits = {
  login: { email: 10, global: 200 },
  register: { email: 5, global: 50 },
} as const;

export function rateLimitKey(scope: string, identity: string, secret: string, time: Date, windowMs = AUTH_WINDOW_MS) {
  return createHmac("sha256", secret).update(JSON.stringify([scope, identity, Math.floor(time.getTime() / windowMs)])).digest("hex");
}

export async function consumeRateLimit(db: PrismaClient, secret: string, scope: string, identity: string, maximum: number, now = new Date(), windowMs = AUTH_WINDOW_MS) {
  const key = rateLimitKey(scope, identity, secret, now, windowMs);
  const resetAt = new Date((Math.floor(now.getTime() / windowMs) + 1) * windowMs);
  // Atomic increment works across Next.js processes. Failed auth does not roll this back.
  const record = await db.rateLimit.upsert({ where: { key }, create: { key, count: 1, resetAt }, update: { count: { increment: 1 } } });
  if (record.count > maximum) throw new ApiError(429, "RATE_LIMITED", "Terlalu banyak percobaan. Silakan coba lagi nanti.", undefined, Math.max(1, Math.ceil((resetAt.getTime() - now.getTime()) / 1000)));
}
