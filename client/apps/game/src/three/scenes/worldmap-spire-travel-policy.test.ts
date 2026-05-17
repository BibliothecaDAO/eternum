import { TileOccupier } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";
import { resolveSpireTraversalAction, resolveSpireTraversalDestinationHex } from "./worldmap-spire-travel-policy";

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

  it("returns blocked when a friendly ethereal explorer occupies the linked spire tile", () => {
    const result = resolveSpireTraversalAction({
      targetHex: { col: 100, row: 200 },
      etherealTile: {
        occupier_id: 42,
        occupier_type: TileOccupier.ExplorerKnightT1Regular,
        occupier_is_structure: false,
      },
      isOpposingArmy: () => false,
    });

    expect(result).toEqual({
      kind: "blocked",
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

  it("returns blocked when a non-explorer occupies the paired-layer destination", () => {
    const result = resolveSpireTraversalAction({
      targetHex: { col: 100, row: 200 },
      etherealTile: {
        occupier_id: 77,
        occupier_type: TileOccupier.Chest,
        occupier_is_structure: false,
      },
    });

    expect(result).toEqual({
      kind: "blocked",
      targetArmyId: 77,
      targetHex: { col: 100, row: 200 },
    });
  });

  it("uses the path origin as the paired-layer destination for spire traversal", () => {
    expect(resolveSpireTraversalDestinationHex([{ hex: { col: 10, row: 20 } }, { hex: { col: 11, row: 20 } }])).toEqual(
      {
        col: 10,
        row: 20,
      },
    );
  });
});
