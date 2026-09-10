// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("holds the world map's chunk work while the flight owns the camera", () => {
  const worldmap = readFileSync("src/three/scenes/worldmap.tsx", "utf8");
  expect(worldmap).toContain("public override setCameraOwnedByFlight(owned: boolean): void {");
  expect(worldmap).toContain("this.chunkWorkQueue.setHeld(owned);");
});
