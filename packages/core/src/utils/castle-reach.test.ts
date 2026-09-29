import { describe, expect, it } from "vitest";
import { buildablePlotCount, buildableRadius } from "./castle-reach";

describe("castle reach", () => {
  it("adds one ring of plots per castle level, as the contract's path limit does", () => {
    expect([0, 1, 2, 3].map(buildableRadius)).toEqual([1, 2, 3, 4]);
    expect([0, 1, 2, 3].map(buildablePlotCount)).toEqual([6, 18, 36, 60]);
  });
});
