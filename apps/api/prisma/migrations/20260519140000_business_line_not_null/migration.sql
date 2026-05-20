-- Make businessLineId NOT NULL on all tables (backfill already done)
ALTER TABLE "Product" ALTER COLUMN "businessLineId" SET NOT NULL;
ALTER TABLE "Category" ALTER COLUMN "businessLineId" SET NOT NULL;
ALTER TABLE "Expense" ALTER COLUMN "businessLineId" SET NOT NULL;
ALTER TABLE "TreasuryBaseline" ALTER COLUMN "businessLineId" SET NOT NULL;

-- Add indexes for query performance
CREATE INDEX "Product_businessLineId_idx" ON "Product"("businessLineId");
CREATE INDEX "Expense_businessLineId_idx" ON "Expense"("businessLineId");
