create table "seal_codes" (
  "code_hash" text primary key,
  "label" text not null,
  "expires_at" integer,
  "owner" text unique references "user" ("realmsId") on delete cascade,
  "redeemed_at" integer,
  check (("owner" is null) = ("redeemed_at" is null))
);
