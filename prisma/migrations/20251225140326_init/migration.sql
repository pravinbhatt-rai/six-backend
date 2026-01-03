-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('LOAN', 'CREDIT_CARD');

-- CreateEnum
CREATE TYPE "LoanCategoryType" AS ENUM ('PERSONAL', 'BUSINESS', 'HOME', 'VEHICLE', 'EDUCATION', 'OTHER');

-- CreateTable
CREATE TABLE "LoanCategory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoanCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanProduct" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "bankLogoUrl" TEXT NOT NULL,
    "processingTime" TEXT NOT NULL,
    "chanceOfApproval" TEXT NOT NULL,
    "interestRateText" TEXT NOT NULL,
    "emiExample" TEXT NOT NULL,
    "productType" "ProductType" NOT NULL DEFAULT 'LOAN',
    "categoryId" INTEGER NOT NULL,
    "keyStatement" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoanProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanBullet" (
    "id" SERIAL NOT NULL,
    "text" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "productId" INTEGER NOT NULL,

    CONSTRAINT "LoanBullet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanSummaryCharge" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "mainText" TEXT NOT NULL,
    "subText" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "productId" INTEGER NOT NULL,

    CONSTRAINT "LoanSummaryCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanRequiredDocument" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "productId" INTEGER NOT NULL,

    CONSTRAINT "LoanRequiredDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanProcessStep" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "productId" INTEGER NOT NULL,

    CONSTRAINT "LoanProcessStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditCardProduct" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "bankLogoUrl" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "categories" TEXT[],
    "annualFee" TEXT NOT NULL,
    "cardNetwork" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditCardProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditCardBullet" (
    "id" SERIAL NOT NULL,
    "text" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "productId" INTEGER NOT NULL,

    CONSTRAINT "CreditCardBullet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LoanCategory_slug_key" ON "LoanCategory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "LoanProduct_slug_key" ON "LoanProduct"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "CreditCardProduct_slug_key" ON "CreditCardProduct"("slug");

-- AddForeignKey
ALTER TABLE "LoanProduct" ADD CONSTRAINT "LoanProduct_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "LoanCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanBullet" ADD CONSTRAINT "LoanBullet_productId_fkey" FOREIGN KEY ("productId") REFERENCES "LoanProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanSummaryCharge" ADD CONSTRAINT "LoanSummaryCharge_productId_fkey" FOREIGN KEY ("productId") REFERENCES "LoanProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanRequiredDocument" ADD CONSTRAINT "LoanRequiredDocument_productId_fkey" FOREIGN KEY ("productId") REFERENCES "LoanProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanProcessStep" ADD CONSTRAINT "LoanProcessStep_productId_fkey" FOREIGN KEY ("productId") REFERENCES "LoanProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditCardBullet" ADD CONSTRAINT "CreditCardBullet_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CreditCardProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
