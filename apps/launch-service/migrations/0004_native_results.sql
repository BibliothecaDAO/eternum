BEGIN;
-- Retired series jobs have no executable contract interface in a native world.
DELETE FROM launch_runs WHERE kind IN ('series', 'rotation');
ALTER TABLE launch_runs DROP CONSTRAINT IF EXISTS launch_runs_kind_check;
ALTER TABLE launch_runs ADD CONSTRAINT launch_runs_kind_check CHECK (kind IN ('game', 'result'));
COMMIT;
