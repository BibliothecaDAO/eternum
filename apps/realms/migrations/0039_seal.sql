-- The Ancient Seal an account bought: one row an account, kept for good (the season's end does not clear it). The receipt
-- is the store's or the wallet's own id for the payment, so one payment can be written down once.
create table "seal" (
  "owner" text primary key references "user" ("realmsId") on delete cascade,
  "paid_cents" integer not null check ("paid_cents" > 0),
  "source" text not null check ("source" in ('web', 'store')),
  "receipt" text not null unique,
  "granted_at" integer not null
);
