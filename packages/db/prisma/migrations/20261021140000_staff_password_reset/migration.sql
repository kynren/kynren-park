-- AlterTable
ALTER TABLE "StaffUser" ADD COLUMN     "resetExpiresAt" TIMESTAMP(3),
ADD COLUMN     "resetTokenHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "StaffUser_resetTokenHash_key" ON "StaffUser"("resetTokenHash");
