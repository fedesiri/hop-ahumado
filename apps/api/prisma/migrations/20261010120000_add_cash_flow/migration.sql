-- CreateEnum
CREATE TYPE "CashMovementType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "CashClassification" AS ENUM ('OPERATING', 'INVESTMENT');

-- CreateEnum
CREATE TYPE "CashMovementStatus" AS ENUM ('SETTLED', 'PENDING');

-- CreateTable
CREATE TABLE "CashMovement" (
    "id" TEXT NOT NULL,
    "businessLineId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "CashMovementType" NOT NULL,
    "category" TEXT NOT NULL,
    "classification" "CashClassification" NOT NULL,
    "description" TEXT NOT NULL,
    "counterparty" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "paymentMethod" TEXT,
    "status" "CashMovementStatus" NOT NULL DEFAULT 'SETTLED',
    "payer" TEXT NOT NULL DEFAULT 'Caja Alumo',
    "reimbursementStatus" TEXT,
    "notes" TEXT,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "externalKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashSnapshot" (
    "id" TEXT NOT NULL,
    "businessLineId" TEXT NOT NULL,
    "cash" DECIMAL(65,30) NOT NULL,
    "wallet" DECIMAL(65,30) NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CashMovement_externalKey_key" ON "CashMovement"("externalKey");

-- CreateIndex
CREATE INDEX "CashMovement_businessLineId_date_idx" ON "CashMovement"("businessLineId", "date");

-- CreateIndex
CREATE INDEX "CashSnapshot_businessLineId_asOf_idx" ON "CashSnapshot"("businessLineId", "asOf");

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_businessLineId_fkey" FOREIGN KEY ("businessLineId") REFERENCES "BusinessLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSnapshot" ADD CONSTRAINT "CashSnapshot_businessLineId_fkey" FOREIGN KEY ("businessLineId") REFERENCES "BusinessLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

