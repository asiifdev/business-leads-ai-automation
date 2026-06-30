-- Migration: Replace plaintext key with keyHash + keyPrefix for secure API key storage
-- api_keys table: drop unique constraint on key, add keyHash (unique) and keyPrefix columns

-- Step 1: Add new columns (nullable first for existing rows)
ALTER TABLE "api_keys" ADD COLUMN "keyHash" TEXT;
ALTER TABLE "api_keys" ADD COLUMN "keyPrefix" TEXT;

-- Step 2: Remove the plaintext key column and its unique index
DROP INDEX IF EXISTS "api_keys_key_key";
ALTER TABLE "api_keys" DROP COLUMN IF EXISTS "key";

-- Step 3: Set NOT NULL after migration (new rows will always have these)
ALTER TABLE "api_keys" ALTER COLUMN "keyHash" SET NOT NULL;
ALTER TABLE "api_keys" ALTER COLUMN "keyPrefix" SET NOT NULL;

-- Step 4: Add unique constraint on keyHash
CREATE UNIQUE INDEX "api_keys_keyHash_key" ON "api_keys"("keyHash");
