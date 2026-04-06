-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN "orderId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_orderId_key" ON "Purchase"("orderId");

-- AlterTable
ALTER TABLE "IngestEvent" ADD COLUMN "orderId" TEXT;
