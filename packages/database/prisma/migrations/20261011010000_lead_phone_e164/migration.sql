-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "phoneE164" TEXT;

-- CreateIndex
CREATE INDEX "leads_workspaceId_phoneE164_idx" ON "leads"("workspaceId", "phoneE164");

