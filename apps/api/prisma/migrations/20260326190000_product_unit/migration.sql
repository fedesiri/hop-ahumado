CREATE TYPE "ProductUnit" AS ENUM ('UNIT', 'KG', 'G', 'L', 'ML');

ALTER TABLE "Product"
ADD COLUMN "unit" "ProductUnit" NOT NULL DEFAULT 'UNIT';
