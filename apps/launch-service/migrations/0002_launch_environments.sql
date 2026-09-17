BEGIN;
ALTER TABLE launch_runs DROP CONSTRAINT IF EXISTS launch_runs_environment_check;
ALTER TABLE launch_runs ADD CONSTRAINT launch_runs_environment_check
  CHECK (environment IN ('madara.blitz', 'madara.eternum'));
COMMIT;
