-- AlterTable
ALTER TABLE "knowledge_sources" ADD COLUMN     "text" TEXT,
ADD COLUMN     "url" TEXT;

-- CreateTable
CREATE TABLE "marketing_briefs" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "language" TEXT NOT NULL DEFAULT 'indonesian',
    "summary" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "sourceIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "marketing_briefs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "marketing_briefs_workspaceId_key" ON "marketing_briefs"("workspaceId");

-- AddForeignKey
ALTER TABLE "marketing_briefs" ADD CONSTRAINT "marketing_briefs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

