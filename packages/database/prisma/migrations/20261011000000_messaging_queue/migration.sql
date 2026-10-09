-- CreateTable
CREATE TABLE "whatsapp_accounts" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'baileys',
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "phone" TEXT,
    "hourlyLimit" INTEGER NOT NULL DEFAULT 10,
    "dailyLimit" INTEGER NOT NULL DEFAULT 80,
    "quietStartHour" INTEGER NOT NULL DEFAULT 21,
    "quietEndHour" INTEGER NOT NULL DEFAULT 7,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Jakarta',
    "defaultCountryCode" TEXT NOT NULL DEFAULT '62',
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "nextSendAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "whatsapp_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbound_messages" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'whatsapp',
    "toPhone" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "aiBody" TEXT,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "context" JSONB,
    "editedByUser" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "providerMessageId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "leadId" TEXT,

    CONSTRAINT "outbound_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbound_messages" (
    "id" TEXT NOT NULL,
    "fromPhone" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "providerMessageId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT NOT NULL,
    "leadId" TEXT,

    CONSTRAINT "inbound_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_opt_outs" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "message_opt_outs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_accounts_workspaceId_key" ON "whatsapp_accounts"("workspaceId");

-- CreateIndex
CREATE INDEX "outbound_messages_workspaceId_status_createdAt_idx" ON "outbound_messages"("workspaceId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "outbound_messages_workspaceId_sentAt_idx" ON "outbound_messages"("workspaceId", "sentAt");

-- CreateIndex
CREATE INDEX "outbound_messages_leadId_idx" ON "outbound_messages"("leadId");

-- CreateIndex
CREATE INDEX "inbound_messages_workspaceId_fromPhone_receivedAt_idx" ON "inbound_messages"("workspaceId", "fromPhone", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "inbound_messages_workspaceId_providerMessageId_key" ON "inbound_messages"("workspaceId", "providerMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "message_opt_outs_workspaceId_phone_key" ON "message_opt_outs"("workspaceId", "phone");

-- AddForeignKey
ALTER TABLE "whatsapp_accounts" ADD CONSTRAINT "whatsapp_accounts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_messages" ADD CONSTRAINT "outbound_messages_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_messages" ADD CONSTRAINT "outbound_messages_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_messages" ADD CONSTRAINT "inbound_messages_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_messages" ADD CONSTRAINT "inbound_messages_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_opt_outs" ADD CONSTRAINT "message_opt_outs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

