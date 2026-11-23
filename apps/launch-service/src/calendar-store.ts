import {
  assertFrontierSeason,
  CalendarConflict,
  PHASE_END_ERROR,
  type CalendarStore,
  type SeasonPhase,
  type SeasonPhaseName,
} from "./calendar";

interface PhaseRow {
  phase: SeasonPhaseName;
  starts_at: number;
  ends_at: number;
}

const iso = (time: number) => new Date(time).toISOString();
const toPhase = (row: PhaseRow): SeasonPhase => ({
  phase: row.phase,
  startsAt: iso(row.starts_at),
  endsAt: iso(row.ends_at),
});

export class D1CalendarStore implements CalendarStore {
  constructor(private readonly db: D1Database) {}

  async list(): Promise<SeasonPhase[]> {
    const { results } = await this.db.prepare("SELECT * FROM season_phases ORDER BY starts_at, phase").all<PhaseRow>();
    return results.map(toPhase);
  }

  async set(phase: SeasonPhase, now: number): Promise<SeasonPhase> {
    const startsAt = Date.parse(phase.startsAt);
    const endsAt = Date.parse(phase.endsAt);
    const current = await this.db
      .prepare("SELECT * FROM season_phases WHERE phase = ?")
      .bind(phase.phase)
      .first<PhaseRow>();
    rejectChangeToStartedPhase(current, startsAt, endsAt, now);
    assertFrontierSeason(startsAt, endsAt);
    if (!(endsAt > now)) throw new CalendarConflict(PHASE_END_ERROR);
    return this.writePhase({ ...phase, startsAt: iso(startsAt), endsAt: iso(endsAt) }, current, now);
  }

  private async writePhase(phase: SeasonPhase, current: PhaseRow | null, now: number) {
    const startsAt = Date.parse(phase.startsAt);
    const endsAt = Date.parse(phase.endsAt);
    // Once queued, a season may already exist onchain even if its launch has failed.
    // Check both the launch queue and the row as read in this write, so neither can race an edit.
    const written = await this.db
      .prepare(
        `INSERT INTO season_phases (phase, starts_at, ends_at, updated_at)
         SELECT ?1, ?2, ?3, ?4 WHERE
           ?1 != 'frontier' OR NOT EXISTS (
             SELECT 1 FROM launch_runs WHERE kind = 'game' AND environment = 'madara.frontier'
               AND (name = 'frontier-' || CAST(?2 / 1000 AS INTEGER)
                 OR (?6 > ?4 AND name = 'frontier-' || CAST(?5 / 1000 AS INTEGER)))
           ) OR (?2 = ?5 AND ?3 = ?6)
         ON CONFLICT (phase) DO UPDATE SET starts_at = ?2, ends_at = ?3, updated_at = ?4
         WHERE season_phases.starts_at = ?5 AND season_phases.ends_at = ?6`,
      )
      .bind(phase.phase, startsAt, endsAt, now, current?.starts_at ?? null, current?.ends_at ?? null)
      .run();
    if (written.meta.changes !== 1)
      throw new CalendarConflict("The calendar changed; reload and edit again (a queued Frontier season is fixed)");
    return phase;
  }
}

const rejectChangeToStartedPhase = (current: PhaseRow | null, startsAt: number, endsAt: number, now: number) => {
  // A phase that has not started, or has ended, is free: the next season is a new start and end on the same row.
  if (!current || current.starts_at > now || current.ends_at <= now) return;
  if (current.starts_at !== startsAt) throw new CalendarConflict("A running phase keeps its start");
  if (current.phase === "frontier" && current.ends_at !== endsAt)
    throw new CalendarConflict("A started Frontier season's end is fixed");
};
