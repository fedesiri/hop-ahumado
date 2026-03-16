/*
  Warnings:

  - You are about to drop the column `email` on the `Customer` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `Customer` table. All the data in the column will be lost.
  - You are about to drop the column `note` on the `CustomerInteraction` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `CustomerInteraction` table. All the data in the column will be lost.
  - You are about to drop the column `company` on the `CustomerProfile` table. All the data in the column will be lost.
  - You are about to drop the column `lastContactAt` on the `CustomerProfile` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `Customer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `CustomerProfile` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "InteractionChannel" AS ENUM ('CALL', 'EMAIL', 'WHATSAPP', 'MEETING', 'OTHER');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
DROP COLUMN "email",
DROP COLUMN "phone";

-- AlterTable
ALTER TABLE "CustomerInteraction" ADD COLUMN "channel" "InteractionChannel",
ADD COLUMN     "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "nextStep" TEXT,
ADD COLUMN     "notes" TEXT;
UPDATE "CustomerInteraction" SET "notes" = "note" WHERE "note" IS NOT NULL;
ALTER TABLE "CustomerInteraction" DROP COLUMN "note",
DROP COLUMN "type";

-- AlterTable
ALTER TABLE "CustomerProfile" ADD COLUMN "contactName" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "generalNotes" TEXT,
ADD COLUMN     "nextFollowUpAt" TIMESTAMP(3),
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
DROP COLUMN "company",
DROP COLUMN "lastContactAt";

-- CreateTable
CREATE TABLE "CustomerOpportunity" (
    "id" TEXT NOT NULL,
    "customerProfileId" TEXT NOT NULL,
    "stage" TEXT,
    "estimatedValue" DECIMAL(65,30),
    "expectedClosingDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerOpportunity_customerProfileId_key" ON "CustomerOpportunity"("customerProfileId");

-- AddForeignKey
ALTER TABLE "CustomerOpportunity" ADD CONSTRAINT "CustomerOpportunity_customerProfileId_fkey" FOREIGN KEY ("customerProfileId") REFERENCES "CustomerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
