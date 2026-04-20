-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "comment" TEXT;

-- AlterTable
ALTER TABLE "RecipeItem" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TreasuryBaseline" ALTER COLUMN "id" SET DEFAULT 'singleton';
