import { describe, expect, it } from "vitest";

import { clearXp } from "./clear-xp";

describe("clear XP", () => {
  // contracts/l3/world-native/src/tests/progression.cairo: a_clear_pays_two_and_a_half_times_the_root_of_the_guard_strength.
  it("pays floor(isqrt(25 x guard) / 2) for the guard the site started with", () => {
    for (const [guard, xp] of [
      [430, 51],
      [1_300, 90],
      [3_000, 136],
      [25_000, 395],
      [49_500, 556],
    ]) {
      expect(clearXp(guard)).toBe(xp);
    }
  });
});
