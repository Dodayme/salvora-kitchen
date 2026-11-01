ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'READY_FOR_PICKUP';
ALTER TABLE "Order" DROP CONSTRAINT "Order_policy_and_deadline";
ALTER TABLE "Order" ADD CONSTRAINT "Order_policy_and_deadline" CHECK (
  "currency" = 'IDR' AND "paymentDeadline" > "createdAt" AND
  (("shippingMode" = 'MANUAL_DELIVERY' AND "shippingFee" = 10000) OR ("shippingMode" = 'PICKUP' AND "shippingFee" = 0))
);
