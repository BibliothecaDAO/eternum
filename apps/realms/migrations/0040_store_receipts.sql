-- A store's own id for a payment, written once, so the same receipt sent twice buys once. The receipt names no account
-- (the seal and the pending credit below do), so deleting an account never frees a payment to be used again.
create table "store_receipts" (
  "receipt" text primary key,
  "product" text not null,
  "received_at" integer not null
);

-- Fragments a store purchase bought, waiting for the co-signed hand-off that delivers them to the game: written with the
-- receipt, delivered once, never taken back.
create table "fragment_credits" (
  "receipt" text primary key references "store_receipts" ("receipt"),
  "owner" text not null references "user" ("realmsId") on delete cascade,
  "fragments" integer not null check ("fragments" > 0),
  "status" text not null default 'pending' check ("status" in ('pending', 'delivered')),
  "created_at" integer not null
);
