import { describe, expect, it } from "vitest";
import { resolveOwnershipPulseHexes } from "./worldmap-ownership-pulse-policy";

describe("resolveOwnershipPulseHexes", () => {
  it("suppresses the selected army hex so home-realm pulses do not overlap the selection pulse", () => {
    expect(
      resolveOwnershipPulseHexes({
        structureHex: { col: 10, row: 10 },
        ownedArmyHexes: [
          { col: 11, row: 10 },
          { col: 12, row: 10 },
        ],
        suppressedHexes: [{ col: 11, row: 10 }],
      }),
    ).toEqual([
      { col: 10, row: 10 },
      { col: 12, row: 10 },
    ]);
  });

  it("dedupes repeated ownership pulse hexes while preserving insertion order", () => {
    expect(
      resolveOwnershipPulseHexes({
        structureHex: { col: 10, row: 10 },
        ownedArmyHexes: [
          { col: 11, row: 10 },
          { col: 11, row: 10 },
        ],
        extraHexes: [{ col: 10, row: 10 }],
      }),
    ).toEqual([
      { col: 10, row: 10 },
      { col: 11, row: 10 },
    ]);
  });
});
