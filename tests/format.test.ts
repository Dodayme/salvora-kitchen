import { describe, expect, it } from "vitest";
import { formatRupiah, formatTimestamp } from "@/lib/format";

describe("Display formatting", () => {
  it("keeps missing amounts distinct from zero and formats integer IDR", () => {
    expect(formatRupiah(null)).toBe("—"); expect(formatRupiah(undefined)).toBe("—");
    expect(formatRupiah(0).replace(/\s/g, "")).toBe("Rp0");
    expect(formatRupiah(14000).replace(/\s/g, "")).toBe("Rp14.000");
  });
  it.each([-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])("rejects invalid monetary value %s", value => {
    expect(() => formatRupiah(value)).toThrow(RangeError);
  });
  it("uses Asia/Jakarta across UTC date boundaries", () => {
    const output = formatTimestamp("2026-10-23T18:30:00Z");
    expect(output).toContain("24 Okt 2026"); expect(output).toContain("01.30");
    expect(formatTimestamp(new Date("2026-10-24T01:30:00+07:00"))).toBe(output);
  });
  it("preserves absent dates and rejects dates without timezone or invalid values", () => {
    expect(formatTimestamp(null)).toBe("—"); expect(formatTimestamp(undefined)).toBe("—");
    for (const value of ["2026-10-24", "2026-10-24T01:00:00", "invalid", new Date(NaN)]) expect(() => formatTimestamp(value)).toThrow(RangeError);
  });
});
