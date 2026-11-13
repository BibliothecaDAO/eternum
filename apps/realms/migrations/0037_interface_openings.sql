-- What an account keeps of Frontier's opening interface (packages/identity/src/opening.ts): the moments it reached, a
-- JSON array of their names that only grows, and whether it shows everything.
create table "interface_openings" (
  "owner" text not null primary key references "user" ("realmsId") on delete cascade,
  "reached" text not null default '[]' check (json_valid("reached") and json_type("reached") = 'array'),
  "showAll" integer not null default 0 check ("showAll" in (0, 1))
);
