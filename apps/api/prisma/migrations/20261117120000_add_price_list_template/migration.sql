-- CreateTable
CREATE TABLE "PriceListTemplate" (
    "id" TEXT NOT NULL,
    "businessLineId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imagePath" TEXT NOT NULL,
    "imageWidth" INTEGER NOT NULL,
    "imageHeight" INTEGER NOT NULL,
    "slots" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceListTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PriceListTemplate_businessLineId_idx" ON "PriceListTemplate"("businessLineId");

-- AddForeignKey
ALTER TABLE "PriceListTemplate" ADD CONSTRAINT "PriceListTemplate_businessLineId_fkey" FOREIGN KEY ("businessLineId") REFERENCES "BusinessLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
