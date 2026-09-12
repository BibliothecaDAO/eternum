import { TileOccupier } from "@bibliothecadao/types";
import { describe, expect, it, vi } from "vitest";
import { resolveSpireTraversalAction } from "./worldmap-spire-travel-policy";

describe("resolveSpireTraversalAction", () => {
  it.each([false, true])("targets the attacker's coordinate on the other layer (attacker alt=%s)", (attackerAlt) => {
    const getTile = vi.fn(() => ({
      occupier_id: 42,
      occupier_type: TileOccupier.ExplorerKnightT1Regular,
      occupier_is_structure: false,
    }));
    expect(resolveSpireTraversalAction({ attackerHex: { col: 100, row: 200 }, attackerAlt, getTile })).toEqual({
      kind: "attack",
      targetArmyId: 42,
      targetHex: { col: 100, row: 200 },
      defenderAlt: !attackerAlt,
    });
    expect(getTile).toHaveBeenCalledWith(!attackerAlt, 100, 200);
  });
  it("travels when the destination is empty", () => {
    expect(
      resolveSpireTraversalAction({
        attackerHex: { col: 100, row: 200 },
        attackerAlt: false,
        getTile: () => undefined,
      }),
    ).toEqual({
      kind: "travel",
      targetHex: { col: 100, row: 200 },
    });
  });
});
