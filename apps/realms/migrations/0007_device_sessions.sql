-- The sessions that obtained an approval for each device key. Removing the key ends them: a removed browser is signed
-- out, so it can neither mint a new key nor ask for another approval until someone signs in again.
create table "device_sessions" (
  "realmsId" text not null references "user" ("realmsId") on delete cascade,
  "deviceKey" text not null,
  "sessionId" text not null references "session" ("id") on delete cascade,
  primary key ("realmsId", "deviceKey", "sessionId")
);
