CREATE TABLE season_phases_without_preset (
  phase TEXT PRIMARY KEY CHECK (phase IN ('frontier', 'blitz')),
  starts_at INTEGER NOT NULL,
  ends_at INTEGER NOT NULL CHECK (ends_at > starts_at),
  updated_at INTEGER NOT NULL
);
INSERT INTO season_phases_without_preset (phase, starts_at, ends_at, updated_at)
  SELECT phase, starts_at, ends_at, updated_at FROM season_phases;
DROP TABLE season_phases;
ALTER TABLE season_phases_without_preset RENAME TO season_phases;
