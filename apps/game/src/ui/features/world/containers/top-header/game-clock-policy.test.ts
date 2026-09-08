// @vitest-environment node
import { expect, it } from "vitest";
import { resolveGameClock, formatGameClockDuration } from "./game-clock-policy";
const clock = (now: number, overrides = {}) =>
  resolveGameClock({ startAt: 120, endAt: 720, now, armyTickSeconds: 60, ...overrides });
it("changes from start countdown to remaining time at the horn", () => {
  expect(clock(60)).toMatchObject({ phase: "before", label: "Starts in 1m 00s", remainingRatio: null });
  expect(clock(120)).toMatchObject({ phase: "live", label: "10m 00s left", remainingRatio: 1 });
});
it("moves the bar once per army tick, even when the start is not tick aligned", () => {
  expect(clock(121).remainingRatio).toBe(clock(179).remainingRatio);
  expect(clock(180).remainingRatio).toBe(0.9);
  expect(clock(180, { startAt: 125 }).remainingRatio).toBe(0.9);
});
it("handles final minutes, finished and unbounded games", () => {
  expect(clock(600).label).toBe("2m 00s left");
  expect(clock(720).phase).toBe("finished");
  expect(clock(121, { endAt: null })).toMatchObject({ label: "No time limit", remainingRatio: null });
});
it("does not invent missing clock configuration", () => {
  expect(clock(0).phase).toBe("unavailable");
  expect(clock(100, { startAt: null }).phase).toBe("unavailable");
  expect(() => clock(121, { armyTickSeconds: 0 })).toThrow("Army tick duration is unavailable");
});
it("formats short and multi-day durations", () => {
  expect(formatGameClockDuration(4328)).toBe("1h 12m 08s");
  expect(formatGameClockDuration(68)).toBe("1m 08s");
  expect(formatGameClockDuration(90000)).toBe("1d 01h 0m 00s");
});
