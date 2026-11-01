import { compare, hash } from "bcryptjs";
import { randomBytes } from "node:crypto";
import { Prisma, type PrismaClient } from "../generated/prisma/client";
import { ApiError } from "../lib/api/errors";
import { requireRole } from "../lib/auth/access";
import { consumeRateLimit, authLimits } from "../lib/auth/rate-limit";
import { newSessionToken, sessionDigest, validSessionToken } from "../lib/auth/session";
import { adminProfileSchema, loginSchema, registerSchema } from "../lib/auth/validation";
import { userView, type UserView } from "../lib/contracts/user";
import { afterAuthenticatedLogin, type LoginHook } from "./auth-login-hook";

export type AuthSettings = { authSecret: string; sessionTtlDays: number; appUrl: string };
export type AuthResult = { user: UserView; session: { token: string; expiresAt: Date } };
export const userSelect = { id: true, name: true, email: true, role: true } as const;
// One dummy hash per process, with the same cost as real accounts. No account uses it.
const dummyHash = hash(randomBytes(32).toString("hex"), 12);

export function createAuthService(db: PrismaClient, settings: AuthSettings, hook: LoginHook = afterAuthenticatedLogin) {
  async function limit(operation: "login" | "register", email: string) {
    await consumeRateLimit(db, settings.authSecret, `auth.${operation}.global`, "all", authLimits[operation].global);
    await consumeRateLimit(db, settings.authSecret, `auth.${operation}.email`, email, authLimits[operation].email);
  }

  async function attachSession(tx: Prisma.TransactionClient, user: UserView, previousToken: string | null): Promise<AuthResult> {
    // Lock before Session's FK takes a key-share lock. Upgrading after inserting
    // concurrent sessions would deadlock first-login voucher issuance.
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id} FOR UPDATE`;
    if (validSessionToken(previousToken)) await tx.session.deleteMany({ where: { tokenDigest: sessionDigest(previousToken, settings.authSecret) } });
    const token = newSessionToken();
    const expiresAt = new Date(Date.now() + settings.sessionTtlDays * 86400000);
    await tx.session.create({ data: { tokenDigest: sessionDigest(token, settings.authSecret), userId: user.id, expiresAt } });
    await hook(tx, user);
    return { user: userView(user), session: { token, expiresAt } };
  }

  return {
    async register(input: unknown, previousToken: string | null = null): Promise<AuthResult> {
      const data = registerSchema.parse(input);
      await limit("register", data.email);
      const passwordHash = await hash(data.password, 12);
      return db.$transaction(async tx => {
        let user;
        try {
          user = await tx.user.create({ data: { name: data.name, email: data.email, passwordHash, role: "BUYER" }, select: userSelect });
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ApiError(409, "EMAIL_EXISTS", "Email sudah terdaftar.");
          throw error;
        }
        return attachSession(tx, userView(user), previousToken);
      });
    },

    async login(input: unknown, previousToken: string | null = null): Promise<AuthResult> {
      const data = loginSchema.parse(input);
      await limit("login", data.email);
      const user = await db.user.findUnique({ where: { email: data.email } });
      const valid = await compare(data.password, user?.passwordHash ?? await dummyHash);
      if (!user || !valid) throw new ApiError(401, "INVALID_CREDENTIALS", "Email atau kata sandi salah.");
      return db.$transaction(tx => attachSession(tx, userView(user), previousToken));
    },

    async currentUser(token: string | null): Promise<UserView | null> {
      if (!validSessionToken(token)) return null;
      const session = await db.session.findUnique({ where: { tokenDigest: sessionDigest(token, settings.authSecret) }, select: { expiresAt: true, user: { select: userSelect } } });
      if (!session || session.expiresAt.getTime() <= Date.now()) return null;
      return userView(session.user);
    },

    async logout(token: string | null) {
      if (validSessionToken(token)) await db.session.deleteMany({ where: { tokenDigest: sessionDigest(token, settings.authSecret) } });
    },

    async adminProfile(token: string | null): Promise<UserView> {
      const user = await this.currentUser(token);
      requireRole(user, "ADMIN");
      return user!;
    },

    async updateAdminProfile(token: string | null, input: unknown): Promise<UserView> {
      const user = await this.adminProfile(token);
      const data = adminProfileSchema.parse(input);
      // ID comes exclusively from the resolved session; no target account parameter.
      const updated = await db.user.update({ where: { id: user.id, role: "ADMIN" }, data: { name: data.name }, select: userSelect });
      return userView(updated);
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
