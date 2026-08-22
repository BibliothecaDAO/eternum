import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("combat presentation wiring", () => {
  it("keeps attack outcomes out of gameplay state while owning one world lifecycle", () => {
    const coordinator = readSource("src/three/combat/combat-presentation-coordinator.ts");
    const worldmap = readSource("src/three/scenes/worldmap.tsx");

    expect(coordinator).toContain("Cairo/RECS remains the only gameplay authority");
    expect(coordinator).not.toMatch(/setComponent|updateComponent|systemCalls|attack_explorer/);
    expect(worldmap).toContain("new CombatPresentationCoordinator(this.scene)");
    expect(worldmap).toContain("this.combatPresentation?.update(deltaTime)");
    expect(worldmap).toContain("this.combatPresentation?.dispose()");
    expect(worldmap).toContain("this.replayIndexedCombat(update)");
    expect(worldmap).toContain("deferEffects: proceduralAttackStarted");
    expect(worldmap).toContain("this.armyManager.onProceduralRangedRelease");
    expect(worldmap).toContain("this.armyManager.onProceduralMeleeContact");
    expect(coordinator).toContain("presentRangedRelease");
    expect(coordinator).toContain("presentMeleeContact");
  });

  it("passes combatant identity through both live attack entry points", () => {
    const quickAttack = readSource("src/ui/features/military/battle/quick-attack-preview.tsx");
    const battleLab = readSource("src/ui/features/military/battle/battle-lab/battle-lab.tsx");

    for (const source of [quickAttack, battleLab]) {
      expect(source).toContain("attackerId:");
      expect(source).toContain("targetId:");
      expect(source).toContain("troopTier:");
      expect(source).toContain("troopType:");
    }
  });
});
