CREATE TABLE IF NOT EXISTS playtest_slots (
  name text PRIMARY KEY,
  closes_at timestamptz NOT NULL,
  frozen_at timestamptz,
  CHECK (name ~ '^[a-z0-9][a-z0-9-]{0,23}$')
);

CREATE TABLE IF NOT EXISTS playtest_registrations (
  slot_name text NOT NULL REFERENCES playtest_slots(name),
  owner text NOT NULL,
  position bigint GENERATED ALWAYS AS IDENTITY,
  game_number integer CHECK (game_number > 0),
  PRIMARY KEY (slot_name, owner),
  UNIQUE (slot_name, position)
);
