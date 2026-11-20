-- What each account's interface has opened to and which lines it has been told: one row per moment and kind, so a
-- write is a set insert that any device can repeat in any order.
create table "opening_progress" (
  "owner" text not null references "user" ("realmsId") on delete cascade,
  "moment" text not null,
  "kind" text not null check ("kind" in ('reached', 'seen')),
  primary key ("owner", "moment", "kind")
);
