-- Data trust: where each field came from, free validation results, business status and duplicate marker.
ALTER TABLE "leads" ADD COLUMN "fieldMeta" JSONB;
ALTER TABLE "leads" ADD COLUMN "validation" JSONB;
ALTER TABLE "leads" ADD COLUMN "dataQuality" TEXT;
ALTER TABLE "leads" ADD COLUMN "qualityIssues" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "leads" ADD COLUMN "businessStatus" TEXT;
ALTER TABLE "leads" ADD COLUMN "duplicateOfId" TEXT;
CREATE INDEX "leads_workspaceId_duplicateOfId_idx" ON "leads"("workspaceId", "duplicateOfId");
ALTER TABLE "leads" ADD CONSTRAINT "leads_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
