-- One row per launch: a game to create or a Blitz result to record. The registrar Durable Object is the only writer of
-- status transitions, so no lease columns are needed; times are Unix milliseconds.
CREATE TABLE launch_runs (
  id TEXT PRIMARY KEY,
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
  UNIQUE (kind, environment, name)
);

CREATE INDEX launch_runs_queue ON launch_runs (status, available_at, created_at);

CREATE TABLE playtest_slots (
  name TEXT PRIMARY KEY,
  closes_at INTEGER NOT NULL,
  frozen_at INTEGER
);

CREATE TABLE playtest_registrations (
  slot_name TEXT NOT NULL REFERENCES playtest_slots (name) ON DELETE CASCADE,
  owner TEXT NOT NULL,
  position INTEGER NOT NULL,
  game_number INTEGER CHECK (game_number > 0),
  PRIMARY KEY (slot_name, owner),
  UNIQUE (slot_name, position)
);
