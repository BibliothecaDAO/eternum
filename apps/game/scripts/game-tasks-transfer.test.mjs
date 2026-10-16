import { describe, expect, it } from "vitest";
import { GAME_TASKS } from "./game-tasks.mjs";

const ALPHA = 22;
const BETA = 33;
const HOME = 11;
/** The reading just before Send: 2 wheat to Alpha and Beta, and every holding's wheat as the facts hold it. */
const before = { total: 2, chosen: [ALPHA, BETA], stock: { [HOME]: 100, [ALPHA]: 40, [BETA]: 7 } };

describe.each(["blitz-transfer-window", "blitz-transfer-balances", "blitz-transfer-gesture"])(
  "the %s task's outcome",
  (name) => {
    const { expect: arrived } = GAME_TASKS[name];

    it("passes when every chosen holding's wheat rose by its share", () => {
      expect(arrived(before, { total: 0, chosen: [], stock: { [HOME]: 98, [ALPHA]: 41, [BETA]: 8 } })).toBe(true);
    });

    it("fails when one destination's shipment landed nowhere, whatever else moved", () => {
      expect(arrived(before, { total: 0, chosen: [], stock: { [HOME]: 98, [ALPHA]: 41, [BETA]: 7 } })).toBe(false);
    });

    it("fails on a reading without the facts, as the old wheat-or-arrivals reading was", () => {
      expect(arrived({ arriving: 0, wheat: 100 }, { arriving: 1, wheat: 99 })).toBe(false);
      expect(arrived(null, null)).toBe(false);
    });
  },
);
