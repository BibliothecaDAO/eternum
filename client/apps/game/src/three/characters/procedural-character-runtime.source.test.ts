// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("procedural character runtime ownership", () => {
  it("keeps the gym on the same public actor interface available to game scenes", () => {
    const gymRenderer = readSource("src/three/characters/gym/procedural-character-gym-renderer.ts");
    const publicInterface = readSource("src/three/characters/index.ts");
    const runtime = readSource("src/three/characters/procedural-character-runtime.ts");

    expect(gymRenderer).toContain('from "@/three/characters"');
    expect(gymRenderer).toContain("initializeProceduralCharacterRendererRuntime");
    expect(gymRenderer).toContain("preloadPhysics: true");
    expect(gymRenderer).toContain("unitRuntime.createActor(this.config)");
    expect(publicInterface).toContain("ProceduralUnitRuntime");
    expect(publicInterface).toContain("ProceduralUnitConfig");
    expect(runtime).toContain('await import("./jolt-character-ragdoll")');
    expect(runtime).not.toContain("import { JoltCharacterRagdoll");

    for (const gymOwnedImplementation of [
      "ProceduralCharacterAvatar",
      "resolveCharacterRig",
      "resolveProceduralCharacterPose",
      "loadQuaterniusCharacterAssets",
      "JoltCharacterRagdoll",
    ]) {
      expect(gymRenderer).not.toContain(gymOwnedImplementation);
    }
  });

  it("wires the public runtime into every visible land army with a lazy legacy fallback", () => {
    const armyLayer = readSource("src/three/characters/procedural-army-character-layer.ts");
    const armyManager = readSource("src/three/managers/army-manager.ts");

    expect(armyLayer).toContain('import("@/three/characters")');
    expect(armyLayer).toContain("runtime.createActor");
    expect(armyLayer).toContain("category: TroopType");
    expect(armyManager).toContain("new ProceduralArmyCharacterLayer(scene)");
    expect(armyManager).toContain("this.updateProceduralArmyCharacters(deltaTime, animationContext)");
    expect(armyManager).toContain("this.collectProceduralArmyPresentation(army, animationContext)");
    expect(armyManager).toContain("reconcileProceduralArmyRepresentations");
    expect(armyManager).toContain("shouldPresentArmyProcedurally");
    expect(armyManager).toContain("isAnimationPositionVisible(instance.position, animationContext)");
    expect(armyManager).toContain("setEntityRepresentationVisible");
    expect(armyManager).toContain("this.proceduralArmyCharacterLayer.raycastNearest(raycaster)");
    expect(armyManager).toContain("proceduralHit.distance <= legacyHit.distance");
    expect(armyManager).toContain("this.proceduralArmyCharacterLayer.playDefeat(numericEntityId)");
    expect(armyManager).not.toContain("updateProceduralCharacterPreview");
  });

  it("keeps the 100-actor benchmark on the same public actor contract", () => {
    const benchmark = readSource("src/three/characters/benchmark/procedural-character-benchmark-renderer.ts");

    expect(benchmark).toContain('from "@/three/characters"');
    expect(benchmark).toContain("initializeProceduralCharacterRendererRuntime");
    expect(benchmark).toContain("preloadPhysics: true");
    expect(benchmark).toContain("this.unitRuntime.createActor");
    for (const benchmarkOwnedImplementation of [
      "ProceduralCharacterAvatar",
      "resolveCharacterRig",
      "resolveProceduralCharacterPose",
      "loadQuaterniusCharacterAssets",
      "JoltCharacterRagdoll",
    ]) {
      expect(benchmark).not.toContain(benchmarkOwnedImplementation);
    }
  });

  it("keeps appearance selection and skeleton conventions behind runtime adapters", () => {
    const avatar = readSource("src/three/characters/procedural-character-avatar.ts");
    const runtime = readSource("src/three/characters/procedural-character-runtime.ts");

    expect(avatar).toContain("HumanoidRigAdapter");
    expect(avatar).not.toContain("QUATERNIUS_BONE_NAMES");
    expect(avatar).not.toContain('from "./quaternius-character-assets"');
    expect(runtime).toContain("ProceduralCharacterLibrary");
    expect(runtime).toContain("normalized.appearanceId !== this.config.appearanceId");
  });

  it("owns one shared Jolt world above humanoid, horse, and mounted ragdoll instances", () => {
    const unitRuntime = readSource("src/three/characters/procedural-unit-runtime.ts");
    const world = readSource("src/three/characters/jolt-ragdoll-world.ts");
    const horseRagdoll = readSource("src/three/characters/horse/jolt-horse-ragdoll.ts");

    expect(unitRuntime).toContain("private readonly physicsWorld: JoltRagdollWorld");
    expect(unitRuntime).toContain("this.physicsWorld.update(deltaSeconds)");
    expect(unitRuntime).toContain("ProceduralHorseRuntime.create(physicsWorld)");
    expect(world).toContain("private readonly instances = new Set<JoltRagdollLifecycle>()");
    expect(horseRagdoll).toContain("world.createRagdoll");
  });
});
