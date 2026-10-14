ALTER TABLE "leads" ADD COLUMN "province" TEXT, ADD COLUMN "regency" TEXT, ADD COLUMN "district" TEXT, ADD COLUMN "geocodedAt" TIMESTAMP(3);
CREATE INDEX "leads_workspaceId_province_regency_idx" ON "leads"("workspaceId", "province", "regency");
