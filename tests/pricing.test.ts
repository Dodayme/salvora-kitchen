import { describe, expect, it } from "vitest";
import { newBuyerDiscount, payableTotal, productSubtotal } from "../src/lib/pricing/money";

describe("Aritmetika nominal server", () => {
  it("diskon 20% sesuai contoh PRD dengan cap Rp100.000", () => {
    for (const [subtotal, discount] of [[30000, 6000], [300000, 60000], [499999, 99999], [500000, 100000], [500001, 100000], [1000000, 100000], [2147483647, 100000]]) expect(newBuyerDiscount(subtotal, true)).toBe(discount);
  });
  it("membulatkan ke bawah pada subtotal keseluruhan tanpa minimum tambahan", () => {
    for (const [subtotal, discount] of [[0, 0], [1, 0], [4, 0], [5, 1], [10001, 2000], [10003, 2000], [10004, 2000], [10005, 2001]]) expect(newBuyerDiscount(subtotal, true)).toBe(discount);
    const subtotal = productSubtotal([{ unitPrice: 10003, quantity: 1 }, { unitPrice: 10004, quantity: 1 }]);
    expect(newBuyerDiscount(subtotal, true)).toBe(4001);
  });
  it("tanpa voucher layak diskon nol; ongkir tidak ikut mendapat diskon", () => {
    expect(newBuyerDiscount(500000, false)).toBe(0);
    expect(payableTotal(10003, newBuyerDiscount(10003, true), 10000)).toBe(18003);
    for (const subtotal of [-1, 0.5, NaN, Infinity, 2147483648]) expect(() => newBuyerDiscount(subtotal, true)).toThrow();
  });
  it("subtotal menjumlah harga kali jumlah dengan integer Rupiah", () => {
    expect(productSubtotal([{ unitPrice: 10003, quantity: 3 }, { unitPrice: 20001, quantity: 2 }])).toBe(70011);
  });
  it("ongkir ditambahkan setelah potongan barang", () => {
    expect(payableTotal(30000, 6000, 10000)).toBe(34000);
    expect(payableTotal(30000, 0, 10000)).toBe(40000);
  });
  it("menolak input kosong, negatif/pecahan/string dan diskon melebihi barang", () => {
    for (const input of [[], [{ unitPrice: 0, quantity: 1 }], [{ unitPrice: 1, quantity: -1 }], [{ unitPrice: 1.5, quantity: 1 }], [{ unitPrice: "1000", quantity: 1 }]]) expect(() => productSubtotal(input)).toThrow();
    expect(() => payableTotal(100, 101, 0)).toThrow();
    expect(() => payableTotal(100, 0, -1)).toThrow();
  });
  it("menolak perkalian/penjumlahan melampaui INTEGER tanpa overflow floating point", () => {
    expect(productSubtotal([{ unitPrice: 2147483647, quantity: 1 }])).toBe(2147483647);
    expect(() => productSubtotal([{ unitPrice: 2147483647, quantity: 2147483647 }])).toThrow();
    expect(() => productSubtotal([{ unitPrice: 2147483647, quantity: 1 }, { unitPrice: 1, quantity: 1 }])).toThrow();
    expect(() => payableTotal(2147483647, 0, 1)).toThrow();
    expect(payableTotal(2147483647, 100000, 100000)).toBe(2147483647);
  });
});
