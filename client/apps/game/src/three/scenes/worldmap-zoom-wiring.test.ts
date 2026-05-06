import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSceneSource(fileName: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, fileName), "utf8");
}

describe("worldmap zoom wiring", () => {
  it("routes worldmap wheel zoom through the stepped zoom controller instead of continuous delta intents", () => {
    const source = readSceneSource("worldmap.tsx");
    const coordinatorSource = readSceneSource("worldmap-zoom/worldmap-zoom-coordinator.ts");

    expect(source).toMatch(/WorldmapZoomCoordinator/);
    expect(source).toMatch(/applyWorldmapWheelIntent\(/);
    expect(source).toMatch(/resolveWorldmapWheelThreshold\(/);
    expect(source).toMatch(/resolveWorldmapWheelGestureTimeoutMs\(/);
    expect(source).toMatch(/setWorldmapZoomTargetView\(/);
    expect(source).not.toMatch(/type:\s*"continuous_delta"/);
    expect(coordinatorSource).not.toMatch(/continuous_delta|snap_to_distance|applyContinuousWorldmapZoomDelta/);
  });

  it("keeps MapControls zoom disabled for worldmap", () => {
    const source = readSceneSource("worldmap.tsx");

    expect(source).toMatch(/this\.controls\.enableZoom = false/);
    expect(source).not.toMatch(/this\.controls\.enableZoom = useUIStore\.getState\(\)\.enableMapZoom/);
  });

  it("caps worldmap max zoom distance at the far presentation band", () => {
    const source = readSceneSource("worldmap.tsx");

    expect(source).toMatch(/worldmapMaxZoomDistance = 40/);
    expect(source).toMatch(/maxDistance: this\.worldmapMaxZoomDistance/);
    expect(source).toMatch(/this\.controls\.maxDistance = this\.worldmapMaxZoomDistance/);
  });

  it("applies a narrower worldmap-only field of view than the shared renderer default", () => {
    const source = readSceneSource("worldmap.tsx");

    expect(source).toMatch(/this\.camera\.fov = resolveWorldmapCameraFieldOfViewDegrees\(\)/);
    expect(source).toMatch(/this\.camera\.fov = CAMERA_CONFIG\.fov/);
  });

  it("keeps worldmap hex interaction in outline mode without the filled surface overlay", () => {
    const source = readSceneSource("worldmap.tsx");

    expect(source).toMatch(/interactiveHexManager\.setSurfaceVisibility\(false\)/);
    expect(source).toMatch(/interactiveHexManager\.setHoverVisualMode\("outline"\)/);
  });

  it("does not use cursor-anchor wheel resolution for fixed worldmap zoom stepping", () => {
    const source = readSceneSource("worldmap.tsx");
    const coordinatorSource = readSceneSource("worldmap-zoom/worldmap-zoom-coordinator.ts");

    expect(source).not.toMatch(/resolveWorldmapWheelAnchor\(/);
    expect(source).not.toMatch(/resolveWorldmapGroundIntersection\(/);
    expect(coordinatorSource).not.toMatch(/anchorWorldPoint|solveWorldmapZoomAnchor/);
  });

  it("does not force chunk refreshes from zoom-distance changes", () => {
    const source = readSceneSource("worldmap.tsx");

    expect(source).toMatch(/resolveControlsChangeChunkRefreshPlan\(/);
    expect(source).not.toMatch(/shouldForceChunkRefreshForZoomDistanceChange/);
    expect(source).not.toMatch(/planWorldmapZoomRefresh/);
  });

  it("removes direct worldmap refresh requests from GameRenderer control changes", () => {
    const source = readSceneSource("../game-renderer.ts");

    expect(source).not.toMatch(/this\.worldmapScene\.requestChunkRefresh\(/);
  });

  it("snaps the first worldmap entry to the intended medium camera band", () => {
    const source = readSceneSource("worldmap.tsx");

    expect(source).toMatch(/if \(!this\.hasInitialized\) \{\s*this\.alignInitialWorldmapCameraView\(\);\s*\}/);
    expect(source).toMatch(/this\.zoomCoordinator\.syncToBand\(CameraView\.Medium/);
  });

  it("uses worldmap-specific spring config for fixed zoom band changes", () => {
    const source = readSceneSource("worldmap.tsx");

    expect(source).toMatch(/WORLDMAP_ZOOM_SPRING_CONFIG/);
    expect(source).toMatch(/advanceWorldmapCameraSpring\(/);
  });

  it("retargets fixed-band zoom through a spring instead of restarting camera tweens", () => {
    const source = readSceneSource("worldmap.tsx");

    expect(source).toMatch(/retargetWorldmapZoomSpring\(/);
    expect(source).toMatch(/updateWorldmapZoomSpring\(/);
    expect(source).not.toMatch(/this\.cameraAnimate\(\s*newPosition,\s*target,\s*duration/);
  });
});
