import { expect, it } from "vitest";
import { promotionInput, eventDiscount } from "../src/lib/promotions/model";
import { createPromotion } from "../src/services/promotions";
import type { PrismaClient } from "../src/generated/prisma/client";
const input = { name: "Event", percentage: 30, maxDiscount: 50000, startsAt: "2026-11-01T00:00:00+07:00", endsAt: "2026-12-01T00:00:00+07:00", audience: "ALL", emails: [] };
it("validates period, audience and money", () => {
 expect(promotionInput.safeParse(input).success).toBe(true);
 for (const patch of [{ endsAt: input.startsAt }, { percentage: 100 }, { percentage: 0 }, { maxDiscount: -1 }, { audience: "SELECTED" }, { emails: ["bad"] }]) expect(promotionInput.safeParse({ ...input, ...patch }).success).toBe(false);
});
it("floors once and caps without overflow", () => {
 expect(eventDiscount(10003, 30, 50000)).toBe(3000);
 expect(eventDiscount(1000000, 30, 50000)).toBe(50000);
 expect(eventDiscount(2147483647, 99, 2147483647)).toBe(2126008810);
});
it("rejects anonymous and buyer creation before accessing database", async () => {
 const db = {} as PrismaClient;
 await expect(createPromotion(db, null, input)).rejects.toMatchObject({ status: 401 });
 await expect(createPromotion(db, { id: "buyer", role: "BUYER" }, input)).rejects.toMatchObject({ status: 403 });
});
