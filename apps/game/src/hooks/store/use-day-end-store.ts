import { create } from "zustand";

/**
 * A Frontier day's end, as one moment (owner, 2026-10-22: "nightfall is perfect for day end"): the spires' mist rolls
 * over the map and the day's summary rises over it; Continue drops the screen to black, the realm's new land comes in
 * behind it with the camera on the realm, and the screen comes back up on the new day.
 *
 * Who plays which part: ExpeditionRollover begins it at the day's turn and brings the new land in behind the black;
 * the renderer rolls the game end's veil while `mistRolls` holds; the Frontier HUD's DayDone says whether there is a
 * summary, draws it with the black and the way past them, and begins the moment for a player who opens the game after
 * the day ended. The store keeps its own time, so the moment ends even where nothing draws it.
 */
type DayEndArrival =
  /** In the game as the day ends: the mist rolls over the land that is ending. */
  | "live"
  /** Opened after it ended: the new land is already there, so the summary waits over it in the dark. */
  | "later";

export type DayEndPhase =
  /** No day is ending: the map as it is played. */
  | "day"
  /** The spires' orb gathers and bursts, and the mist rolls out. */
  | "veil"
  /** The ended day's summary over the map, until Continue. */
  | "summary"
  /** The screen fades to black. */
  | "nightfall"
  /** Black, while the realm's new land comes in. */
  | "black"
  /** The screen comes back up on the new day. */
  | "dawn";

/** The ended day's summary: still being read from the player's history, there to read, or none (a day not played). */
export type DaySummary = "waiting" | "shown" | "none";

interface DayEndMoment {
  phase: DayEndPhase;
  arrival: DayEndArrival;
  /**
   * The summary phase waits for Continue while the summary is shown, waits for it while it is still being read (at
   * most `summaryWait`), and passes at once when there is none.
   */
  summary: DaySummary;
  /** The summary phase passed while the summary was still being read: once read, it opens as a later arrival's. */
  summaryMissed: boolean;
  /**
   * The new day's land is in (re-projected, the camera on the realm): the rollover says so once it has moved it, also
   * after the black lifted without it. A day's end is gone through only then.
   */
  landReady: boolean;
  /** The black has shown for its least time. It lifts once this and `landReady` both hold. */
  blackHeld: boolean;
}

/** Each timed phase's length in seconds; the summary waits for Continue and the black also for the land. */
export const DAY_END_TIMING = {
  /** The orb's burst plays clear of the summary, which rises once the mist is rolling. */
  veil: 3,
  /** The longest the summary phase waits for the player's history; past it the moment goes on without the summary. */
  summaryWait: 10,
  nightfall: 0.6,
  /** The black's least time, so the land's swap never shows. */
  black: 0.4,
  /**
   * The longest the black waits for the land; past it the screen comes up anyway, never trapping the player, and the
   * land still comes in when it can.
   */
  blackHold: 10,
  dawn: 1.4,
} as const;

export const RESTING: DayEndMoment = {
  phase: "day",
  arrival: "live",
  summary: "none",
  summaryMissed: false,
  landReady: false,
  blackHeld: false,
};

/** The day ends: live, the mist rolls over the old land; later, the summary opens over the new one. */
function beginDayEnd(moment: DayEndMoment, arrival: DayEndArrival): DayEndMoment {
  if (moment.phase !== "day") return moment;
  return {
    ...moment,
    phase: arrival === "live" ? "veil" : "summary",
    arrival,
    summaryMissed: false,
    landReady: false,
    blackHeld: false,
  };
}

/** A timed phase has run: the next one begins. The black lifts once it has held and the new land is in. */
function nextPhase(moment: DayEndMoment): DayEndMoment {
  switch (moment.phase) {
    case "veil":
      return { ...moment, phase: "summary" };
    case "nightfall":
      return { ...moment, phase: "black" };
    case "black":
      return moment.landReady && moment.blackHeld ? { ...moment, phase: "dawn" } : moment;
    case "dawn":
      return { ...RESTING, summary: moment.summary, summaryMissed: moment.summaryMissed };
    default:
      return moment;
  }
}

/**
 * The summary's Continue drops the screen to black, however the day ended: behind it the camera comes onto the realm,
 * which a later arrival's map may have opened away from (owner, 2026-10-23: "when the day passes it doesnt focus on the
 * enw realm location").
 */
function continueDayEnd(moment: DayEndMoment): DayEndMoment {
  if (moment.phase !== "summary") return moment;
  return { ...moment, phase: "nightfall" };
}

/** With no summary to read (a day not played, another realm in view), the summary phase passes at once. */
const passUnreadSummary = (moment: DayEndMoment): DayEndMoment =>
  moment.summary === "none" ? continueDayEnd(moment) : moment;

/** The history did not answer in time: the moment goes on, and the summary is owed once it is read. */
const passUnansweredSummary = (moment: DayEndMoment): DayEndMoment =>
  moment.summary === "waiting" && moment.phase === "summary"
    ? { ...continueDayEnd(moment), summaryMissed: true }
    : moment;

/** The new land is in: a black that has held lifts on it; after the black, the moment only learns it. */
const landIn = (moment: DayEndMoment): DayEndMoment => {
  const ready = { ...moment, landReady: true };
  return ready.phase === "black" ? nextPhase(ready) : ready;
};

/** The black has waited its longest for the land: the screen comes up on the new day without it. */
const liftTheBlack = (moment: DayEndMoment): DayEndMoment =>
  moment.phase === "black" ? { ...moment, phase: "dawn", blackHeld: true } : moment;

/** Skip: the rolling mist jumps to the summary, never past it. */
function skipDayEnd(moment: DayEndMoment): DayEndMoment {
  return moment.phase === "veil" ? passUnreadSummary({ ...moment, phase: "summary" }) : moment;
}

/** The game end's veil rolls over the map from the day's turn until the screen is black. */
export const mistRolls = (moment: DayEndMoment): boolean =>
  moment.arrival === "live" && (moment.phase === "veil" || moment.phase === "summary" || moment.phase === "nightfall");

interface DayEndStore extends DayEndMoment {
  begin: (arrival: DayEndArrival) => void;
  /** No day ending: the moment put away, the summary's state kept (its owner says what it is). */
  rest: () => void;
  continueDay: () => void;
  skip: () => void;
  markLandReady: () => void;
  /**
   * What the ended day's summary is now: one found to be none lets a waiting summary phase pass, and is owed no more.
   */
  showSummary: (summary: DaySummary) => void;
}

export const useDayEndStore = create<DayEndStore>((set) => ({
  ...RESTING,
  begin: (arrival) => set((moment) => beginDayEnd(moment, arrival)),
  rest: () => set((moment) => ({ ...RESTING, summary: moment.summary })),
  continueDay: () => set((moment) => continueDayEnd(moment)),
  skip: () => set((moment) => skipDayEnd(moment)),
  markLandReady: () => set((moment) => landIn(moment)),
  showSummary: (summary) =>
    set((moment) =>
      passUnreadSummary({ ...moment, summary, summaryMissed: summary !== "none" && moment.summaryMissed }),
    ),
}));

/** Each phase's time, started as it begins and dropped when it ends early (a Continue, a skip). */
let timers: ReturnType<typeof setTimeout>[] = [];
const after = (seconds: number, step: (moment: DayEndMoment) => DayEndMoment) =>
  timers.push(setTimeout(() => useDayEndStore.setState((moment) => step(moment)), seconds * 1_000));

useDayEndStore.subscribe((moment, before) => {
  if (moment.phase === before.phase) return;
  timers.forEach(clearTimeout);
  timers = [];
  if (moment.phase === "veil") after(DAY_END_TIMING.veil, nextPhase);
  if (moment.phase === "summary") {
    after(DAY_END_TIMING.summaryWait, passUnansweredSummary);
    useDayEndStore.setState(passUnreadSummary);
  }
  if (moment.phase === "nightfall") after(DAY_END_TIMING.nightfall, nextPhase);
  if (moment.phase === "black") {
    after(DAY_END_TIMING.black, (held) => nextPhase({ ...held, blackHeld: true }));
    after(DAY_END_TIMING.blackHold, liftTheBlack);
  }
  if (moment.phase === "dawn") after(DAY_END_TIMING.dawn, nextPhase);
});
