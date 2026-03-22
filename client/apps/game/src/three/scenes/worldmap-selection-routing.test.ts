import { describe, expect, it } from "vitest";
import { resolveWorldmapHexClickPlan } from "./worldmap-selection-routing";

describe("resolveWorldmapHexClickPlan", () => {
  it("ignores clicks while a shepherd overlay blocks interaction", () => {
    expect(
      resolveWorldmapHexClickPlan({
        hasBlockingOverlay: true,
        hexCoords: { col: 1, row: 1 },
        accountAddress: 7n,
      }),
    ).toEqual({ kind: "ignore" });
  });

  it("selects the player's own army", () => {
    expect(
      resolveWorldmapHexClickPlan({
        hasBlockingOverlay: false,
        hexCoords: { col: 1, row: 1 },
        accountAddress: 7n,
        army: { id: 101, owner: 7n },
      }),
    ).toEqual({
      kind: "select",
      isMine: true,
      selection: {
        type: "army",
        entityId: 101,
      },
    });
  });

  it("selects the player's own structure when no owned army is present", () => {
    expect(
      resolveWorldmapHexClickPlan({
        hasBlockingOverlay: false,
        hexCoords: { col: 1, row: 1 },
        accountAddress: 7n,
        structure: { id: 202, owner: 7n },
      }),
    ).toEqual({
      kind: "select",
      isMine: true,
      selection: {
        type: "structure",
        entityId: 202,
      },
    });
  });

  it("clears entity selection for chests and empty tiles", () => {
    expect(
      resolveWorldmapHexClickPlan({
        hasBlockingOverlay: false,
        hexCoords: { col: 1, row: 1 },
        accountAddress: 7n,
        chest: { id: 303 },
      }),
    ).toEqual({
      kind: "select",
      isMine: false,
      selection: {
        type: "clear",
      },
    });

    expect(
      resolveWorldmapHexClickPlan({
        hasBlockingOverlay: false,
        hexCoords: { col: 1, row: 1 },
        accountAddress: 7n,
      }),
    ).toEqual({
      kind: "select",
      isMine: false,
      selection: {
        type: "clear",
      },
    });
  });
});
