ALTER TABLE playtest_slots RENAME TO prior_slots;
CREATE TABLE playtest_slots (
  slot_id INTEGER PRIMARY KEY AUTOINCREMENT,
  chain_id TEXT NOT NULL,
  name TEXT NOT NULL,
  closes_at INTEGER NOT NULL,
  frozen_at INTEGER,
  UNIQUE(chain_id,name)
);
INSERT INTO playtest_slots(chain_id,name,closes_at,frozen_at)
  SELECT chain_id,name,closes_at,frozen_at FROM prior_slots;
DROP TABLE prior_slots;
ALTER TABLE launch_runs ADD COLUMN slot_id INTEGER;
ALTER TABLE launch_runs DROP COLUMN entry;
