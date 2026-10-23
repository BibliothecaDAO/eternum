import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DAY_END_TIMING, mistRolls, RESTING, useDayEndStore } from "./use-day-end-store";

const moment = () => useDayEndStore.getState();
const seconds = (count: number) => vi.advanceTimersByTime(count * 1_000);

beforeEach(() => {
  vi.useFakeTimers();
  useDayEndStore.setState(RESTING);
});
afterEach(() => {
  useDayEndStore.setState(RESTING);
  vi.useRealTimers();
});

describe("a day ending with the player in the game", () => {
  it("rolls the mist, waits on the summary, drops to black, holds until the land is in, and dawns on the new day", () => {
    moment().showSummary(true);
    moment().begin("live");
    expect(moment().phase).toBe("veil");
    expect(mistRolls(moment())).toBe(true);
    seconds(DAY_END_TIMING.veil);
    expect(moment().phase).toBe("summary");
    seconds(60);
    expect(moment().phase).toBe("summary");
    expect(mistRolls(moment())).toBe(true);

    moment().continueDay();
    expect(moment().phase).toBe("nightfall");
    seconds(DAY_END_TIMING.nightfall);
    expect(moment().phase).toBe("black");
    expect(mistRolls(moment())).toBe(false);
    seconds(DAY_END_TIMING.black + 1);
    expect(moment().phase).toBe("black");

    moment().markLandReady();
    expect(moment().phase).toBe("dawn");
    seconds(DAY_END_TIMING.dawn);
    expect(moment().phase).toBe("day");
  });

  it("keeps the black up for its least time even when the land is in at once", () => {
    moment().showSummary(true);
    moment().begin("live");
    moment().skip();
    moment().continueDay();
    seconds(DAY_END_TIMING.nightfall);
    moment().markLandReady();
    expect(moment().phase).toBe("black");
    seconds(DAY_END_TIMING.black);
    expect(moment().phase).toBe("dawn");
  });

  it("never traps the player in the black: past its longest hold the screen comes up without the land", () => {
    moment().showSummary(true);
    moment().begin("live");
    moment().skip();
    moment().continueDay();
    seconds(DAY_END_TIMING.nightfall + DAY_END_TIMING.blackHold);
    expect(moment().phase).toBe("dawn");
  });

  it("skips the mist to the summary, never past it", () => {
    moment().showSummary(true);
    moment().begin("live");
    moment().skip();
    expect(moment().phase).toBe("summary");
    moment().skip();
    expect(moment().phase).toBe("summary");
  });

  it("with no summary to read (a day not played), goes from the mist straight to the black", () => {
    moment().begin("live");
    seconds(DAY_END_TIMING.veil);
    expect(moment().phase).toBe("nightfall");
  });

  it("begins once: a second turn while it plays changes nothing", () => {
    moment().begin("live");
    moment().begin("later");
    expect(moment()).toMatchObject({ phase: "veil", arrival: "live" });
  });
});

describe("a day that ended before the game opened", () => {
  it("opens on the summary over the new land, rolls no mist, and drops to the black at Continue for the camera", () => {
    moment().showSummary(true);
    moment().begin("later");
    expect(moment().phase).toBe("summary");
    expect(mistRolls(moment())).toBe(false);
    moment().continueDay();
    expect(moment().phase).toBe("nightfall");
    seconds(DAY_END_TIMING.nightfall);
    expect(moment().phase).toBe("black");
    moment().markLandReady();
    seconds(DAY_END_TIMING.black);
    expect(moment().phase).toBe("dawn");
    seconds(DAY_END_TIMING.dawn);
    expect(moment().phase).toBe("day");
  });
});
