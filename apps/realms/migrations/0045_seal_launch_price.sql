-- The Ancient Seal's LORDS price is fixed once at the season's launch and holds for the season: the market price of one
-- LORDS in dollars at that moment, from which the seal's LORDS amounts are derived. One row, set once; none before launch.
create table "seal_launch_price" (
  "id" integer primary key check ("id" = 1),
  "usd" real not null check ("usd" > 0),
  "set_at" integer not null
);
