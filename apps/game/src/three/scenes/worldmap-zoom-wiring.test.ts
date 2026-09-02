import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(currentDir, "worldmap.tsx"), "utf8");
const rendererSource = readFileSync(join(currentDir, "..", "game-renderer.ts"), "utf8");

describe("worldmap zoom wiring", () => {
  it("routes wheel input into continuous zoom intents on the coordinator, with no preset bands", () => {
    expect(source).toMatch(/WorldmapZoomCoordinator/);
    expect(source).toMatch(/type:\s*"continuous_delta",\s*delta:\s*normalizedWheelDelta\.normalizedDelta/);
    expect(source).not.toMatch(/snap_to_band|changeCameraView|resolveWorldmapCameraViewProfile/);
  });

  it("moves the camera from the coordinator's eased distance every frame it changes", () => {
    expect(source).toMatch(
      /if \(zoomFrame\.didMove\) \{\s*this\.placeWorldmapCameraAtDistance\(zoomFrame\.snapshot\.actualDistance\);/,
    );
    expect(source).toMatch(/resolveWorldmapCameraPitchRadians\(distance\)/);
  });

  it("keeps MapControls zoom disabled for worldmap and bounds the distance by the zoom profile", () => {
    expect(source).toMatch(/this\.controls\.enableZoom = false/);
    expect(source).toMatch(/this\.controls\.maxDistance = WORLDMAP_CAMERA_ZOOM\.maxDistance/);
    expect(source).toMatch(/maxDistance: WORLDMAP_CAMERA_ZOOM\.maxDistance/);
  });

  it("applies a narrower worldmap-only field of view than the shared renderer default", () => {
    expect(source).toMatch(/this\.camera\.fov = resolveWorldmapCameraFieldOfViewDegrees\(\)/);
    expect(source).toMatch(/this\.camera\.fov = CAMERA_CONFIG\.fov/);
  });

  it("keeps worldmap hex interaction in outline mode without the filled surface overlay", () => {
    expect(source).toMatch(/interactiveHexManager\.setSurfaceVisibility\(false\)/);
    expect(source).toMatch(/interactiveHexManager\.setHoverVisualMode\("outline"\)/);
  });

  it("removes direct worldmap refresh requests from GameRenderer control changes", () => {
    expect(rendererSource).not.toMatch(/this\.worldmapScene\.requestChunkRefresh\(/);
  });

  it("snaps worldmap entry and resume to the player's persisted zoom distance", () => {
    expect(source).toMatch(/if \(!this\.hasInitialized\) \{\s*this\.alignInitialWorldmapCameraView\(\);\s*\}/);
    expect(source).toMatch(/resolveStoredWorldmapCameraDistance\(range\) \?\? WORLDMAP_CAMERA_ZOOM\.defaultDistance/);
    expect(source).toMatch(/this\.zoomCoordinator\.syncToDistance\(distance/);
    expect(source).toMatch(/onResumeStart: \(\) => this\.alignWorldmapCameraToDistance\(/);
  });

  it("persists the settled zoom distance once per completed transition", () => {
    expect(source).toMatch(/setWorldmapDistance\(settled\)/);
  });
});
