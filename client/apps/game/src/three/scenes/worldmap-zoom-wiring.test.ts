import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSceneSource(fileName: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, fileName), "utf8");
}

describe("worldmap zoom wiring", () => {
  it("routes worldmap zoom through the dedicated coordinator instead of stepped view intents", () => {
    const source = readSceneSource("worldmap.tsx");

    expect(source).toMatch(/WorldmapZoomCoordinator/);
    expect(source).toMatch(/this\.zoomCoordinator\.applyIntent\(/);
    expect(source).not.toMatch(/applyWorldmapWheelIntent\(/);
    expect(source).not.toMatch(/setWorldmapZoomTargetView\(/);
  });

  it("keeps MapControls zoom disabled for worldmap", () => {
    const source = readSceneSource("worldmap.tsx");

    expect(source).toMatch(/this\.controls\.enableZoom = false/);
    expect(source).not.toMatch(/this\.controls\.enableZoom = useUIStore\.getState\(\)\.enableMapZoom/);
  });

  it("extends the worldmap-only max zoom distance beyond the far presentation band", () => {
    const source = readSceneSource("worldmap.tsx");

    expect(source).toMatch(/worldmapMaxZoomDistance = 60/);
    expect(source).toMatch(/maxDistance: this\.worldmapMaxZoomDistance/);
    expect(source).toMatch(/this\.controls\.maxDistance = this\.worldmapMaxZoomDistance/);
  });

  it("removes direct worldmap refresh requests from GameRenderer control changes", () => {
    const source = readSceneSource("../game-renderer.ts");

    expect(source).not.toMatch(/this\.worldmapScene\.requestChunkRefresh\(/);
  });
});
