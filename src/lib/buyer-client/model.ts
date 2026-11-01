import { z } from "zod";
import { phoneSchema } from "@/lib/contracts/phone";
import { ApiClientError } from "@/lib/http/client";
const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const text = (max: number) => z.string().trim().min(1).max(max).refine(value => !value.includes("\u0000"));
export const addressInput = z.object({
  recipientName: text(100), phone: phoneSchema,
  addressLine: text(2000), city: text(100), province: text(100), postalCode: text(16).nullable(), notes: text(1000).nullable(),
});
// Existing addresses must remain readable/editable even if their old phone needs correction.
const address = addressInput.extend({ id, phone: text(32) });
export type Address = z.infer<typeof address>;
export type AddressDraft = Record<Exclude<keyof Address, "id">, string>;
export const emptyAddress: AddressDraft = { recipientName: "", phone: "", addressLine: "", city: "", province: "Kepulauan Riau", postalCode: "", notes: "" };
export const addressLabels: Record<keyof AddressDraft, string> = { recipientName: "Nama penerima", phone: "Nomor telepon", addressLine: "Alamat lengkap", city: "Kota/kabupaten", province: "Provinsi", postalCode: "Kode pos (opsional)", notes: "Catatan (opsional)" };
export function addressPayload(draft: AddressDraft) { return addressInput.safeParse({ ...draft, postalCode: draft.postalCode.trim() || null, notes: draft.notes.trim() || null }); }
export const decodeAddress = (value: unknown) => address.parse(value);
export const decodeAddresses = (value: unknown) => z.array(address).parse(value);
export const decodeNull = (value: unknown) => z.null().parse(value);
const voucher = z.object({ id, type: z.literal("NEW_BUYER"), percentage: z.literal(20), maxDiscount: z.literal(100000), status: z.enum(["AVAILABLE", "RESERVED", "USED"]), reservedOrderId: id.nullable(), usedAt: z.iso.datetime().nullable() });
export const decodeVoucher = (value: unknown) => z.object({ voucher: voucher.nullable() }).parse(value);
export const voucherCopy = {
  AVAILABLE: { title: "Tersedia", text: "Voucher belum direservasi. Kelayakan dan diskon akhir diperiksa saat checkout." },
  RESERVED: { title: "Direservasi", text: "Voucher sedang terkait dengan pesanan. Status diperbarui oleh server; tidak dapat dipakai untuk pesanan lain saat ini." },
  USED: { title: "Sudah digunakan", text: "Voucher pembeli baru telah digunakan dan tidak dapat digunakan kembali." },
};
export function mutationRecovery(error: unknown) {
  if (!(error instanceof ApiClientError) || error.kind === "network" || error.kind === "protocol" || error.status >= 500) return "uncertain";
  if ([404, 409].includes(error.status)) return "refresh";
  return "retry";
}
