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

  it("deduplicates rapid same-pair attacks in FIFO order", () => {
    const coordinator = new CombatPresentationCoordinator(new Scene());
    const presentation = createPresentation(TroopType.Crossbowman, TroopTier.T1);

    expect(coordinator.startProvisional(presentation, createIntent())).toBe(true);
    expect(coordinator.startProvisional(presentation, createIntent())).toBe(true);
    expect(coordinator.getStats().arrows.spawnedCount).toBe(6);

    expect(coordinator.replayIndexed(presentation)).toBe(false);
    expect(coordinator.replayIndexed(presentation)).toBe(false);
    expect(coordinator.getStats().arrows.spawnedCount).toBe(6);

    expect(coordinator.replayIndexed(presentation)).toBe(true);
    expect(coordinator.getStats().arrows.spawnedCount).toBe(9);
    coordinator.dispose();
  });

  it("defers a predicted volley until the procedural release marker", () => {
    const coordinator = new CombatPresentationCoordinator(new Scene());
    const presentation = createPresentation(TroopType.Crossbowman, TroopTier.T2);

    expect(coordinator.startProvisional(presentation, createIntent(), { deferEffects: true })).toBe(true);
    expect(coordinator.getStats().arrows.spawnedCount).toBe(0);

    coordinator.presentRangedRelease({
      origin: new Vector3(0, 1, 0),
      seed: 77,
      target: new Vector3(0, 1, 4),
      tier: TroopTier.T2,
    });
    expect(coordinator.getStats().arrows.spawnedCount).toBe(5);
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
