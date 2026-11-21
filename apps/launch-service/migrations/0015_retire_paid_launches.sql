DELETE FROM launch_runs WHERE slot_id IS NOT NULL AND status IN ('queued', 'running', 'failed');
ALTER TABLE playtest_slots DROP COLUMN frozen_at;
ALTER TABLE playtest_slots DROP COLUMN freeze_failure;
