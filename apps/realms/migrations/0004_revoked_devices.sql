-- Device keys revoked from a Realms account. One key serves every shard, so it is keyed by the account, not by a chain:
-- a device removed from the account can come back only as a new device, with a new key and a fresh sign-in.
create table "revoked_devices" (
  "realmsId" text not null references "user" ("realmsId") on delete cascade,
  "deviceKey" text not null,
  "revokedAt" integer not null,
  primary key ("realmsId", "deviceKey")
);
