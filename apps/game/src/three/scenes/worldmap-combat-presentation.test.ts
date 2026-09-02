import { type BattleEventSystemUpdate } from "@bibliothecadao/eternum";
import { describe, expect, it, vi } from "vitest";

import type { ProceduralMeleeContactEvent, ProceduralRangedReleaseEvent } from "@/three/characters";
import type { CombatPresentationCoordinator } from "@/three/combat/combat-presentation-coordinator";
import type { ArmyManager } from "@/three/managers/army-manager";

import { WorldmapCombatPresentation, type WorldmapCombatPresentationDeps } from "./worldmap-combat-presentation";

type RangedCb = (
  entityId: number,
  event: ProceduralRangedReleaseEvent,
  targetEntityId?: number,
  authority?: string,
) => void;
type MeleeCb = (entityId: number, event: ProceduralMeleeContactEvent, targetEntityId?: number) => void;

function createHarness(over: Partial<WorldmapCombatPresentationDeps> = {}) {
  const unsub = { ranged: vi.fn(), melee: vi.fn(), impact: vi.fn() };
  const captured: { ranged?: RangedCb; melee?: MeleeCb } = {};

  const armyManager = {
    onProceduralRangedRelease: vi.fn((cb: RangedCb) => {
      captured.ranged = cb;
      return unsub.ranged;
    }),
    onProceduralMeleeContact: vi.fn((cb: MeleeCb) => {
      captured.melee = cb;
      return unsub.melee;
    }),
    presentProceduralProjectileImpact: vi.fn(),
    getArmy: vi.fn(() => ({ tier: 2, category: 0 })),
    playProceduralAttack: vi.fn(() => true),
  } as unknown as ArmyManager;

  const combatPresentation = {
    onProjectileImpact: vi.fn(() => unsub.impact),
    replayIndexed: vi.fn(() => true),
    presentImmediate: vi.fn(),
    presentRangedRelease: vi.fn(),
    presentMeleeContact: vi.fn(),
  } as unknown as CombatPresentationCoordinator;

  const deps: WorldmapCombatPresentationDeps = {
    armyManager,
    getCombatPresentation: () => combatPresentation,
    getArmyDisplayPosition: vi.fn((id: number) => ({ col: id, row: id })),
    getStructureHexPosition: vi.fn(() => undefined),
    ...over,
  };

  return { runtime: new WorldmapCombatPresentation(deps), deps, armyManager, combatPresentation, unsub, captured };
}

const battle = (attackerId: number, defenderId: number) =>
  ({ battleData: { attackerId, defenderId } }) as unknown as BattleEventSystemUpdate;

describe("WorldmapCombatPresentation", () => {
  it("tears down every subscription it opened on dispose", () => {
    const h = createHarness();
    h.runtime.bind();

    expect(h.armyManager.onProceduralRangedRelease).toHaveBeenCalledTimes(1);
    expect(h.armyManager.onProceduralMeleeContact).toHaveBeenCalledTimes(1);
    expect(h.combatPresentation.onProjectileImpact).toHaveBeenCalledTimes(1);

    h.runtime.dispose();

    expect(h.unsub.ranged).toHaveBeenCalledTimes(1);
    expect(h.unsub.melee).toHaveBeenCalledTimes(1);
    expect(h.unsub.impact).toHaveBeenCalledTimes(1);
  });

  it("replays a confirmed battle and does not fall back when the animated attack starts", () => {
    const h = createHarness();

    h.runtime.replayIndexed(battle(1, 2));

    expect(h.combatPresentation.replayIndexed).toHaveBeenCalledTimes(1);
    expect(h.armyManager.playProceduralAttack).toHaveBeenCalledTimes(1);
    expect(h.combatPresentation.presentImmediate).not.toHaveBeenCalled();
  });

  it("falls back to an immediate present when the animated attack cannot start", () => {
    const h = createHarness();
    (h.armyManager.playProceduralAttack as ReturnType<typeof vi.fn>).mockReturnValue(false);

    h.runtime.replayIndexed(battle(1, 2));

    expect(h.combatPresentation.presentImmediate).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the coordinator declines the replay", () => {
    const h = createHarness();
    (h.combatPresentation.replayIndexed as ReturnType<typeof vi.fn>).mockReturnValue(false);

    h.runtime.replayIndexed(battle(1, 2));

    expect(h.armyManager.playProceduralAttack).not.toHaveBeenCalled();
    expect(h.combatPresentation.presentImmediate).not.toHaveBeenCalled();
  });

  it("skips replay when the attacker is unknown", () => {
    const h = createHarness();
    (h.armyManager.getArmy as ReturnType<typeof vi.fn>).mockReturnValue(undefined);

    h.runtime.replayIndexed(battle(1, 2));

    expect(h.combatPresentation.replayIndexed).not.toHaveBeenCalled();
  });

  it("skips replay when neither the defender army nor structure has a hex", () => {
    const h = createHarness({
      getArmyDisplayPosition: vi.fn((id: number) => (id === 1 ? { col: 1, row: 1 } : undefined)),
      getStructureHexPosition: vi.fn(() => undefined),
    });

    h.runtime.replayIndexed(battle(1, 2));

    expect(h.combatPresentation.replayIndexed).not.toHaveBeenCalled();
  });

  it("routes a procedural ranged release to the coordinator", () => {
    const h = createHarness();
    h.runtime.bind();

    const event = {
      origin: { x: 0, y: 0, z: 0 },
      origins: [],
      shotGeneration: 3,
      projectile: {},
      seed: 7,
      target: { x: 1, y: 0, z: 1 },
    } as unknown as ProceduralRangedReleaseEvent;
    h.captured.ranged?.(1, event, 2, "provisional");

    expect(h.combatPresentation.presentRangedRelease).toHaveBeenCalledTimes(1);
  });

  it("routes a procedural melee contact to the coordinator", () => {
    const h = createHarness();
    h.runtime.bind();

    const event = { direction: 1, target: { x: 1, y: 0, z: 1 } } as unknown as ProceduralMeleeContactEvent;
    h.captured.melee?.(1, event, 2);

    expect(h.combatPresentation.presentMeleeContact).toHaveBeenCalledTimes(1);
  });
});
