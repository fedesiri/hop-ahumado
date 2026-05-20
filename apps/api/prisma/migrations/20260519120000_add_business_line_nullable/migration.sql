-- CreateTable BusinessLine
CREATE TABLE "BusinessLine" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessLine_slug_key" ON "BusinessLine"("slug");

-- AlterTable Category: add nullable businessLineId
ALTER TABLE "Category" ADD COLUMN "businessLineId" TEXT;

-- AlterTable Product: add nullable businessLineId
ALTER TABLE "Product" ADD COLUMN "businessLineId" TEXT;

-- AlterTable Expense: add nullable businessLineId
ALTER TABLE "Expense" ADD COLUMN "businessLineId" TEXT;

-- AlterTable TreasuryBaseline: add nullable businessLineId, change id default to uuid
ALTER TABLE "TreasuryBaseline" ADD COLUMN "businessLineId" TEXT;
ALTER TABLE "TreasuryBaseline" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- CreateIndex unique on TreasuryBaseline.businessLineId
CREATE UNIQUE INDEX "TreasuryBaseline_businessLineId_key" ON "TreasuryBaseline"("businessLineId");

-- AddForeignKey Category.businessLineId -> BusinessLine.id
ALTER TABLE "Category" ADD CONSTRAINT "Category_businessLineId_fkey" FOREIGN KEY ("businessLineId") REFERENCES "BusinessLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey Product.businessLineId -> BusinessLine.id
ALTER TABLE "Product" ADD CONSTRAINT "Product_businessLineId_fkey" FOREIGN KEY ("businessLineId") REFERENCES "BusinessLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey Expense.businessLineId -> BusinessLine.id
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_businessLineId_fkey" FOREIGN KEY ("businessLineId") REFERENCES "BusinessLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey TreasuryBaseline.businessLineId -> BusinessLine.id
ALTER TABLE "TreasuryBaseline" ADD CONSTRAINT "TreasuryBaseline_businessLineId_fkey" FOREIGN KEY ("businessLineId") REFERENCES "BusinessLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed BusinessLine rows
INSERT INTO "BusinessLine" ("id", "name", "slug", "createdAt")
VALUES
  (gen_random_uuid(), 'Cerveza Artesanal', 'BEER', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Carnes Ahumadas',   'MEAT', CURRENT_TIMESTAMP);
