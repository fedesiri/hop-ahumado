-- CreateEnum
CREATE TYPE "RecipeType" AS ENUM ('PREPARACION_BASE', 'PRODUCTO_FINAL');

-- CreateTable
CREATE TABLE "IngredientProfile" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "purchaseQuantity" DOUBLE PRECISION,
    "purchasePrice" DECIMAL(65,30),
    "supplier" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngredientProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeCostProfile" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "recipeType" "RecipeType" NOT NULL,
    "saleUnitLabel" TEXT NOT NULL,
    "unitsPerPack" DOUBLE PRECISION,
    "packName" TEXT,
    "mainIngredientId" TEXT,
    "mainIngredientQty" DOUBLE PRECISION,
    "cookingLossPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kgPerSaleUnit" DOUBLE PRECISION,
    "yieldManual" DOUBLE PRECISION,
    "wastePct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "laborHoursPerBatch" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "marginRetailPct" DOUBLE PRECISION,
    "marginWholesalePct" DOUBLE PRECISION,
    "marginCateringPct" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipeCostProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationalParameters" (
    "id" TEXT NOT NULL,
    "businessLineId" TEXT NOT NULL,
    "workDaysPerMonth" DOUBLE PRECISION NOT NULL,
    "hoursPerShift" DOUBLE PRECISION NOT NULL,
    "capacityHoursPerMonth" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationalParameters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationalPartner" (
    "id" TEXT NOT NULL,
    "parametersId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "monthlySalary" DECIMAL(65,30) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "OperationalPartner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixedCostItem" (
    "id" TEXT NOT NULL,
    "parametersId" TEXT NOT NULL,
    "concept" TEXT NOT NULL,
    "monthlyCost" DECIMAL(65,30) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,

    CONSTRAINT "FixedCostItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelCommission" (
    "id" TEXT NOT NULL,
    "parametersId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "commissionPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "ChannelCommission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IngredientProfile_productId_key" ON "IngredientProfile"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeCostProfile_productId_key" ON "RecipeCostProfile"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "OperationalParameters_businessLineId_key" ON "OperationalParameters"("businessLineId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelCommission_parametersId_channel_key" ON "ChannelCommission"("parametersId", "channel");

-- AddForeignKey
ALTER TABLE "IngredientProfile" ADD CONSTRAINT "IngredientProfile_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeCostProfile" ADD CONSTRAINT "RecipeCostProfile_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeCostProfile" ADD CONSTRAINT "RecipeCostProfile_mainIngredientId_fkey" FOREIGN KEY ("mainIngredientId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalParameters" ADD CONSTRAINT "OperationalParameters_businessLineId_fkey" FOREIGN KEY ("businessLineId") REFERENCES "BusinessLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalPartner" ADD CONSTRAINT "OperationalPartner_parametersId_fkey" FOREIGN KEY ("parametersId") REFERENCES "OperationalParameters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedCostItem" ADD CONSTRAINT "FixedCostItem_parametersId_fkey" FOREIGN KEY ("parametersId") REFERENCES "OperationalParameters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelCommission" ADD CONSTRAINT "ChannelCommission_parametersId_fkey" FOREIGN KEY ("parametersId") REFERENCES "OperationalParameters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

