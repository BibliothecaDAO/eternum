-- The referral's one-person check compares browsers, not guardian device keys: each account on one browser approves
-- its own key, so a second account on the same phone never matched (server/browsers.ts). Every browser an account was
-- signed in on, kept after sign-out, written by the app's session read (server/routes.ts, accountSession).
create table "account_browsers" (
  "realmsId" text not null references "user" ("realmsId") on delete cascade,
  "browser" text not null,
  primary key ("realmsId", "browser")
);
drop table "account_devices";
-- A friend's row keeps the browser they took the link with, then the one they counted on. The device keys kept before
-- name no browser, so every row starts unknown and learns its browsers from account_browsers.
drop index "campaign_referrals_counted_device";
alter table "campaign_referrals" rename column "device_key" to "browser";
update "campaign_referrals" set "browser" = null;
create unique index "campaign_referrals_counted_browser" on "campaign_referrals" ("campaign", "referrer", "browser")
  where "counted_at" is not null;
