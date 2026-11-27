-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('LIABILITY_POLICY', 'RUT', 'E_INVOICING');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED');

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "expiry_notice_sent_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "parking_lot_documents" (
    "id" UUID NOT NULL,
    "parking_lot_id" UUID NOT NULL,
    "type" "DocumentType" NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "file_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "expires_at" DATE,
    "rejection_reason" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "expiry_notice_sent_at" TIMESTAMP(3),
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parking_lot_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "parking_lot_documents_status_idx" ON "parking_lot_documents"("status");

-- CreateIndex
CREATE INDEX "parking_lot_documents_expires_at_idx" ON "parking_lot_documents"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "parking_lot_documents_parking_lot_id_type_key" ON "parking_lot_documents"("parking_lot_id", "type");

-- AddForeignKey
ALTER TABLE "parking_lot_documents" ADD CONSTRAINT "parking_lot_documents_parking_lot_id_fkey" FOREIGN KEY ("parking_lot_id") REFERENCES "parking_lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
