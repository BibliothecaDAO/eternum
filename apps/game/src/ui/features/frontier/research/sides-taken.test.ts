import { nativeResearchConstants as research } from "@bibliothecadao/eternum/game-client";
import { describe, expect, it } from "vitest";

import { sidesTaken } from "./sides-taken";

describe("the sides a row has taken", () => {
  it("reads one mark per side upgrade, and none for a row without a choice", () => {
    // Fields and Granary each have one upgrade in their three-bit fields.
    const farmTwoTiers = 1n + (1n << 3n);
    expect(sidesTaken(farmTwoTiers, research.ROW_FARM)).toEqual(["fields", "granary"]);
    expect(sidesTaken(0n, research.ROW_FARM)).toEqual([]);
    expect(sidesTaken(farmTwoTiers, research.ROW_HUT)).toEqual([]);
  });
});
