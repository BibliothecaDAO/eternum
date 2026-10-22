import { describe, expect, it } from "vitest";

import {
  advance,
  continueDay,
  DAY_END_TIMING,
  endTheDay,
  restingDay,
  skip,
  summaryDocked,
  type DayEndArrival,
  type DayEndDirection,
  type DayEndState,
} from "./sequence";

/** Plays the clock in small steps, as frames do, and lists each phase as it begins. */
function play(state: DayEndState, seconds: number): { state: DayEndState; phases: string[] } {
  const phases: string[] = [];
  for (let t = 0; t < seconds; t += 0.05) {
    const next = advance(state, 0.05);
    if (next.phase !== state.phase) phases.push(next.phase);
    state = next;
  }
  return { state, phases };
}

const ended = (direction: DayEndDirection, arrival: DayEndArrival) => endTheDay(restingDay(direction, arrival));

describe("the night direction", () => {
  it("rolls the mist, then waits on the summary until Continue, then drops to black and comes up on the new day", () => {
    const waiting = play(ended("night", "live"), 30);
    expect(waiting.phases).toEqual(["summary"]);
    const after = play(continueDay(waiting.state), 5);
    expect(after.phases).toEqual(["black", "dawn", "new-day"]);
    expect(summaryDocked(after.state)).toBe(false);
  });

  it("skips the mist straight to the summary, never past it", () => {
    const skipped = skip(ended("night", "live"));
    expect(skipped.phase).toBe("summary");
    expect(skip(skipped).phase).toBe("summary");
  });

  it("opened later, shows the summary over the new land and continues straight to dawn", () => {
    const later = ended("night", "later");
    expect(later.phase).toBe("summary");
    expect(continueDay(later).phase).toBe("dawn");
  });
});

describe("the dawn direction", () => {
  it("plays through to the new day on its own, in under seven seconds, with the summary docked there", () => {
    const { state, phases } = play(ended("dawn", "live"), 7);
    expect(phases).toEqual(["nightfall", "black", "dawn", "new-day"]);
    expect(
      DAY_END_TIMING.dawnVeil + DAY_END_TIMING.nightfall + DAY_END_TIMING.black + DAY_END_TIMING.dawn,
    ).toBeLessThan(7);
    expect(summaryDocked(state)).toBe(true);
    expect(summaryDocked(continueDay(state))).toBe(false);
  });

  it("skips the mist to the nightfall, and the dawn to the new day", () => {
    expect(skip(ended("dawn", "live")).phase).toBe("nightfall");
    expect(skip({ ...ended("dawn", "live"), phase: "dawn" }).phase).toBe("new-day");
  });

  it("opened later, starts on black", () => {
    expect(ended("dawn", "later").phase).toBe("black");
  });
});
