-- Backfill: assign all existing rows to the BEER business line
UPDATE "Product"
SET "businessLineId" = (SELECT "id" FROM "BusinessLine" WHERE "slug" = 'BEER')
WHERE "businessLineId" IS NULL;

UPDATE "Category"
SET "businessLineId" = (SELECT "id" FROM "BusinessLine" WHERE "slug" = 'BEER')
WHERE "businessLineId" IS NULL;

UPDATE "Expense"
SET "businessLineId" = (SELECT "id" FROM "BusinessLine" WHERE "slug" = 'BEER')
WHERE "businessLineId" IS NULL;

UPDATE "TreasuryBaseline"
SET "businessLineId" = (SELECT "id" FROM "BusinessLine" WHERE "slug" = 'BEER')
WHERE "businessLineId" IS NULL;

-- Insert MEAT TreasuryBaseline row (opening balances = 0)
INSERT INTO "TreasuryBaseline" ("id", "openingCash", "openingCard", "deltaSince", "updatedAt", "businessLineId")
VALUES (
  gen_random_uuid(),
  0,
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  (SELECT "id" FROM "BusinessLine" WHERE "slug" = 'MEAT')
);
