-- What an Aspect invite pays its sharer in one game (server/shares.ts): 100 Fragments for each of the first 10 friends
-- whose Glory reached 100 there ("friend" set), and 1,000 more at the 10th ("friend" null). The id is the credit's id on
-- chain, so a delivery retried after a lost answer pays once; `paid_at` is set when the relay delivered it.
create table "share_payouts" (
  "id" text primary key,
  "sharer" text not null references "user" ("realmsId") on delete cascade,
  "friend" text references "user" ("realmsId") on delete cascade,
  "chain_id" text not null,
  "game_id" integer not null,
  "amount" integer not null check ("amount" > 0),
  "created_at" integer not null,
  "paid_at" integer
);
create index "share_payouts_sharer" on "share_payouts" ("sharer", "chain_id", "game_id");
create index "share_payouts_unpaid" on "share_payouts" ("paid_at") where "paid_at" is null;
-- The closed Devcon referral links and the friends they counted (0027, 0029): their payout was a ticket tier, now gone.
drop table "campaign_referrals";
drop table "campaign_referrers";
