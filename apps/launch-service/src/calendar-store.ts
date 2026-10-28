import {
  assertFrontierSeason,
  CalendarConflict,
  PHASE_END_ERROR,
  type CalendarStore,
  type SeasonPhase,
  type SeasonPhaseName,
} from "./calendar";
import approved from "../../../config/source/frontier/extension.json";

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
  constructor(
    private readonly db: D1Database,
    private readonly verifyExtension?: () => Promise<unknown>,
  ) {}

  async list(): Promise<SeasonPhase[]> {
    const { results } = await this.db.prepare("SELECT * FROM season_phases ORDER BY starts_at, phase").all<PhaseRow>();
    return results.map(toPhase);
  }

  async set(phase: SeasonPhase, now: number): Promise<SeasonPhase> {
    const startsAt = Date.parse(phase.startsAt);
    const endsAt = Date.parse(phase.endsAt);
    if (phase.phase !== "frontier" && !(endsAt > startsAt)) throw new CalendarConflict("A phase ends after it starts");
    const current = await this.db
      .prepare("SELECT * FROM season_phases WHERE phase = ?")
      .bind(phase.phase)
      .first<PhaseRow>();
    const extension =
      phase.phase === "frontier" && startsAt === approved.start * 1000 && endsAt === approved.end * 1000;
    if (extension) {
      if (
        !current ||
        current.starts_at !== startsAt ||
        ![approved.oldEnd * 1000, endsAt].includes(current.ends_at) ||
        !this.verifyExtension
      )
        throw new CalendarConflict("Frontier extension calendar differs");
      // The private value service reads both confirmed contracts, never a caller-supplied proof.
      await this.verifyExtension();
    } else rejectChangeToStartedPhase(current, startsAt, endsAt, now);
    if (phase.phase === "frontier") assertFrontierSeason(startsAt, endsAt);
    if (!(endsAt > now)) throw new CalendarConflict(PHASE_END_ERROR);
    // Written only if the row is still as read, so a concurrent edit cannot slip past the started-phase rule.
    const written = await this.db
      .prepare(
        `INSERT INTO season_phases (phase, starts_at, ends_at, updated_at) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT (phase) DO UPDATE SET starts_at = ?2, ends_at = ?3, updated_at = ?4
         WHERE season_phases.starts_at = ?5 AND season_phases.ends_at = ?6`,
      )
      .bind(phase.phase, startsAt, endsAt, now, current?.starts_at ?? null, current?.ends_at ?? null)
      .run();
    if (written.meta.changes !== 1) throw new CalendarConflict("The calendar changed; reload and edit again");
    return { phase: phase.phase, startsAt: iso(startsAt), endsAt: iso(endsAt) };
  }
}

/**
 * A running phase keeps its start. Frontier keeps its end unless the approved extension is confirmed on both chains.
 * A started Blitz window may end sooner or later.
 */
const rejectChangeToStartedPhase = (current: PhaseRow | null, startsAt: number, endsAt: number, now: number) => {
  // A phase that has not started, or has ended, is free: the next season is a new start and end on the same row.
  if (!current || current.starts_at > now || current.ends_at <= now) return;
  if (current.starts_at !== startsAt) throw new CalendarConflict("A running phase keeps its start");
  if (current.phase === "frontier" && current.ends_at !== endsAt)
    throw new CalendarConflict("A started Frontier season's end is fixed");
};
