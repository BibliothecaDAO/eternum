create table "share_visits_kept" as select * from "share_visits";
create table "share_joins_kept" as select * from "share_joins";
create table "share_links_next" (
  "code" text primary key,
  "sharer" text not null references "user" ("realmsId") on delete cascade,
  "kind" text not null,
  "chain_id" text,
  "game_id" integer,
  "moment" integer not null,
  "created_at" integer not null,
  "posted_at" integer,
  check (("chain_id" is null) = ("game_id" is null)),
  check ("chain_id" is not null or "kind" = 'aspect'),
  unique ("sharer", "kind", "chain_id", "game_id", "moment")
);
insert into "share_links_next" ("code", "sharer", "kind", "chain_id", "game_id", "moment", "created_at", "posted_at")
  select "code", "sharer", "kind", "chain_id", "game_id", "moment", "created_at", "posted_at" from "share_links";
drop table "share_links";
alter table "share_links_next" rename to "share_links";
create unique index "share_links_season" on "share_links" ("sharer", "kind", "moment") where "chain_id" is null;
insert into "share_visits" select * from "share_visits_kept";
insert into "share_joins" select * from "share_joins_kept";
drop table "share_visits_kept";
drop table "share_joins_kept";
