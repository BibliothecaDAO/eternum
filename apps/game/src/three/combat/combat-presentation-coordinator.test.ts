import { TroopTier, TroopType } from "@bibliothecadao/types";
import { Scene, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { CombatPresentationCoordinator } from "./combat-presentation-coordinator";

describe("combat presentation coordinator", () => {
  it("presents an indexed volley once per battle event", () => {
    const coordinator = new CombatPresentationCoordinator(new Scene());
    const presentation = createPresentation(TroopType.Crossbowman, TroopTier.T1);

    expect(coordinator.replayIndexed(presentation)).toBe(true);
    expect(coordinator.getStats().arrows.spawnedCount).toBe(3);
    expect(coordinator.replayIndexed(presentation)).toBe(true);
    expect(coordinator.getStats().arrows.spawnedCount).toBe(6);
    coordinator.dispose();
  });

  it("presents melee attacks without spawning arrows", () => {
    const coordinator = new CombatPresentationCoordinator(new Scene());
    const presentation = createPresentation(TroopType.Knight, TroopTier.T3);

    expect(coordinator.replayIndexed(presentation)).toBe(true);
    expect(coordinator.getStats().melee.spawnedCount).toBe(1);
    expect(coordinator.getStats().arrows.spawnedCount).toBe(0);
    coordinator.dispose();
  });
});

function createPresentation(troopType: TroopType, tier: TroopTier) {
  return {
    attackerId: 1,
    defenderId: 2,
    origin: new Vector3(0, 0, 0),
    target: new Vector3(0, 0, 4),
    tier,
    troopType,
  };
}
