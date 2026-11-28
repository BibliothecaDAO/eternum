alter table "fragment_quotes" add column "treasury_wei" text;
alter table "fragment_quotes" add column "ve_lords" text;
alter table "fragment_quotes" add column "ve_lords_wei" text;
update "fragment_quotes"
set "treasury_wei" = "lords_wei", "ve_lords" = "treasury", "ve_lords_wei" = '0'
where "treasury_wei" is null;

create table "external_payment_quotes" (
  "id" text primary key,
  "owner" text references "user" ("realmsId") on delete set null,
  "chain_id" text not null,
  "game_id" integer not null,
  "fragments" integer not null check ("fragments" > 0),
  "cents" integer not null check ("cents" > 0),
  "rail" text not null check ("rail" in ('evm', 'solana')),
  "network_chain_id" integer,
  "token" text not null,
  "treasury" text not null,
  "usdc_units" text not null,
  "expires_at" integer not null,
  "created_at" integer not null,
  "tx_hash" text unique,
  "receipt" text unique,
  "refused" integer not null default 0,
  "payer" text,
  "paid_units" text,
  "refund_transaction" text
);
create index "external_payment_quotes_owner" on "external_payment_quotes" ("owner", "created_at");
create index "external_payment_quotes_confirming" on "external_payment_quotes" ("tx_hash") where "tx_hash" is not null and "refused" = 0;

create table "stripe_payment_intents" (
  "intent_id" text primary key,
  "owner" text references "user" ("realmsId") on delete set null,
  "chain_id" text not null,
  "game_id" integer not null,
  "fragments" integer not null check ("fragments" > 0),
  "cents" integer not null check ("cents" > 0),
  "status" text not null default 'created',
  "created_at" integer not null,
  "refund_id" text
);
create index "stripe_payment_intents_owner" on "stripe_payment_intents" ("owner", "created_at");
