create table "fragment_quotes" (
  "id" text primary key,
  "owner" text references "user" ("realmsId") on delete set null,
  "chain_id" text not null,
  "game_id" integer not null,
  "fragments" integer not null check ("fragments" > 0),
  "lords_wei" text not null,
  "token" text not null,
  "treasury" text not null,
  "expires_at" integer not null,
  "created_at" integer not null,
  "transaction_hash" text unique,
  "refused" integer not null default 0,
  "payers" text,
  "payer" text,
  "paid_wei" text,
  "refund_transaction" text
);
create index "fragment_quotes_owner" on "fragment_quotes" ("owner", "created_at");
create index "fragment_quotes_confirming" on "fragment_quotes" ("transaction_hash") where "transaction_hash" is not null and "refused" = 0;
alter table "fragment_credits" add column "chain_id" text;
alter table "fragment_credits" add column "game_id" integer;
