import { TroopTier, TroopType } from "@bibliothecadao/types";
import { Scene, Vector3 } from "three";
import { describe, expect, it, vi } from "vitest";

import { CombatPresentationCoordinator } from "./combat-presentation-coordinator";

describe("combat presentation coordinator", () => {
  it("predicts a local volley and deduplicates its indexed echo", () => {
    const coordinator = new CombatPresentationCoordinator(new Scene());
    const intent = createIntent();
    const presentation = createPresentation(TroopType.Crossbowman, TroopTier.T1);

    expect(coordinator.startProvisional(presentation, intent)).toBe(true);
    expect(coordinator.getStats().arrows.spawnedCount).toBe(3);
    expect(coordinator.replayIndexed(presentation)).toBe(false);
    expect(coordinator.getStats().arrows.spawnedCount).toBe(3);
    coordinator.dispose();
  });

  it("presents and deduplicates melee attacks without spawning arrows", () => {
    const coordinator = new CombatPresentationCoordinator(new Scene());
    const presentation = createPresentation(TroopType.Knight, TroopTier.T3);

    expect(coordinator.startProvisional(presentation, createIntent())).toBe(true);
    expect(coordinator.getStats().melee.spawnedCount).toBe(1);
    expect(coordinator.getStats().arrows.spawnedCount).toBe(0);
    expect(coordinator.replayIndexed(presentation)).toBe(false);
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

function createIntent() {
  return {
    bindTransaction: vi.fn(),
    confirm: vi.fn(),
    fail: vi.fn(),
    subscribe: vi.fn(() => () => undefined),
  };
}
