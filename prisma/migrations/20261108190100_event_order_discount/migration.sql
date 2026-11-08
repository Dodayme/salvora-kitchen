ALTER TABLE "Order" ADD COLUMN "eventPromotionId" TEXT REFERENCES "EventPromotion"("id") ON DELETE RESTRICT;
ALTER TABLE "Order" DROP CONSTRAINT "Order_money";
ALTER TABLE "Order" ADD CONSTRAINT "Order_money" CHECK (
 "subtotal" > 0 AND "discount" >= 0 AND "discount" <= "subtotal" AND "shippingFee" >= 0 AND "total" > 0 AND
 "total"::bigint = "subtotal"::bigint - "discount"::bigint + "shippingFee"::bigint AND
 ("discountId" IS NULL OR "eventPromotionId" IS NULL) AND
 ("discount" = 0 OR "discountId" IS NOT NULL OR "eventPromotionId" IS NOT NULL) AND
 ("discountId" IS NULL OR "discount" <= 100000)
);
CREATE FUNCTION protect_event_order_discount() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."eventPromotionId" IS DISTINCT FROM OLD."eventPromotionId" THEN
  RAISE EXCEPTION 'Order event promotion is immutable';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "Order_event_immutable" BEFORE UPDATE ON "Order" FOR EACH ROW EXECUTE FUNCTION protect_event_order_discount();
