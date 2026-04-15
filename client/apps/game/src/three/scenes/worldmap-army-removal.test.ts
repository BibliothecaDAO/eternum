import { describe, expect, it } from "vitest";
import { isStaleTrackedArmyTileRemoval } from "./worldmap-army-removal";

describe("isStaleTrackedArmyTileRemoval", () => {
  it("treats a tile removal as stale when the tracked army already moved elsewhere", () => {
    expect(
      isStaleTrackedArmyTileRemoval({
        reason: "tile",
        trackedPosition: { col: 12, row: 15 },
        removalPosition: { col: 10, row: 10 },
      }),
    ).toBe(true);
  });

  it("keeps matching tracked tile removals eligible for normal processing", () => {
    expect(
      isStaleTrackedArmyTileRemoval({
        reason: "tile",
        trackedPosition: { col: 10, row: 10 },
        removalPosition: { col: 10, row: 10 },
      }),
    ).toBe(false);
  });

  it("ignores non-tile removals and missing positions", () => {
    expect(
      isStaleTrackedArmyTileRemoval({
        reason: "zero",
        trackedPosition: { col: 10, row: 10 },
        removalPosition: { col: 12, row: 15 },
      }),
    ).toBe(false);

    expect(
      isStaleTrackedArmyTileRemoval({
        reason: "tile",
        trackedPosition: undefined,
        removalPosition: { col: 10, row: 10 },
      }),
    ).toBe(false);
  });
});
