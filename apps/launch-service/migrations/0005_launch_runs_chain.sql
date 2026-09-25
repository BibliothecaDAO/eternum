-- A run belongs to one chain. Without the chain in its key, pointing SHARD_URL at a new shard with the same D1 handed
-- back the old chain's runs: the Frontier season was never created on the new chain, and a queued result could
-- finalize a same-numbered game there. SQLite cannot change a UNIQUE constraint in place, so the table is rebuilt.
-- Runs recorded before this migration carry no chain (''), so no shard sees them; a shard that needs one again
-- re-creates it, and create_game is idempotent by name on its own chain.
CREATE TABLE launch_runs_by_chain (
  id TEXT PRIMARY KEY,
  chain_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('game', 'result')),
  environment TEXT NOT NULL CHECK (environment IN ('madara.blitz', 'madara.eternum', 'madara.frontier')),
  name TEXT NOT NULL,
  request TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'complete', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at INTEGER NOT NULL,
  error_message TEXT,
  summary TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  completed_at INTEGER,
  UNIQUE (chain_id, kind, environment, name)
);

INSERT INTO launch_runs_by_chain (id, chain_id, kind, environment, name, request, status, attempts, available_at,
  error_message, summary, created_at, updated_at, completed_at)
SELECT id, '', kind, environment, name, request, status, attempts, available_at, error_message, summary, created_at,
  updated_at, completed_at
FROM launch_runs;

DROP TABLE launch_runs;

ALTER TABLE launch_runs_by_chain RENAME TO launch_runs;

CREATE INDEX launch_runs_queue ON launch_runs (chain_id, status, available_at, created_at);
