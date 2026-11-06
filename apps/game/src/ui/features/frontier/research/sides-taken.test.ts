import { nativeResearchConstants as research } from "@bibliothecadao/eternum/game-client";
import { describe, expect, it } from "vitest";

import { sidePicks } from "./sides-taken";

describe("the sides a row has taken", () => {
  it("reads each side's upgrades, make side first, and none for a row without a choice", () => {
    // Fields has two upgrades and Granary one, in their three-bit fields.
    const farm = 2n + (1n << 3n);
    expect(sidePicks(farm, research.ROW_FARM)).toEqual([
      { icon: "fields", picks: 2 },
      { icon: "granary", picks: 1 },
    ]);
    expect(sidePicks(0n, research.ROW_FARM)).toEqual([
      { icon: "fields", picks: 0 },
      { icon: "granary", picks: 0 },
    ]);
    expect(sidePicks(farm, research.ROW_HUT)).toBeUndefined();
  });
});
