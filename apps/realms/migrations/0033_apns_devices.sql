-- The iOS app's devices: WKWebView has no Web Push, so its devices hold the token APNs gave them in place of a Web Push
-- endpoint and keys. SQLite cannot relax a column's not null, so the table is rebuilt with every web device kept as is.
create table "notification_push_devices" (
  "id" text not null primary key,
  "owner" text not null references "user" ("realmsId") on delete cascade,
  "kind" text not null default 'web' check ("kind" in ('web', 'apns')),
  "endpoint" text unique,
  "p256dh" text,
  "auth" text,
  "apnsToken" text unique,
  "revocationHash" text not null,
  "gameAlertsEnabledAt" integer,
  "directMessagesEnabledAt" integer,
  "gameForegroundUntil" integer,
  "createdAt" integer not null,
  "timeZone" text,
  check (
    ("kind" = 'web' and "endpoint" is not null and "p256dh" is not null and "auth" is not null and "apnsToken" is null)
    or ("kind" = 'apns' and "apnsToken" is not null and "endpoint" is null and "p256dh" is null and "auth" is null)
  )
);

insert into "notification_push_devices"
  ("id", "owner", "kind", "endpoint", "p256dh", "auth", "revocationHash", "gameAlertsEnabledAt",
   "directMessagesEnabledAt", "gameForegroundUntil", "createdAt", "timeZone")
select "id", "owner", 'web', "endpoint", "p256dh", "auth", "revocationHash", "gameAlertsEnabledAt",
  "directMessagesEnabledAt", "gameForegroundUntil", "createdAt", "timeZone"
from "notification_push_subscriptions";

drop table "notification_push_subscriptions";

alter table "notification_push_devices" rename to "notification_push_subscriptions";

create index "notification_push_owner_idx" on "notification_push_subscriptions" ("owner");
