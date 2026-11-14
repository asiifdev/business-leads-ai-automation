-- A branch of a business already in the leads (same phone or website, a different place): its own lead, not a repeat.
ALTER TABLE "leads" ADD COLUMN "branchOfId" TEXT;
CREATE INDEX "leads_workspaceId_branchOfId_idx" ON "leads"("workspaceId", "branchOfId");
ALTER TABLE "leads" ADD CONSTRAINT "leads_branchOfId_fkey" FOREIGN KEY ("branchOfId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
