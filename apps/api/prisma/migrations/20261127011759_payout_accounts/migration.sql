-- CreateEnum
CREATE TYPE "PayoutAccountStatus" AS ENUM ('PENDING', 'ACTION_REQUIRED', 'ACTIVE');

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "destination_ref" TEXT;

-- CreateTable
CREATE TABLE "payout_accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_ref" TEXT NOT NULL,
    "status" "PayoutAccountStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payout_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payout_accounts_user_id_key" ON "payout_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "payout_accounts_provider_ref_key" ON "payout_accounts"("provider_ref");

-- AddForeignKey
ALTER TABLE "payout_accounts" ADD CONSTRAINT "payout_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
