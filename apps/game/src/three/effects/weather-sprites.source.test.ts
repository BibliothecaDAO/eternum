import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
it("removes the procedural bolts, particle rain and fixed weather cycle", () => {
  const bolt = readFileSync("src/three/managers/thunderbolt-manager.ts", "utf8");
  const rain = readFileSync("src/three/effects/rain-effect.ts", "utf8");
  const weather = readFileSync("src/three/managers/weather-manager.ts", "utf8");
  const lightning = readFileSync("src/three/scenes/lightning-effect-system.ts", "utf8");
  expect(bolt).not.toMatch(
    /LightningSegment|generateLightningPath|generateBranchPaths|CircleGeometry|persistent|SpriteMaterial|new Sprite/,
  );
  expect(rain).not.toMatch(/LineSegments|rainParticles|rainPositions|DropSize|BufferGeometry/);
  expect(rain).not.toMatch(/fitToCamera|OrthographicCamera|SpriteNodeMaterial|onBeforeRender/);
  const hud = readFileSync("src/three/scenes/hud-scene.ts", "utf8");
  const scene = readFileSync("src/three/scenes/hexagon-scene.ts", "utf8");
  expect(hud).not.toContain("RainEffect");
  expect(scene).toContain("new RainEffect(this.scene");
  expect(scene).toContain("this.rainEffect.update(deltaTime, this.controls.target, this.weatherAtmosphereState)");
  expect(weather).not.toMatch(/autoChangeInterval|peakTimer|peakMinDuration/);
  expect(lightning).not.toContain("cycleProgress");
  const lab = readFileSync("src/ui/features/debug/procedural-terrain-debug-view.tsx", "utf8");
  expect(lab).toContain("WeatherLabControls");
  expect(lab).toContain("AtmosphereLabControls");
});
