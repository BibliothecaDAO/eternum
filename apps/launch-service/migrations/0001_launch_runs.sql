CREATE TABLE IF NOT EXISTS launch_runs (
  id uuid PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('game', 'series', 'rotation')),
  environment text NOT NULL CHECK (environment = 'madara.blitz'),
  name text NOT NULL,
  request jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('queued', 'running', 'complete', 'failed', 'cancelled')),
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  claimed_until timestamptz,
  lease_token uuid,
  error_message text,
  summary jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (kind, environment, name)
);

CREATE UNIQUE INDEX IF NOT EXISTS launch_runs_single_registrar_writer
  ON launch_runs ((true)) WHERE status = 'running';

CREATE INDEX IF NOT EXISTS launch_runs_queue
  ON launch_runs (status, available_at, created_at);
