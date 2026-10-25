-- The country a campaign searches in (existing campaigns were all Indonesian).
ALTER TABLE "campaigns" ADD COLUMN "country" TEXT NOT NULL DEFAULT 'ID';
