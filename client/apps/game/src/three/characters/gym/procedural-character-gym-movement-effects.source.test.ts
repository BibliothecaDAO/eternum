// @vitest-environment node
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const renderer = readFileSync(new URL("./procedural-character-gym-renderer.ts", import.meta.url), "utf8");
const view = readFileSync(
  new URL("../../../ui/features/debug/procedural-character-gym-view.tsx", import.meta.url),
  "utf8",
);

describe("procedural character gym movement effects", () => {
  it("runs the production movement-effects module during live and captured locomotion", () => {
    expect(renderer).toContain("new TerrainMovementEffects(() => BiomeType.Bare)");
    expect(renderer).toMatch(
      /this\.unitRuntime\.update\(deltaSeconds\);[\s\S]*this\.syncMovementEffects\(deltaSeconds\);/,
    );
    expect(renderer).toMatch(/this\.unitRuntime\.stepOnce\(\);[\s\S]*this\.syncMovementEffects\(fixedStep\);/);
    expect(renderer).toContain('this.inspectionSequence === "locomotion-cycle"');
    expect(renderer).toContain("this.movementEffects.dispose()");
  });

  it("publishes bounded dust metrics through the gym verification bridge", () => {
    expect(renderer).toContain("dustActiveParticles: dust.activeParticles");
    expect(renderer).toContain("dustCapacity: dust.capacity");
    expect(view).toContain("data-dust-particles={stats.dustActiveParticles}");
    expect(view).toContain('label="Dust"');
  });
});
