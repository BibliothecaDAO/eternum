DROP TABLE playtest_registrations;
ALTER TABLE playtest_slots RENAME TO old_slots;
CREATE TABLE playtest_slots (chain_id TEXT NOT NULL,name TEXT NOT NULL,closes_at INTEGER NOT NULL,frozen_at INTEGER,PRIMARY KEY(chain_id,name));
INSERT INTO playtest_slots(chain_id,name,closes_at,frozen_at)
  SELECT runs.chain_id,slots.name,slots.closes_at,slots.frozen_at FROM old_slots slots JOIN launch_runs runs
  ON runs.kind='game' AND runs.environment='madara.blitz' AND runs.name=slots.name||'-1'
  WHERE runs.chain_id<>'' AND json_extract(runs.entry,'$.kind')='paid';
DROP TABLE old_slots;
