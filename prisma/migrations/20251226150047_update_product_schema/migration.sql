/*
  Warnings:

  - You are about to drop the column `emiExample` on the `LoanProduct` table. All the data in the column will be lost.
  - You are about to drop the column `processingTime` on the `LoanProduct` table. All the data in the column will be lost.
  - Added the required column `aprText` to the `LoanProduct` table without a default value. This is not possible if the table is not empty.
  - Added the required column `emiAmount` to the `LoanProduct` table without a default value. This is not possible if the table is not empty.
  - Added the required column `processTimeLabel` to the `LoanProduct` table without a default value. This is not possible if the table is not empty.
  - Added the required column `processTimeValue` to the `LoanProduct` table without a default value. This is not possible if the table is not empty.
  - Added the required column `processTypeLabel` to the `LoanProduct` table without a default value. This is not possible if the table is not empty.
  - Added the required column `processTypeValue` to the `LoanProduct` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CreditCardProduct" ADD COLUMN     "effectiveFree" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "recommended" TEXT,
ALTER COLUMN "bankLogoUrl" DROP NOT NULL;

-- AlterTable
ALTER TABLE "LoanProduct" DROP COLUMN "emiExample",
DROP COLUMN "processingTime",
ADD COLUMN     "approvalScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "aprText" TEXT NOT NULL,
ADD COLUMN     "disbursalTimeHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "emiAmount" TEXT NOT NULL,
ADD COLUMN     "emiValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "processTimeLabel" TEXT NOT NULL,
ADD COLUMN     "processTimeValue" TEXT NOT NULL,
ADD COLUMN     "processTypeLabel" TEXT NOT NULL,
ADD COLUMN     "processTypeValue" TEXT NOT NULL;
