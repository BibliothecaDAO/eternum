-- A slot's players are Realms accounts, and the roster carries the gameplay account each has on the shard. Wallets no
-- longer name players, so the registrations are recreated with both columns; no slot has registered players yet.
DROP TABLE playtest_registrations;

CREATE TABLE playtest_registrations (
  slot_name TEXT NOT NULL REFERENCES playtest_slots (name) ON DELETE CASCADE,
  realms_id TEXT NOT NULL,
  account TEXT NOT NULL,
  position INTEGER NOT NULL,
  game_number INTEGER CHECK (game_number > 0),
  PRIMARY KEY (slot_name, realms_id),
  UNIQUE (slot_name, account),
  UNIQUE (slot_name, position)
);
