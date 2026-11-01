import type { UserView } from "@/lib/contracts/user";
import { ApiClientError, type FieldIssue } from "@/lib/http/client";

export type AuthFields = { name: string; email: string; password: string; confirmPassword: string };
export type AuthField = keyof AuthFields;
export type AuthFieldErrors = Partial<Record<AuthField, string>>;
export type AuthMode = "login" | "register";
export const roleHome = (role: UserView["role"]) => role === "ADMIN" ? "/admin" : "/";

/** Allow known UI routes only. Never propagate payment/token/search data through auth URLs. */
export function safeReturnTo(value: unknown, role?: UserView["role"]): string | null {
  if (typeof value !== "string" || value.length > 1024 || !value.startsWith("/") || value.startsWith("//") || /[\\\s\x00-\x1f\x7f%]/.test(value)) return null;
  const url = new URL(value, "https://salvora.invalid");
  if (url.origin !== "https://salvora.invalid" || url.pathname !== value.split(/[?#]/)[0]) return null;
  const path = url.pathname;
  const common = path === "/" || path === "/payment/finish" || /^\/menu(?:\/[A-Za-z0-9_-]+)?$/.test(path);
  const buyer = /^\/(akun|alamat|keranjang|checkout|pesanan)(?:\/[A-Za-z0-9_-]+)?$/.test(path) || /^\/pembayaran\/[A-Za-z0-9_-]{1,128}$/.test(path);
  const admin = /^\/admin(?:\/(produk|kategori|pesanan|pembayaran|voucher|akun)(?:\/[A-Za-z0-9_-]+)?)?$/.test(path);
  if (!common && !buyer && !admin || role === "ADMIN" && buyer || role === "BUYER" && admin) return null;
  // Keep only harmless catalog filters; account/order/payment state is never copied to a URL.
  if (url.search && !/^\/menu$/.test(path)) return null;
  for (const [key, entry] of url.searchParams) {
    if (key === "page" ? !/^[1-9]\d{0,5}$/.test(entry) : key === "categoryId" ? !/^[A-Za-z0-9_-]{1,128}$/.test(entry) : true) return null;
    if (url.searchParams.getAll(key).length > 1) return null;
  }
  if (url.hash && !(path.startsWith("/menu/") && url.hash === "#ulasan")) return null;
  return path + url.search + url.hash;
}
export const authDestination = (user: UserView, requested: unknown) => safeReturnTo(requested, user.role) ?? roleHome(user.role);

export function decodeSession(data: unknown): { user: UserView | null } {
  if (!data || typeof data !== "object" || !("user" in data)) throw Error("Invalid session DTO");
  const user = data.user;
  if (user === null) return { user: null };
  if (!user || typeof user !== "object" || !("id" in user) || !("name" in user) || !("email" in user) || !("role" in user) || typeof user.id !== "string" || !user.id || user.id.length > 128 || typeof user.name !== "string" || Array.from(user.name).length > 100 || typeof user.email !== "string" || user.email.length > 254 || (user.role !== "BUYER" && user.role !== "ADMIN")) throw Error("Invalid user DTO");
  return { user: { id: user.id, name: user.name, email: user.email, role: user.role } };
}

export function validateAuthFields(mode: AuthMode, fields: AuthFields): AuthFieldErrors {
  const errors: AuthFieldErrors = {};
  if (mode === "register" && (fields.name.trim().length < 2 || fields.name.trim().length > 100)) errors.name = "Nama lengkap harus 2–100 karakter.";
  const email = fields.email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) errors.email = "Masukkan alamat email yang valid.";
  if ([...fields.password].length < 8 || fields.password.length > 72 || new TextEncoder().encode(fields.password).length > 72) errors.password = "Kata sandi minimal 8 karakter dan maksimal 72 byte UTF-8.";
  if (mode === "register" && fields.confirmPassword !== fields.password) errors.confirmPassword = "Konfirmasi kata sandi tidak cocok.";
  return errors;
}
export function authFieldIssues(fields: FieldIssue[]): AuthFieldErrors {
  const result: AuthFieldErrors = {};
  const labels: Record<AuthField, string> = { name: "Periksa nama lengkap (2–100 karakter).", email: "Periksa format email Anda.", password: "Periksa kata sandi (minimal 8 karakter, maksimal 72 byte UTF-8).", confirmPassword: "Konfirmasi kata sandi harus sama." };
  for (const issue of fields) if (Object.hasOwn(labels, issue.path)) result[issue.path as AuthField] = labels[issue.path as AuthField];
  return result;
}
export function authErrorMessage(error: unknown): string {
  if (!(error instanceof ApiClientError)) return "Permintaan belum dapat diselesaikan. Silakan periksa sesi Anda.";
  if (error.code === "INVALID_CREDENTIALS") return "Email atau kata sandi salah.";
  if (error.code === "EMAIL_EXISTS") return "Email sudah terdaftar. Silakan masuk dengan akun Anda.";
  return error.message;
}
