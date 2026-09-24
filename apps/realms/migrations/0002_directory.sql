-- Our directory: the shards whose games the app lists. A shard is named by its Herald URL and its manifest's chain id;
-- both are unique, so a second shard with a listed chain id is refused. Draining shards keep their games listed until
-- they end; retired shards are no longer listed. Times are Unix milliseconds.
create table "shards" (
  "url" text not null primary key,
  "chainId" text not null unique,
  "status" text not null default 'active' check ("status" in ('active', 'draining', 'retired')),
  "addedAt" integer not null
);
