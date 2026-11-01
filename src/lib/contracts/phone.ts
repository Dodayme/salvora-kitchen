import { z } from "zod";

// Count digits, not separators. Accept local and international contact formatting.
export const phoneSchema = z.string().trim().max(32)
  .regex(/^\+?[0-9 ()-]+$/, "Gunakan angka untuk nomor telepon.")
  .refine(value => {
    const digits = value.replace(/\D/g, "");
    return digits.length >= 8 && digits.length <= 15;
  }, "Nomor telepon harus berisi 8–15 digit.")
  .transform(value => value.replace(/[ ()-]/g, ""));
