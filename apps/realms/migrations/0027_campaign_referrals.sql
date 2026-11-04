-- An account's referral link to a campaign: its public share code (not a secret, unlike a flyer's code), when its
-- friends earned it a ticket and turned that ticket golden, and when the link itself went golden
-- (server/campaign-referrals.ts).
create table "campaign_referrers" (
  "campaign" text not null,
  "referrer" text not null references "user" ("realmsId") on delete cascade,
  "code" text not null,
  "ticket_earned_at" integer,
  "golden_earned_at" integer,
  "golden_link_at" integer,
  primary key ("campaign", "referrer"),
  unique ("campaign", "code")
);
-- A friend whose ticket came from a referral link, once per campaign: the first link that gave them a ticket, the
-- mailbox and device they took it with (so one person's accounts count once), and when they first stood on the season
-- board with a site cleared, which counts them for their inviter.
create table "campaign_referrals" (
  "campaign" text not null,
  "friend" text not null references "user" ("realmsId") on delete cascade,
  "referrer" text not null references "user" ("realmsId") on delete cascade,
  "created_at" integer not null,
  "mailbox" text not null,
  "device_key" text,
  "counted_at" integer,
  primary key ("campaign", "friend")
);
create index "campaign_referrals_referrer" on "campaign_referrals" ("campaign", "referrer");
