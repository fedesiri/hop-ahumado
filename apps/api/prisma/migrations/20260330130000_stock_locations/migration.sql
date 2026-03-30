-- Stock por ubicación (StockLocation) + traslados (TRANSFER)

ALTER TYPE "StockMovementType" ADD VALUE 'TRANSFER';

CREATE TABLE "StockLocation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockLocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockBalance" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "StockBalance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StockBalance_productId_locationId_key" ON "StockBalance"("productId", "locationId");

ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "StockLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StockMovement" ADD COLUMN "locationId" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN "fromLocationId" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN "toLocationId" TEXT;

ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "StockLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "StockLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "StockLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Order" ADD COLUMN "fulfillmentLocationId" TEXT;
ALTER TABLE "Order" ADD CONSTRAINT "Order_fulfillmentLocationId_fkey" FOREIGN KEY ("fulfillmentLocationId") REFERENCES "StockLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "StockLocation" ("id", "name", "isDefault", "createdAt")
VALUES ('00000000-0000-0000-0000-000000000001', 'Principal', true, CURRENT_TIMESTAMP);

INSERT INTO "StockBalance" ("id", "productId", "locationId", "quantity")
SELECT gen_random_uuid()::text, p."id", '00000000-0000-0000-0000-000000000001', p."stock"
FROM "Product" p;

UPDATE "StockMovement" SET "locationId" = '00000000-0000-0000-0000-000000000001' WHERE "locationId" IS NULL;

UPDATE "Order" SET "fulfillmentLocationId" = '00000000-0000-0000-0000-000000000001' WHERE "fulfillmentLocationId" IS NULL;
