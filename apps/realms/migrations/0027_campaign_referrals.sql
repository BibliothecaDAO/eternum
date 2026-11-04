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
-- One person counts once on a link: no two counted friends share a mailbox or a device. Settlement checks this in the
-- write that counts a friend; these keep it true whatever reads race.
create unique index "campaign_referrals_counted_mailbox" on "campaign_referrals" ("campaign", "referrer", "mailbox")
  where "counted_at" is not null;
create unique index "campaign_referrals_counted_device" on "campaign_referrals" ("campaign", "referrer", "device_key")
  where "counted_at" is not null;
-- Every device key the guardian approved for an account, kept after sign-out: "device_sessions" rows go with their
-- session, and a referral's one-person check must still know the account's devices then. Filled from the approvals and
-- revocations already recorded.
create table "account_devices" (
  "realmsId" text not null references "user" ("realmsId") on delete cascade,
  "deviceKey" text not null,
  primary key ("realmsId", "deviceKey")
);
insert into "account_devices" ("realmsId", "deviceKey")
  select "realmsId", "deviceKey" from "device_sessions"
  union select "realmsId", "deviceKey" from "revoked_devices";
