CREATE TABLE "TreasuryBaseline" (
    "id" TEXT NOT NULL,
    "openingCash" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "openingCard" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "deltaSince" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TreasuryBaseline_pkey" PRIMARY KEY ("id")
);
