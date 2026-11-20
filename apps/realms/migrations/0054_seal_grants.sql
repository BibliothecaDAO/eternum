create table "seal_grants" (
  "owner" text primary key references "user" ("realmsId") on delete cascade,
  "queued_at" integer not null
);
