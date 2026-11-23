create table "order_intents" (
  "owner" text primary key references "user" ("realmsId") on delete cascade,
  "order" integer not null check ("order" between 1 and 16),
  "chosen_at" integer not null
);
