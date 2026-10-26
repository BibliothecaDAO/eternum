-- Each account's Blitz build orders: its book as JSON, which the game's own reader checks on every save, and a revision
-- so a save from another device never overwrites what it has not seen.
create table "build_order_books" (
  "owner" text not null primary key references "user" ("realmsId") on delete cascade,
  "book" text not null,
  "revision" integer not null default 0 check ("revision" >= 0)
);
