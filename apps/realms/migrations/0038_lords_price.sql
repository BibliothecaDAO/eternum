-- The day's LORDS price in dollars, read once a UTC day by the cron and kept: the shop quotes its dollar prices in whole
-- LORDS from the latest row, so a read that fails leaves yesterday's price standing.
create table "lords_price" (
  "day" integer primary key,
  "usd" real not null check ("usd" > 0),
  "read_at" integer not null
);
