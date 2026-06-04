-- AlterTable: add isConsignment to Order (default false for all existing rows)
ALTER TABLE "Order" ADD COLUMN "isConsignment" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: make price nullable in OrderItem (existing rows keep their values)
ALTER TABLE "OrderItem" ALTER COLUMN "price" DROP NOT NULL;
