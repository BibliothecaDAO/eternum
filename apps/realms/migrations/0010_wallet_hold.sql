-- Existing links enter the same hold at migration time; no wallet is exempt from the new payout rule.
ALTER TABLE "user" ADD COLUMN "walletLinkedAt" INTEGER;
UPDATE "user" SET "walletLinkedAt" = CAST(unixepoch('subsec') * 1000 AS INTEGER) WHERE "address" IS NOT NULL;
