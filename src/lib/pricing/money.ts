import { z } from "zod";
import { ApiError } from "../api/errors";
import { MAX_INTEGER } from "../catalog/validation";

const amount = z.number().int().min(0).max(MAX_INTEGER);
const linesSchema = z.array(z.strictObject({ unitPrice: amount.positive(), quantity: amount.positive() })).min(1);
export function boundedMoney(value: bigint) {
  if (value < 0n || value > BigInt(MAX_INTEGER)) throw new ApiError(409, "PRICE_TOTAL_LIMIT", "Nominal transaksi melampaui batas yang didukung.");
  return Number(value);
}
export function productSubtotal(input: unknown) {
  const lines = linesSchema.parse(input);
  return boundedMoney(lines.reduce((sum, line) => sum + BigInt(line.unitPrice) * BigInt(line.quantity), 0n));
}
// Fixed new-buyer policy: floor once on the entire products subtotal, never
// per line and never on shipping. BigInt division floors nonnegative Rupiah.
export function newBuyerDiscount(subtotal: number, eligible: boolean) {
  amount.parse(subtotal);
  if (!eligible) return 0;
  const percentageAmount = BigInt(subtotal) * 20n / 100n;
  return Number(percentageAmount > 100000n ? 100000n : percentageAmount);
}
// The discount must already be resolved by server policy, never request JSON.
export function payableTotal(subtotal: number, discount: number, shippingFee: number) {
  amount.positive().parse(subtotal); amount.parse(discount); amount.parse(shippingFee);
  if (discount > subtotal) throw new ApiError(409, "INVALID_DISCOUNT", "Diskon melebihi subtotal barang.");
  return boundedMoney(BigInt(subtotal) - BigInt(discount) + BigInt(shippingFee));
}
