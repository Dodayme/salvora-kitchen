const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const instant = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });
export function formatRupiah(value: number | null | undefined) {
  if (value == null) return "—";
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError("Nominal harus Rupiah bulat nonnegatif.");
  return rupiah.format(value);
}
export function formatTimestamp(value: string | Date | null | undefined) {
  if (value == null) return "—";
  if (typeof value === "string" && !/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(value)) throw new RangeError("Timestamp harus memiliki zona waktu eksplisit.");
  const date = typeof value === "string" ? new Date(value) : value;
  if (!Number.isFinite(date.getTime())) throw new RangeError("Timestamp tidak valid.");
  return instant.format(date);
}
