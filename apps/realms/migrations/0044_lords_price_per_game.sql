-- The price a player is quoted is the one read at the start of his game's day: it is kept per game and game day, so
-- another game's calendar never reprices it. The one-row-a-day rows had no game; the cron reads each running game's
-- day again within the minute.
drop table if exists "lords_price";
create table "lords_price" (
  "chain_id" text not null,
  "game_id" integer not null,
  "day_start" integer not null,
  "usd" real not null check ("usd" > 0),
  "read_at" integer not null,
  primary key ("chain_id", "game_id", "day_start")
);
