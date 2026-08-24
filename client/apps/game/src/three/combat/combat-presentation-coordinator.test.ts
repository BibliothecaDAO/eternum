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
      ownerEntityId: 1,
      origin: new Vector3(0, 1, 0),
      projectile: { count: 5, flightSeconds: 0.7, kind: "arrow", spreadDegrees: 0.8, targetRadius: 0.48 },
      seed: 77,
      target: new Vector3(0, 1, 4),
      targetEntityId: 2,
      tier: TroopTier.T2,
    });
    expect(coordinator.getStats().arrows.spawnedCount).toBe(5);
    coordinator.dispose();
  });

  it("routes target-aware swept projectile impacts through one presentation listener", () => {
    const coordinator = new CombatPresentationCoordinator(new Scene(), {
      projectileHitQuery: {
        sweepSphere: ({ from, intendedTargetEntityId, to }) => ({
          fraction: 0.5,
          material: "metal",
          normal: new Vector3(0, 0, -1),
          point: new Vector3().copy(from).lerp(to, 0.5),
          targetEntityId: intendedTargetEntityId,
        }),
      },
    });
    const listener = vi.fn();
    coordinator.onProjectileImpact(listener);
    coordinator.presentRangedRelease({
      authority: "indexed-replay",
      ownerEntityId: 1,
      origin: new Vector3(0, 1, 0),
      presentationId: "battle:1",
      projectile: { count: 3, flightSeconds: 0.7, kind: "arrow", spreadDegrees: 0.8, targetRadius: 0.48 },
      seed: 77,
      target: new Vector3(0, 1, 4),
      targetEntityId: 2,
      tier: TroopTier.T1,
    });

    coordinator.update(1 / 30);

    expect(listener).toHaveBeenCalled();
    expect(listener.mock.calls[0][0]).toMatchObject({
      authority: "indexed-replay",
      ownerEntityId: 1,
      targetEntityId: 2,
      targetHit: true,
    });
    coordinator.dispose();
  });

  it("spawns one pooled cannonball from each deterministic broadside muzzle", () => {
    const coordinator = new CombatPresentationCoordinator(new Scene());
    const origins = [new Vector3(0.5, 0.4, -0.4), new Vector3(0.5, 0.4, 0.4)];

    coordinator.presentRangedRelease({
      origin: origins[0],
      origins,
      ownerEntityId: 3,
      projectile: { count: 2, flightSeconds: 0.82, kind: "cannonball", spreadDegrees: 1.5, targetRadius: 0.8 },
      seed: 91,
      target: new Vector3(5, 0.5, 0),
      targetEntityId: 4,
      tier: TroopTier.T2,
    });

    expect(coordinator.getStats().arrows.spawnedCount).toBe(2);
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
