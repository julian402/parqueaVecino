-- AlterTable
ALTER TABLE "parking_lots" ADD COLUMN     "photos" TEXT[] DEFAULT ARRAY[]::TEXT[];
