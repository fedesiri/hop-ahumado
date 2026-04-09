-- CreateEnum
CREATE TYPE "CashLedgerDirection" AS ENUM ('IN', 'OUT');

-- CreateTable
CREATE TABLE "CashLedgerEntry" (
    "id" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "concept" TEXT NOT NULL,
    "category" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "direction" "CashLedgerDirection" NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "includeInCashFlow" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CashLedgerEntry_sourceKey_key" ON "CashLedgerEntry"("sourceKey");
