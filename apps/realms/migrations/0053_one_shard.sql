CREATE TABLE shards_one (
  slot INTEGER NOT NULL PRIMARY KEY CHECK (slot = 1),
  chainId TEXT NOT NULL,
  url TEXT NOT NULL
);
INSERT INTO shards_one (slot, chainId, url)
SELECT 1, chainId, url FROM shards
WHERE status IN ('active', 'draining')
  AND (SELECT count(*) FROM shards WHERE status IN ('active', 'draining')) = 1;
DROP TABLE shards;
ALTER TABLE shards_one RENAME TO shards;
