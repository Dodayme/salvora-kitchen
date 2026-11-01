import { createHmac, randomBytes } from "node:crypto";

export const SESSION_COOKIE = "salvora_session";
export const validSessionToken = (token: string | null | undefined): token is string => Boolean(token && /^[a-f0-9]{64}$/.test(token));
export const newSessionToken = () => randomBytes(32).toString("hex");
export const sessionDigest = (token: string, secret: string) => createHmac("sha256", secret).update(token).digest("hex");

// Opaque tokens use only lowercase hex; reject malformed or ambiguous duplicate cookies.
export function sessionToken(request: Request): string | null {
  const values = (request.headers.get("cookie") ?? "").split(";").map(value => value.trim()).filter(value => value.startsWith(`${SESSION_COOKIE}=`));
  if (values.length !== 1) return null;
  const token = values[0].slice(SESSION_COOKIE.length + 1);
  return validSessionToken(token) ? token : null;
}
