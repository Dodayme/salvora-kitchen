-- Fresh Salvora schema only. Keep hand-written integrity SQL at the end.
BEGIN;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('BUYER', 'ADMIN');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('AWAITING_PAYMENT', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'EXPIRED', 'NEEDS_ATTENTION');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'PENDING', 'UNCONFIRMED', 'SUCCESS', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'REVERSED');

-- CreateEnum
CREATE TYPE "VoucherStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'USED');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('RESERVED', 'CONSUMED', 'RELEASED');

-- CreateEnum
CREATE TYPE "PaymentEventSource" AS ENUM ('SNAP_REQUEST', 'WEBHOOK', 'STATUS_API', 'SCHEDULER');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('VERIFIED', 'REJECTED', 'UNCONFIRMED');

-- CreateEnum
CREATE TYPE "HistoryActor" AS ENUM ('SYSTEM', 'ADMIN');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'BUYER',
    "isFirstPurchase" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "tokenDigest" CHAR(64) NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("tokenDigest")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" CHAR(64) NOT NULL,
    "count" INTEGER NOT NULL,
    "resetAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recipientName" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(32) NOT NULL,
    "addressLine" TEXT NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "province" VARCHAR(100) NOT NULL,
    "postalCode" VARCHAR(16),
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "physicalStock" INTEGER NOT NULL DEFAULT 0,
    "reservedStock" INTEGER NOT NULL DEFAULT 0,
    "imageUrl" TEXT,
    "photoKey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cart" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckoutQuote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "inputHash" CHAR(64) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckoutQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Discount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" VARCHAR(32) NOT NULL DEFAULT 'NEW_BUYER',
    "percentage" INTEGER NOT NULL DEFAULT 20,
    "maxDiscount" INTEGER NOT NULL DEFAULT 100000,
    "status" "VoucherStatus" NOT NULL DEFAULT 'AVAILABLE',
    "reservedOrderId" TEXT,
    "usedOrderId" TEXT,
    "usedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Discount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "number" VARCHAR(50) NOT NULL,
    "userId" TEXT NOT NULL,
    "discountId" TEXT,
    "idempotencyKey" VARCHAR(128) NOT NULL,
    "inputHash" CHAR(64) NOT NULL,
    "recipientName" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(32) NOT NULL,
    "addressLine" TEXT NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "province" VARCHAR(100) NOT NULL,
    "postalCode" VARCHAR(16),
    "addressNotes" TEXT,
    "subtotal" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "shippingFee" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'IDR',
    "shippingMode" VARCHAR(32) NOT NULL DEFAULT 'MANUAL_DELIVERY',
    "shippingLabel" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "paymentDeadline" TIMESTAMPTZ(3) NOT NULL,
    "attentionReason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "lineSubtotal" INTEGER NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockReservation" (
    "orderItemId" TEXT NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'RESERVED',
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "finalizedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockReservation_pkey" PRIMARY KEY ("orderItemId")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "providerOrderId" VARCHAR(50) NOT NULL,
    "provider" VARCHAR(16) NOT NULL DEFAULT 'MIDTRANS',
    "midtransTransactionId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'IDR',
    "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
    "providerStatus" TEXT,
    "channel" TEXT,
    "snapToken" TEXT,
    "snapRedirectUrl" TEXT,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "transactionTime" TIMESTAMPTZ(3),
    "paidAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentApplication" (
    "orderId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "appliedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentApplication_pkey" PRIMARY KEY ("orderId")
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "deduplicationKey" VARCHAR(128) NOT NULL,
    "source" "PaymentEventSource" NOT NULL,
    "providerStatus" TEXT,
    "resultingStatus" "PaymentStatus",
    "verification" "VerificationStatus" NOT NULL,
    "errorCode" VARCHAR(64),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rating" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderStatusHistory" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fromStatus" "OrderStatus",
    "toStatus" "OrderStatus" NOT NULL,
    "actor" "HistoryActor" NOT NULL,
    "actorUserId" TEXT,
    "note" TEXT,
    "changedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "RateLimit_resetAt_idx" ON "RateLimit"("resetAt");

-- CreateIndex
CREATE INDEX "Address_userId_createdAt_idx" ON "Address"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE INDEX "Product_categoryId_isActive_idx" ON "Product"("categoryId", "isActive");

-- CreateIndex
CREATE INDEX "Product_isActive_createdAt_idx" ON "Product"("isActive", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_userId_key" ON "Cart"("userId");

-- CreateIndex
CREATE INDEX "CartItem_productId_idx" ON "CartItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_cartId_productId_key" ON "CartItem"("cartId", "productId");

-- CreateIndex
CREATE INDEX "CheckoutQuote_userId_expiresAt_idx" ON "CheckoutQuote"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "CheckoutQuote_expiresAt_idx" ON "CheckoutQuote"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Discount_userId_key" ON "Discount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Discount_reservedOrderId_key" ON "Discount"("reservedOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Discount_usedOrderId_key" ON "Discount"("usedOrderId");

-- CreateIndex
CREATE INDEX "Discount_status_createdAt_idx" ON "Discount"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Discount_id_userId_key" ON "Discount"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Discount_reservedOrderId_userId_key" ON "Discount"("reservedOrderId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Discount_usedOrderId_userId_key" ON "Discount"("usedOrderId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_number_key" ON "Order"("number");

-- CreateIndex
CREATE INDEX "Order_userId_createdAt_id_idx" ON "Order"("userId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Order_status_paymentDeadline_idx" ON "Order"("status", "paymentDeadline");

-- CreateIndex
CREATE INDEX "Order_discountId_userId_idx" ON "Order"("discountId", "userId");

-- CreateIndex
CREATE INDEX "Order_createdAt_id_idx" ON "Order"("createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Order_id_userId_key" ON "Order"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_userId_idempotencyKey_key" ON "Order"("userId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Order_id_total_currency_key" ON "Order"("id", "total", "currency");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderItem_orderId_productId_key" ON "OrderItem"("orderId", "productId");

-- CreateIndex
CREATE INDEX "StockReservation_status_expiresAt_idx" ON "StockReservation"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerOrderId_key" ON "Payment"("providerOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_midtransTransactionId_key" ON "Payment"("midtransTransactionId");

-- CreateIndex
CREATE INDEX "Payment_orderId_createdAt_idx" ON "Payment"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_status_expiresAt_idx" ON "Payment"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "Payment_createdAt_id_idx" ON "Payment"("createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_id_orderId_key" ON "Payment"("id", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentApplication_paymentId_key" ON "PaymentApplication"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentApplication_paymentId_orderId_key" ON "PaymentApplication"("paymentId", "orderId");

-- CreateIndex
CREATE INDEX "PaymentEvent_paymentId_createdAt_idx" ON "PaymentEvent"("paymentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentEvent_paymentId_deduplicationKey_key" ON "PaymentEvent"("paymentId", "deduplicationKey");

-- CreateIndex
CREATE UNIQUE INDEX "Rating_orderItemId_key" ON "Rating"("orderItemId");

-- CreateIndex
CREATE INDEX "Rating_createdAt_id_idx" ON "Rating"("createdAt", "id");

-- CreateIndex
CREATE INDEX "OrderStatusHistory_orderId_changedAt_idx" ON "OrderStatusHistory"("orderId", "changedAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutQuote" ADD CONSTRAINT "CheckoutQuote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discount" ADD CONSTRAINT "Discount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discount" ADD CONSTRAINT "Discount_reservedOrderId_userId_fkey" FOREIGN KEY ("reservedOrderId", "userId") REFERENCES "Order"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discount" ADD CONSTRAINT "Discount_usedOrderId_userId_fkey" FOREIGN KEY ("usedOrderId", "userId") REFERENCES "Order"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_discountId_userId_fkey" FOREIGN KEY ("discountId", "userId") REFERENCES "Discount"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_amount_currency_fkey" FOREIGN KEY ("orderId", "amount", "currency") REFERENCES "Order"("id", "total", "currency") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentApplication" ADD CONSTRAINT "PaymentApplication_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentApplication" ADD CONSTRAINT "PaymentApplication_paymentId_orderId_fkey" FOREIGN KEY ("paymentId", "orderId") REFERENCES "Payment"("id", "orderId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CHECK constraints/partial indexes/triggers are maintained in SQL, not db push.
ALTER TABLE "User" ADD CONSTRAINT "User_normalized_email" CHECK ("email" = lower(btrim("email")) AND length("email") > 3);
ALTER TABLE "User" ADD CONSTRAINT "User_nonempty_name_hash" CHECK (length(btrim("name")) > 0 AND length("passwordHash") > 0);
ALTER TABLE "Session" ADD CONSTRAINT "Session_digest_expiry" CHECK ("tokenDigest" ~ '^[a-f0-9]{64}$' AND "expiresAt" > "createdAt");
ALTER TABLE "RateLimit" ADD CONSTRAINT "RateLimit_valid_counter" CHECK ("key" ~ '^[a-f0-9]{64}$' AND "count" > 0);
ALTER TABLE "Address" ADD CONSTRAINT "Address_required_values" CHECK (length(btrim("recipientName")) > 0 AND length(btrim("phone")) > 0 AND length(btrim("addressLine")) > 0 AND length(btrim("city")) > 0 AND length(btrim("province")) > 0);
ALTER TABLE "Category" ADD CONSTRAINT "Category_nonempty_name" CHECK (length(btrim("name")) > 0);
ALTER TABLE "Product" ADD CONSTRAINT "Product_valid_stock_price" CHECK ("price" > 0 AND "physicalStock" >= 0 AND "reservedStock" >= 0 AND "reservedStock" <= "physicalStock");
ALTER TABLE "Product" ADD CONSTRAINT "Product_nonempty_name" CHECK (length(btrim("name")) > 0);
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_positive_quantity" CHECK ("quantity" > 0);
ALTER TABLE "CheckoutQuote" ADD CONSTRAINT "CheckoutQuote_valid_hash_expiry" CHECK ("inputHash" ~ '^[a-f0-9]{64}$' AND "expiresAt" > "createdAt" AND jsonb_typeof("snapshot") = 'object');
ALTER TABLE "Discount" ADD CONSTRAINT "Discount_fixed_policy" CHECK ("type" = 'NEW_BUYER' AND "percentage" = 20 AND "maxDiscount" = 100000);
ALTER TABLE "Discount" ADD CONSTRAINT "Discount_state_links" CHECK (
  ("status" = 'AVAILABLE' AND "reservedOrderId" IS NULL AND "usedOrderId" IS NULL AND "usedAt" IS NULL) OR
  ("status" = 'RESERVED' AND "reservedOrderId" IS NOT NULL AND "usedOrderId" IS NULL AND "usedAt" IS NULL) OR
  ("status" = 'USED' AND "reservedOrderId" IS NULL AND "usedOrderId" IS NOT NULL AND "usedAt" IS NOT NULL)
);
ALTER TABLE "Order" ADD CONSTRAINT "Order_money" CHECK (
  "subtotal" > 0 AND "discount" >= 0 AND "discount" <= "subtotal" AND "discount" <= 100000 AND "shippingFee" >= 0 AND "total" > 0 AND
  "total"::bigint = "subtotal"::bigint - "discount"::bigint + "shippingFee"::bigint AND ("discountId" IS NOT NULL OR "discount" = 0)
);
ALTER TABLE "Order" ADD CONSTRAINT "Order_policy_and_deadline" CHECK ("currency" = 'IDR' AND "shippingMode" = 'MANUAL_DELIVERY' AND "paymentDeadline" > "createdAt");
ALTER TABLE "Order" ADD CONSTRAINT "Order_idempotency" CHECK ("idempotencyKey" ~ '^[A-Za-z0-9_-]{16,128}$' AND "inputHash" ~ '^[a-f0-9]{64}$');
ALTER TABLE "Order" ADD CONSTRAINT "Order_required_snapshot" CHECK (length(btrim("recipientName")) > 0 AND length(btrim("phone")) > 0 AND length(btrim("addressLine")) > 0 AND length(btrim("city")) > 0 AND length(btrim("province")) > 0 AND length(btrim("shippingLabel")) > 0);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_money_quantity" CHECK ("unitPrice" > 0 AND "quantity" > 0 AND "lineSubtotal"::bigint = "unitPrice"::bigint * "quantity"::bigint AND length(btrim("name")) > 0);
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_state" CHECK ("expiresAt" > "createdAt" AND (("status" = 'RESERVED' AND "finalizedAt" IS NULL) OR ("status" IN ('CONSUMED','RELEASED') AND "finalizedAt" IS NOT NULL)));
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_policy_amount_expiry" CHECK ("provider" = 'MIDTRANS' AND "currency" = 'IDR' AND "amount" > 0 AND "expiresAt" > "createdAt" AND ("status" <> 'SUCCESS' OR "paidAt" IS NOT NULL));
CREATE UNIQUE INDEX "Payment_one_potentially_payable_per_order" ON "Payment" ("orderId") WHERE "status" IN ('CREATED','PENDING','UNCONFIRMED');
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_nonempty_deduplication" CHECK (length(btrim("deduplicationKey")) > 0);
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_range" CHECK ("rating" BETWEEN 1 AND 5 AND length(btrim("comment")) > 0);
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_actor" CHECK (("actor" = 'SYSTEM' AND "actorUserId" IS NULL) OR ("actor" = 'ADMIN' AND "actorUserId" IS NOT NULL));

-- Snapshot values and original deadline cannot follow mutable account/catalog data.
CREATE FUNCTION salvora_order_snapshot_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW."id",NEW."number",NEW."userId",NEW."discountId",NEW."idempotencyKey",NEW."inputHash",NEW."recipientName",NEW."phone",NEW."addressLine",NEW."city",NEW."province",NEW."postalCode",NEW."addressNotes",NEW."subtotal",NEW."discount",NEW."shippingFee",NEW."total",NEW."currency",NEW."shippingMode",NEW."shippingLabel",NEW."paymentDeadline",NEW."createdAt")
     IS DISTINCT FROM
     ROW(OLD."id",OLD."number",OLD."userId",OLD."discountId",OLD."idempotencyKey",OLD."inputHash",OLD."recipientName",OLD."phone",OLD."addressLine",OLD."city",OLD."province",OLD."postalCode",OLD."addressNotes",OLD."subtotal",OLD."discount",OLD."shippingFee",OLD."total",OLD."currency",OLD."shippingMode",OLD."shippingLabel",OLD."paymentDeadline",OLD."createdAt") THEN
    RAISE EXCEPTION 'Order snapshot is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "Order_snapshot_immutable" BEFORE UPDATE ON "Order" FOR EACH ROW EXECUTE FUNCTION salvora_order_snapshot_immutable();

CREATE FUNCTION salvora_order_item_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Order item snapshot is immutable' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "OrderItem_snapshot_immutable" BEFORE UPDATE ON "OrderItem" FOR EACH ROW EXECUTE FUNCTION salvora_order_item_immutable();

CREATE FUNCTION salvora_payment_application_verified() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "Payment" WHERE "id" = NEW."paymentId" AND "orderId" = NEW."orderId" AND "status" = 'SUCCESS' AND "paidAt" IS NOT NULL) THEN
    RAISE EXCEPTION 'Payment application requires verified success record' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "PaymentApplication_requires_success" BEFORE INSERT OR UPDATE ON "PaymentApplication" FOR EACH ROW EXECUTE FUNCTION salvora_payment_application_verified();

COMMIT;
