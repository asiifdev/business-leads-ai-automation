CREATE TABLE "usage_counters" (
  "id" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "metric" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "workspaceId" TEXT NOT NULL,
  CONSTRAINT "usage_counters_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "usage_counters_workspaceId_period_metric_key" ON "usage_counters"("workspaceId", "period", "metric");
ALTER TABLE "usage_counters" ADD CONSTRAINT "usage_counters_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "usage_events" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "model" TEXT,
  "source" TEXT,
  "promptTokens" INTEGER,
  "completionTokens" INTEGER,
  "latencyMs" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "workspaceId" TEXT NOT NULL,
  CONSTRAINT "usage_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "usage_events_workspaceId_createdAt_idx" ON "usage_events"("workspaceId", "createdAt");
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
