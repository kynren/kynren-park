-- CreateTable
CREATE TABLE "SmeetzOrder" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "customerId" TEXT,
    "language" TEXT,
    "smeetzCreatedAt" TIMESTAMP(3) NOT NULL,
    "smeetzUpdatedAt" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmeetzOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmeetzOrderLine" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "priceName" TEXT,
    "priceValue" DOUBLE PRECISION,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "itemStatus" TEXT,
    "optionId" TEXT,
    "availabilityId" TEXT,
    "showDate" TIMESTAMP(3),
    "unitId" TEXT,
    "barcode" TEXT,
    "voucherCode" TEXT,
    "voucherStatus" TEXT,
    "membershipCode" TEXT,
    "membershipStatus" TEXT,
    "guestFirstName" TEXT,
    "guestLastName" TEXT,

    CONSTRAINT "SmeetzOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmeetzBuyer" (
    "orderId" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "company" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmeetzBuyer_pkey" PRIMARY KEY ("orderId")
);

-- CreateTable
CREATE TABLE "SmeetzSyncState" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmeetzSyncState_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "SmeetzOrder_smeetzCreatedAt_idx" ON "SmeetzOrder"("smeetzCreatedAt");

-- CreateIndex
CREATE INDEX "SmeetzOrder_reference_idx" ON "SmeetzOrder"("reference");

-- CreateIndex
CREATE INDEX "SmeetzOrder_customerId_idx" ON "SmeetzOrder"("customerId");

-- CreateIndex
CREATE INDEX "SmeetzOrderLine_orderId_idx" ON "SmeetzOrderLine"("orderId");

-- CreateIndex
CREATE INDEX "SmeetzOrderLine_kind_idx" ON "SmeetzOrderLine"("kind");

-- CreateIndex
CREATE INDEX "SmeetzOrderLine_optionId_availabilityId_idx" ON "SmeetzOrderLine"("optionId", "availabilityId");

-- CreateIndex
CREATE INDEX "SmeetzBuyer_email_idx" ON "SmeetzBuyer"("email");

-- AddForeignKey
ALTER TABLE "SmeetzOrderLine" ADD CONSTRAINT "SmeetzOrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "SmeetzOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

