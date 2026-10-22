/**
 * The Frontier day end as a moment, in two directions the owner picks between:
 *
 * - night: the day's summary rises over the map while the spire's mist rolls across it; Continue drops the screen
 *   to black and it comes back up on the new day's land.
 * - dawn: the mist rolls under one line ("Day 1 done"), the screen drops to black on its own, and the summary waits
 *   docked beside the new day's land, the map live behind it.
 *
 * A player who opens the game after the day ended never saw the old land go: the moment starts on the new land.
 */
export type DayEndDirection = "night" | "dawn";
export type DayEndArrival = "live" | "later";

export type DayEndPhase =
  /** Before the day ends: the map as it was played. */
  | "day"
  /** The spire's orb gathers and bursts, and the mist rolls out. */
  | "veil"
  /** The summary over the map, until Continue. */
  | "summary"
  /** The screen fades to black. */
  | "nightfall"
  /** Black: the realm moves to its new land behind it. */
  | "black"
  /** The screen comes back up and the realm's new surroundings come out of the shroud. */
  | "dawn"
  /** The new day: in the dawn direction, its summary docked until Continue. */
  | "new-day";

export interface DayEndState {
  direction: DayEndDirection;
  arrival: DayEndArrival;
  phase: DayEndPhase;
  /** Seconds in the phase. */
  seconds: number;
  /** The dawn direction's docked summary, closed with Continue. */
  dismissed: boolean;
}

/** Each timed phase's length in seconds; `summary` waits for Continue and `day` and `new-day` for nothing. */
export const DAY_END_TIMING = {
  /** Night: the orb's burst plays clear of the card, which rises once the mist is rolling. */
  nightVeil: 3,
  /** Dawn: the mist rolls under its one line, at 1.5× the game end's pace, and leaves before it settles. */
  dawnVeil: 4.2,
  nightfall: 0.6,
  /** At least this long, so the land's swap never shows; the real map holds black until its new rows are in. */
  black: 0.4,
  dawn: 1.4,
} as const;

/** How fast the game end's veil plays in each direction: the dawn direction does not wait on a summary. */
export const VEIL_PACE: Record<DayEndDirection, number> = { night: 1, dawn: 1.5 };

export const restingDay = (direction: DayEndDirection, arrival: DayEndArrival): DayEndState => ({
  direction,
  arrival,
  phase: "day",
  seconds: 0,
  dismissed: false,
});

/**
 * The day turns. Live, the old land is still on screen, so the mist rolls over it. Later, the old land is gone: the
 * night direction opens its summary over the new land in the dark, the dawn direction opens on black.
 */
export function endTheDay(state: DayEndState): DayEndState {
  const phase: DayEndPhase = state.arrival === "live" ? "veil" : state.direction === "night" ? "summary" : "black";
  return { ...state, phase, seconds: 0 };
}

/** Advances the clock; a timed phase hands over to the next when it has run. */
export function advance(state: DayEndState, delta: number): DayEndState {
  const seconds = state.seconds + delta;
  const length = phaseLength(state);
  if (length === null || seconds < length) return { ...state, seconds };
  return { ...state, phase: nextPhase(state), seconds: 0 };
}

/**
 * The summary's Continue: the night direction's summary drops to black (or straight to dawn, arriving later, when the
 * land behind it is already the new one); the dawn direction's docked summary closes.
 */
export function continueDay(state: DayEndState): DayEndState {
  if (state.phase === "summary")
    return { ...state, phase: state.arrival === "later" ? "dawn" : "nightfall", seconds: 0 };
  if (summaryDocked(state)) return { ...state, dismissed: true };
  return state;
}

/** Skip: whatever is playing jumps to where the player gets the map back, never past a summary they have not seen. */
export function skip(state: DayEndState): DayEndState {
  if (state.phase === "veil")
    return { ...state, phase: state.direction === "night" ? "summary" : "nightfall", seconds: 0 };
  if (state.phase === "dawn") return { ...state, phase: "new-day", seconds: 0 };
  return state;
}

/** Whether the dawn direction's summary shows docked on the new day. */
export const summaryDocked = (state: DayEndState) =>
  state.direction === "dawn" && state.phase === "new-day" && !state.dismissed;

function phaseLength(state: DayEndState): number | null {
  if (state.phase === "veil") return state.direction === "night" ? DAY_END_TIMING.nightVeil : DAY_END_TIMING.dawnVeil;
  if (state.phase === "nightfall" || state.phase === "black" || state.phase === "dawn")
    return DAY_END_TIMING[state.phase];
  return null;
}

function nextPhase(state: DayEndState): DayEndPhase {
  if (state.phase === "veil") return state.direction === "night" ? "summary" : "nightfall";
  if (state.phase === "nightfall") return "black";
  if (state.phase === "black") return "dawn";
  return "new-day";
}
