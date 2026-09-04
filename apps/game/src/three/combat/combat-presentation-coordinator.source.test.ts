import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("combat presentation wiring", () => {
  it("keeps attack outcomes out of gameplay state while owning one world lifecycle", () => {
    const coordinator = readSource("src/three/combat/combat-presentation-coordinator.ts");
    const worldmap = readSource("src/three/scenes/worldmap.tsx");
    const collaborator = readSource("src/three/scenes/worldmap-combat-presentation.ts");

    expect(coordinator).toContain("Cairo/RECS remains the only gameplay authority");
    expect(coordinator).not.toMatch(/setComponent|updateComponent|systemCalls|attack_explorer/);
    expect(worldmap).toContain("new CombatPresentationCoordinator(this.scene, {");
    expect(worldmap).toContain("hasTarget: (entityId) => this.armyManager.hasProceduralProjectileTarget(entityId)");
    expect(worldmap).toContain("sweepSphere: (request) => this.armyManager.sweepProceduralProjectile(request)");
    expect(worldmap).toContain("this.combatPresentation?.update(deltaTime)");
    expect(worldmap).toContain("this.combatPresentation?.dispose()");
    expect(worldmap).toContain("this.combatPresentationRuntime.replayIndexed(update)");
    expect(collaborator).toContain("this.deps.armyManager.onProceduralRangedRelease");
    expect(collaborator).toContain("this.deps.armyManager.onProceduralMeleeContact");
    expect(coordinator).toContain("presentRangedRelease");
    expect(coordinator).toContain("presentMeleeContact");
  });
});
