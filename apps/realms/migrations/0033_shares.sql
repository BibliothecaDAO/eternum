-- A link a player shared (server/shares.ts): one per player and moment (a Frontier day), so sharing the same day again
-- hands back the same link. Its code is public; it names nothing but who shared what. `posted_at`: when the player
-- first opened the post with it.
create table "share_links" (
  "code" text primary key,
  "sharer" text not null references "user" ("realmsId") on delete cascade,
  "kind" text not null,
  "chain_id" text not null,
  "game_id" integer not null,
  "moment" integer not null,
  "created_at" integer not null,
  "posted_at" integer,
  unique ("sharer", "kind", "chain_id", "game_id", "moment")
);
-- The first time each browser opened a shared link, at the time SQLite writes (so it compares with "user"."createdAt").
create table "share_visits" (
  "code" text not null references "share_links" ("code") on delete cascade,
  "browser" text not null,
  "at" text not null,
  primary key ("code", "browser")
);
-- A new account a shared link brought: the first link one of its browsers opened before the account was made, when the
-- account was made (`joined_at`), and when a read first found it on that link's season board with a site cleared.
create table "share_joins" (
  "friend" text primary key references "user" ("realmsId") on delete cascade,
  "code" text not null references "share_links" ("code") on delete cascade,
  "joined_at" integer not null,
  "activated_at" integer
);
create index "share_joins_code" on "share_joins" ("code");
-- A visit finds the accounts its browser was signed in on.
create index "account_browsers_browser" on "account_browsers" ("browser");
