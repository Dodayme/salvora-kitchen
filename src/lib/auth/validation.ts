import { z } from "zod";

export const displayName = z.string().trim().min(2).max(100);
const email = z.string().trim().toLowerCase().pipe(z.email().max(254));
const password = z.string().min(8).max(72)
  .refine(value => [...value].length >= 8, "Kata sandi minimal 8 karakter.")
  .refine(value => Buffer.byteLength(value, "utf8") <= 72, "Kata sandi maksimal 72 byte UTF-8.");

export const loginSchema = z.strictObject({ email, password });
export const registerSchema = z.strictObject({ name: displayName, email, password, confirmPassword: z.string().max(72) })
  .refine(value => value.password === value.confirmPassword, { path: ["confirmPassword"], message: "Konfirmasi kata sandi tidak cocok." });
export const adminProfileSchema = z.strictObject({ name: displayName });
export const emptyObjectSchema = z.strictObject({});
