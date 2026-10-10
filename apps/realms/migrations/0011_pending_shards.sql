-- Keep validated enrollment chains invisible until deployment activation.
CREATE TABLE shards_pending (
  url TEXT NOT NULL PRIMARY KEY,
  chainId TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'draining', 'retired')),
  addedAt INTEGER NOT NULL
);
INSERT INTO shards_pending SELECT url, chainId, status, addedAt FROM shards;
DROP TABLE shards;
ALTER TABLE shards_pending RENAME TO shards;
