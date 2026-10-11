-- Ledger slot numbers are local to a shard, including wallet-opened slots.
ALTER TABLE playtest_slots RENAME TO prior_slots;
CREATE TABLE playtest_slots (
  slot_id INTEGER NOT NULL,
  chain_id TEXT NOT NULL,
  name TEXT NOT NULL,
  closes_at INTEGER NOT NULL,
  frozen_at INTEGER,
  PRIMARY KEY(chain_id,slot_id),
  UNIQUE(chain_id,name)
);
INSERT INTO playtest_slots SELECT slot_id,chain_id,name,closes_at,frozen_at FROM prior_slots;
DROP TABLE prior_slots;
