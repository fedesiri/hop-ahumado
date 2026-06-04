-- AlterTable: add cancelledAt to Order
ALTER TABLE "Order" ADD COLUMN "cancelledAt" TIMESTAMP(3);

-- AlterTable: add originalQuantity to OrderItem
ALTER TABLE "OrderItem" ADD COLUMN "originalQuantity" DOUBLE PRECISION;
