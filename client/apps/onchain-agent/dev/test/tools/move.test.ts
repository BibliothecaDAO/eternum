import { describe, expect, it, vi } from "vitest";

import { moveArmy } from "../../../src/tools/core/move";

describe("moveArmy", () => {
  it("rejects foreign armies before submitting movement transactions", async () => {
    const explorerTravel = vi.fn();
    const explorerExplore = vi.fn();
    const explorerInfo = vi.fn(async () => ({
      entityId: 77,
      ownerName: "Enemy",
      ownerAddress: "0x2",
      troopType: "Knight",
      troopTier: "T1",
      troopCount: 1000,
      stamina: 100,
      staminaUpdatedTick: 0,
      position: { x: 0, y: 0 },
    }));

    const result = await moveArmy({ armyId: 77, targetX: 1, targetY: 0 }, {
      client: {
        view: {
          explorerInfo,
        },
      },
      provider: {
        explorer_travel: explorerTravel,
        explorer_explore: explorerExplore,
      },
      signer: {},
      playerAddress: "0x1",
      gameConfig: {
        stamina: {},
      },
      snapshot: {
        tiles: [],
        gridIndex: new Map(),
      },
      mapCenter: 0,
    } as any);

    expect(result.success).toBe(false);
    expect(result.message).toBe("Army 77 is not yours.");
    expect(explorerInfo).toHaveBeenCalledWith(77);
    expect(explorerTravel).not.toHaveBeenCalled();
    expect(explorerExplore).not.toHaveBeenCalled();
  });
});
