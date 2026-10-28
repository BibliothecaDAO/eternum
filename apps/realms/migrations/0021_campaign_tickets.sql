-- A campaign's printed codes, hashed (server/campaigns.ts), each with the tier it gives. Only the code generator's SQL
-- writes them (scripts/campaign-codes.ts).
create table "campaign_codes" (
  "campaign" text not null,
  "code_hash" text not null,
  "tier" text not null check ("tier" in ('regular', 'golden')),
  primary key ("campaign", "code_hash")
);
-- One ticket per account per campaign, with the code it came from when a flyer's code was known. A golden code is
-- golden for its first account only: the index below refuses a second golden ticket from it.
create table "campaign_tickets" (
  "campaign" text not null,
  "owner" text not null references "user" ("realmsId") on delete cascade,
  "code_hash" text,
  "tier" text not null check ("tier" in ('regular', 'golden')),
  "redeemed_at" integer not null,
  primary key ("campaign", "owner")
);
create unique index "campaign_tickets_golden_code" on "campaign_tickets" ("campaign", "code_hash") where "tier" = 'golden';
