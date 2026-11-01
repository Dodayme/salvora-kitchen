import { ApiError } from "../api/errors";

export const PAYMENT_EXPIRY_MINUTES = 60;
export const QUOTE_TTL_MINUTES = 5;
const normalize = (value: string) => value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("id-ID");
export function deliveryPolicy(address: { city: string; province: string }) {
  if (!["tanjungpinang", "tanjung pinang", "kota tanjungpinang", "kota tanjung pinang"].includes(normalize(address.city)) || normalize(address.province) !== "kepulauan riau") {
    throw new ApiError(422, "DELIVERY_UNAVAILABLE", "Delivery manual hanya melayani Kota Tanjungpinang, Kepulauan Riau.");
  }
  return { fee: 10000, mode: "MANUAL_DELIVERY" as const, label: "Delivery manual Kota Tanjungpinang, Kepulauan Riau — Rp10.000 per pesanan", policyVersion: "tanjungpinang-10000-v1" };
}
