-- Preserve historical delivery snapshots; current delivery fees are set by checkout policy.
ALTER TABLE "Order" DROP CONSTRAINT "Order_policy_and_deadline";
ALTER TABLE "Order" ADD CONSTRAINT "Order_policy_and_deadline" CHECK (
  "currency" = 'IDR' AND "paymentDeadline" > "createdAt" AND
  ("shippingMode" = 'MANUAL_DELIVERY' OR ("shippingMode" = 'PICKUP' AND "shippingFee" = 0))
);
