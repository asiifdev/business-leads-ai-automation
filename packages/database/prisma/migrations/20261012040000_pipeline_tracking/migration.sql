ALTER TABLE "leads" ADD COLUMN "dealValue" INTEGER,
                    ADD COLUMN "lostReason" TEXT,
                    ADD COLUMN "needsReply" BOOLEAN NOT NULL DEFAULT false,
                    ADD COLUMN "lastIntent" TEXT;
ALTER TABLE "inbound_messages" ADD COLUMN "intent" TEXT;
CREATE INDEX "leads_workspaceId_needsReply_idx" ON "leads"("workspaceId", "needsReply");
