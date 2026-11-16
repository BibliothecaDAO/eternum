-- A price day is one record with its identity and validity interval: which calendar set it ("chain:game", or "utc" where
-- no Frontier day runs), when it starts and when it ends. The start is the key, so a day exists once. The price is empty
-- until the day's first successful read. The rows of 0046 had no interval; the cron opens the current day again within
-- the minute.
drop table if exists "lords_price";
create table "lords_price" (
  "day_start" integer primary key,
  "day_end" integer not null check ("day_end" > "day_start"),
  "calendar" text not null,
  "usd" real check ("usd" > 0),
  "read_at" integer
);
