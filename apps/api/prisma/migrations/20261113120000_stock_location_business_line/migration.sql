-- AlterTable
ALTER TABLE "StockLocation" ADD COLUMN "businessLineId" TEXT;

-- CreateIndex
CREATE INDEX "StockLocation_businessLineId_idx" ON "StockLocation"("businessLineId");

-- AddForeignKey
ALTER TABLE "StockLocation" ADD CONSTRAINT "StockLocation_businessLineId_fkey" FOREIGN KEY ("businessLineId") REFERENCES "BusinessLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
