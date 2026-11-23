import { type BattleEventSystemUpdate } from "@bibliothecadao/eternum";
import { TroopTier, TroopType } from "@bibliothecadao/types";
import { describe, expect, it, vi } from "vitest";

import type { CombatPresentationCoordinator } from "@/three/combat/combat-presentation-coordinator";

import { WorldmapCombatPresentation, type WorldmapCombatPresentationDeps } from "./worldmap-combat-presentation";

function createHarness(over: Partial<WorldmapCombatPresentationDeps> = {}) {
  const armyManager = {
    getArmy: vi.fn(() => ({ tier: TroopTier.T2, category: TroopType.Knight })),
  } as unknown as WorldmapCombatPresentationDeps["armyManager"];

  const combatPresentation = {
    replayIndexed: vi.fn(() => true),
  } as unknown as CombatPresentationCoordinator;

  const deps: WorldmapCombatPresentationDeps = {
    armyManager,
    getCombatPresentation: () => combatPresentation,
    getArmyDisplayPosition: vi.fn((id: number) => ({ col: id, row: id })),
    getStructureHexPosition: vi.fn(() => undefined),
    ...over,
  };

  return { runtime: new WorldmapCombatPresentation(deps), deps, armyManager, combatPresentation };
}

const battle = (attackerId: number, defenderId: number) =>
  ({ battleData: { attackerId, defenderId } }) as unknown as BattleEventSystemUpdate;

describe("WorldmapCombatPresentation", () => {
  it("replays a confirmed battle in one coordinator call without animating actors", () => {
    const h = createHarness();

    h.runtime.replayIndexed(battle(1, 2));

    expect(h.combatPresentation.replayIndexed).toHaveBeenCalledTimes(1);
    expect(h.combatPresentation.replayIndexed).toHaveBeenCalledWith(
      expect.objectContaining({ attackerId: 1, defenderId: 2, tier: TroopTier.T2, troopType: TroopType.Knight }),
    );
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

  it("falls back to the defender structure hex when the defender is not an army", () => {
    const h = createHarness({
      getArmyDisplayPosition: vi.fn((id: number) => (id === 1 ? { col: 1, row: 1 } : undefined)),
      getStructureHexPosition: vi.fn((id: number) => (id === 2 ? { col: 3, row: 4 } : undefined)),
    });

    h.runtime.replayIndexed(battle(1, 2));

    expect(h.combatPresentation.replayIndexed).toHaveBeenCalledTimes(1);
  });
});
