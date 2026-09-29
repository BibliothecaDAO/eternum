-- Game alerts come from the shards in our directory; a device consents to them as a whole, so no source is stored.
alter table "notification_push_subscriptions" drop column "gameAlertsSource";

-- The gameplay accounts the guardian has approved a device for, by address: the notifier's way from a story's
-- recipient to the Realms account whose devices receive it.
create table "realms_accounts" (
  "address" text not null primary key,
  "realmsId" text not null references "user" ("realmsId") on delete cascade
);
