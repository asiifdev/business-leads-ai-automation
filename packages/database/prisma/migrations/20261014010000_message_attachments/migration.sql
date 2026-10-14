CREATE TABLE "message_attachments" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT NOT NULL,
    CONSTRAINT "message_attachments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "message_attachments_storageKey_key" ON "message_attachments"("storageKey");
CREATE INDEX "message_attachments_workspaceId_createdAt_idx" ON "message_attachments"("workspaceId", "createdAt");
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "outbound_messages" ADD COLUMN "attachmentId" TEXT, ADD COLUMN "linkPreview" JSONB;
CREATE INDEX "outbound_messages_attachmentId_idx" ON "outbound_messages"("attachmentId");
ALTER TABLE "outbound_messages" ADD CONSTRAINT "outbound_messages_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "message_attachments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
