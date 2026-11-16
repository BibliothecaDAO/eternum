-- One LORDS price for the whole shop at any moment: a row per price day (a Frontier game day, or a UTC day where no
-- Frontier day runs), newest row current, its price empty until the first successful read of that day. The per-game
-- prices of 0044 are dropped; the cron opens the current day's row again within the minute.
drop table if exists "lords_price";
create table "lords_price" (
  "id" integer primary key autoincrement,
  "day_start" integer not null,
  "usd" real check ("usd" > 0),
  "read_at" integer
);
