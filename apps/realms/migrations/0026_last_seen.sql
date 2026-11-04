-- When the account last opened the app: the identity Worker writes it on each session read (server/routes.ts,
-- noteVisit), at most once an hour (VISIT_RECORD_SECONDS). Unlike a session row it stays when the player signs out or
-- removes a device. It starts from each account's newest session as this migration runs; a news email treats visits
-- before this migration as unknown (scripts/comeback-campaign.ts).
alter table "user" add column "lastSeenAt" integer;

update "user" set "lastSeenAt" = (
  select cast(strftime('%s', max(s."updatedAt")) as integer) * 1000 from "session" s where s."userId" = "user"."id"
);
