-- Which sources a campaign looks in (existing campaigns keep using Google Maps).
ALTER TABLE "campaigns" ADD COLUMN "sources" TEXT[] DEFAULT ARRAY['google_maps']::TEXT[];
