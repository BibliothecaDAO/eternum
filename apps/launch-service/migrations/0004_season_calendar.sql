-- The season calendar: each phase's planned start and end, in Unix milliseconds, edited by launchers. The cron tick
-- creates the Frontier season game at its start and schedules Blitz slots only inside the Blitz window.
CREATE TABLE season_phases (
  phase TEXT PRIMARY KEY CHECK (phase IN ('frontier', 'blitz')),
  starts_at INTEGER NOT NULL,
  ends_at INTEGER NOT NULL CHECK (ends_at > starts_at),
  updated_at INTEGER NOT NULL
);
