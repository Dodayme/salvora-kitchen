CREATE TABLE "EventPromotion" (
 "id" TEXT PRIMARY KEY, "name" VARCHAR(100) NOT NULL,
 "percentage" INTEGER NOT NULL CHECK ("percentage" BETWEEN 1 AND 99),
 "maxDiscount" INTEGER NOT NULL CHECK ("maxDiscount" > 0),
 "startsAt" TIMESTAMPTZ(3) NOT NULL, "endsAt" TIMESTAMPTZ(3) NOT NULL,
 "recipientIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
 "isActive" BOOLEAN NOT NULL DEFAULT true,
 "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK ("endsAt" > "startsAt")
);
