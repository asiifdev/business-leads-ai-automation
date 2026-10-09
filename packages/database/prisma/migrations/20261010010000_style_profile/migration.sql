CREATE TABLE "style_profiles" (
    "id" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "stats" JSONB NOT NULL,
    "messageCount" INTEGER NOT NULL,
    "exampleCount" INTEGER NOT NULL,
    "embeddingModel" TEXT NOT NULL,
    "dimensions" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL,
    CONSTRAINT "style_profiles_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "style_examples" (
    "id" TEXT NOT NULL,
    "incoming" TEXT NOT NULL,
    "reply" TEXT NOT NULL,
    "embeddingModel" TEXT NOT NULL,
    "dimensions" INTEGER NOT NULL,
    "embedding" vector,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    CONSTRAINT "style_examples_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "style_profiles_workspaceId_key" ON "style_profiles"("workspaceId");
CREATE INDEX "style_examples_workspaceId_embeddingModel_idx" ON "style_examples"("workspaceId", "embeddingModel");
ALTER TABLE "style_profiles" ADD CONSTRAINT "style_profiles_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "style_examples" ADD CONSTRAINT "style_examples_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "style_examples" ADD CONSTRAINT "style_examples_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "style_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
