-- A code that every flyer of a campaign shares, hashed as campaign_codes are (server/campaigns.ts). It names no ticket of
-- its own: each account that brings it draws one of the campaign's unspent printed codes, at that code's tier. Only the
-- shared-code script's SQL writes it (scripts/campaign-shared-code.ts).
create table "campaign_shared_codes" (
  "campaign" text not null,
  "code_hash" text not null,
  primary key ("campaign", "code_hash")
);
