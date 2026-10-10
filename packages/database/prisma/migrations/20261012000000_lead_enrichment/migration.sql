-- AlterTable
ALTER TABLE "leads" ADD COLUMN "enrichment" JSONB,
ADD COLUMN "enrichedAt" TIMESTAMP(3);
