-- A launcher can register gameplay accounts that no Realms account signed in for (harness bots, invited rosters), so a
-- registration is keyed by its account and its Realms account is optional. No slot has registered players yet.
DROP TABLE playtest_registrations;

CREATE TABLE playtest_registrations (
  slot_name TEXT NOT NULL REFERENCES playtest_slots (name) ON DELETE CASCADE,
  account TEXT NOT NULL,
  realms_id TEXT,
  position INTEGER NOT NULL,
  game_number INTEGER CHECK (game_number > 0),
  PRIMARY KEY (slot_name, account),
  UNIQUE (slot_name, realms_id),
  UNIQUE (slot_name, position)
);
