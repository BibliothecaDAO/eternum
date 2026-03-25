import { TileOccupier } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";
import { resolveSpireTraversalAction } from "./worldmap-spire-travel-policy";

describe("resolveSpireTraversalAction", () => {
  it("returns attack when an ethereal explorer occupies the linked spire tile", () => {
    const result = resolveSpireTraversalAction({
      targetHex: { col: 100, row: 200 },
      etherealTile: {
        occupier_id: 42,
        occupier_type: TileOccupier.ExplorerKnightT1Regular,
        occupier_is_structure: false,
      },
    });

    expect(result).toEqual({
      kind: "attack",
      targetArmyId: 42,
      targetHex: { col: 100, row: 200 },
    });
  });

  it("returns travel when no ethereal explorer occupies the linked spire tile", () => {
    const result = resolveSpireTraversalAction({
      targetHex: { col: 100, row: 200 },
      etherealTile: {
        occupier_id: 0,
        occupier_type: TileOccupier.None,
        occupier_is_structure: false,
      },
    });

    expect(result).toEqual({
      kind: "travel",
      targetHex: { col: 100, row: 200 },
    });
  });
});
