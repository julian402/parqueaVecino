-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "renewal_of_id" UUID;

-- CreateIndex
CREATE INDEX "bookings_renewal_of_id_idx" ON "bookings"("renewal_of_id");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_renewal_of_id_fkey" FOREIGN KEY ("renewal_of_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
