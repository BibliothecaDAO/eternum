-- Existing Frontier seasons used preset 5. Every new Frontier write must name its preset.
CREATE TABLE season_phases_with_preset (
  phase TEXT PRIMARY KEY CHECK (phase IN ('frontier', 'blitz')),
  starts_at INTEGER NOT NULL,
  ends_at INTEGER NOT NULL CHECK (ends_at > starts_at),
  updated_at INTEGER NOT NULL,
  preset_id INTEGER,
  CHECK ((phase = 'frontier' AND preset_id IS NOT NULL AND typeof(preset_id) = 'integer' AND preset_id > 0)
      OR (phase = 'blitz' AND preset_id IS NULL))
);
INSERT INTO season_phases_with_preset (phase, starts_at, ends_at, updated_at, preset_id)
  SELECT phase, starts_at, ends_at, updated_at, CASE WHEN phase = 'frontier' THEN 5 ELSE NULL END FROM season_phases;
DROP TABLE season_phases;
ALTER TABLE season_phases_with_preset RENAME TO season_phases;
