import { z } from "zod";
import { ApiError } from "../api/errors";
import { PAYMENT_EXPIRY_MINUTES } from "../checkout/policy";

export type Environment = Record<string, string | undefined>;
const configured = (name: string): never => {
  throw new ApiError(503, "ENV_NOT_CONFIGURED", `Konfigurasi ${name} belum lengkap atau tidak valid.`);
};

export function databaseUrl(source: Environment, kind: "app" | "test" | "shadow" = "app") {
  const name = kind === "test" ? "TEST_DATABASE_URL" : kind === "shadow" ? "SHADOW_DATABASE_URL" : "DATABASE_URL";
  const value = source[name];
  if (!value || /REPLACE|PLACEHOLDER/i.test(value)) return configured(name);
  try {
    const url = new URL(value);
    const database = decodeURIComponent(url.pathname.slice(1));
    const allowed = kind === "test" ? ["salvora_kitchen_test"] : kind === "shadow" ? ["salvora_kitchen_shadow"] : ["salvora_kitchen_dev", "salvora_kitchen_demo"];
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || !allowed.includes(database)) return configured(name);
    // Never let a runtime test accidentally connect to the development database.
    if (kind === "app" && source.NODE_ENV === "test") return configured(name);
    // Query parameters must not override the database/host/user validated above.
    const allowedOptions = ["sslmode", "sslrootcert", "connect_timeout", "application_name", "schema", "connection_limit", "pool_timeout"];
    if ([...url.searchParams.keys()].some(key => !allowedOptions.includes(key))) return configured(name);
    return value;
  } catch {
    return configured(name);
  }
}

export function appConfig(source: Environment) {
  const database = databaseUrl(source, source.NODE_ENV === "test" ? "test" : "app");
  const secret = z.string().min(32).safeParse(source.AUTH_SECRET);
  if (!secret.success || /REPLACE|PLACEHOLDER/i.test(secret.data)) return configured("AUTH_SECRET");
  let origin: string;
  try {
    const url = new URL(source.NEXT_PUBLIC_APP_URL ?? "");
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash || (source.NODE_ENV === "production" && url.protocol !== "https:")) return configured("NEXT_PUBLIC_APP_URL");
    origin = url.origin;
  } catch { return configured("NEXT_PUBLIC_APP_URL"); }
  if (source.MIDTRANS_IS_PRODUCTION && source.MIDTRANS_IS_PRODUCTION !== "false") return configured("MIDTRANS_IS_PRODUCTION");
  return { databaseUrl: database, authSecret: secret.data, appUrl: origin, sessionTtlDays: 7 as const };
}

export function snapConfig(source: Environment) {
  const base = appConfig(source);
  if (source.MIDTRANS_IS_PRODUCTION !== "false") return configured("MIDTRANS_IS_PRODUCTION");
  const serverKey = source.MIDTRANS_SERVER_KEY;
  const clientKey = source.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY;
  if (!serverKey?.startsWith("SB-Mid-server-") || /REPLACE/i.test(serverKey)) return configured("MIDTRANS_SERVER_KEY");
  if (!clientKey?.startsWith("SB-Mid-client-") || /REPLACE/i.test(clientKey)) return configured("NEXT_PUBLIC_MIDTRANS_CLIENT_KEY");
  const expiry = z.coerce.number().pipe(z.literal(PAYMENT_EXPIRY_MINUTES)).safeParse(source.PAYMENT_EXPIRY_MINUTES);
  if (!expiry.success) return configured("PAYMENT_EXPIRY_MINUTES");
  const notificationUrl = source.MIDTRANS_WEBHOOK_URL || undefined;
  if (notificationUrl) {
    try {
      const url = new URL(notificationUrl);
      if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/api/webhooks/midtrans") return configured("MIDTRANS_WEBHOOK_URL");
    } catch { return configured("MIDTRANS_WEBHOOK_URL"); }
  }
  return { serverKey, clientKey, appUrl: base.appUrl, notificationUrl, expiryMinutes: expiry.data, isProduction: false as const };
}

export function paymentConfig(source: Environment) {
  const snap = snapConfig(source);
  const webhookUrl = `${snap.appUrl}/api/webhooks/midtrans`;
  if (!webhookUrl.startsWith("https://") || source.MIDTRANS_WEBHOOK_URL !== webhookUrl) return configured("MIDTRANS_WEBHOOK_URL");
  return { ...snap, webhookUrl };
}
