import { nativeResearchConstants as research } from "@bibliothecadao/eternum/game-client";
import { describe, expect, it } from "vitest";

import { sidesTaken } from "./sides-taken";

describe("the sides a row has taken", () => {
  it("reads one mark per tier bought, in order, and none for a row without a choice", () => {
    // realm-research's layout: the Farm row's tier in bits 0-2, its choice at each tier from bit 3, one bit each.
    const farmTwoTiers = 2n + (0n << 3n) + (1n << 4n);
    expect(sidesTaken(farmTwoTiers, research.ROW_FARM)).toEqual(["Fi", "Gr"]);
    expect(sidesTaken(0n, research.ROW_FARM)).toEqual([]);
    expect(sidesTaken(farmTwoTiers, research.ROW_HUT)).toEqual([]);
  });
});
