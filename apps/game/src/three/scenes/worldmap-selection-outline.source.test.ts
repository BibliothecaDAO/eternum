// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("keeps the selected hex outlined, independent of hover, across a local flight", () => {
  const manager = readFileSync("src/three/managers/selected-hex-manager.ts", "utf8");
  expect(manager).toContain('this.outline.setVisualMode("outline")');
  expect(manager).not.toContain("Particles");

  const worldmap = readFileSync("src/three/scenes/worldmap.tsx", "utf8");
  expect(worldmap).toContain("if (nextSceneName !== SceneName.Hexception) this.state.setSelectedHex(null);");
  expect(worldmap).toContain("if (setupContext.isCurrent()) this.redrawHeldSelection();");
  expect(worldmap).toContain('if (parsePlayRoute(window.location)?.scene === "hex") return;');
  expect(worldmap).toMatch(/if \(!hexCoords\) \{\n\s+this\.clearSelection\(\);/);
});
