import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSceneSource(fileName: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, fileName), "utf8");
}

describe("worldmap zoom wiring", () => {
  it("keeps map controls zoom disabled for worldmap", () => {
    const source = readSceneSource("worldmap.tsx");

    expect(source).toMatch(/this\.controls\.enableZoom = false/);
    expect(source).not.toMatch(/this\.controls\.enableZoom = useUIStore\.getState\(\)\.enableMapZoom/);
  });

  it("locks worldmap min and max zoom distance to the far presentation band", () => {
    const source = readSceneSource("worldmap.tsx");

    expect(source).toMatch(
      /worldmapZoomDistance = resolveWorldmapCameraViewProfile\(LOCKED_WORLDMAP_CAMERA_VIEW\)\.distance/,
    );
    expect(source).toMatch(/worldmapMinZoomDistance = this\.worldmapZoomDistance/);
    expect(source).toMatch(/worldmapMaxZoomDistance = this\.worldmapZoomDistance/);
    expect(source).toMatch(/this\.controls\.minDistance = this\.worldmapMinZoomDistance/);
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

  it("does not attach wheel, cursor-anchor, or minimap zoom paths for worldmap", () => {
    const source = readSceneSource("worldmap.tsx");
    const minimapSource = readSceneSource("../../ui/features/world/components/bottom-right-panel/hex-minimap.tsx");

    expect(source).not.toMatch(/addEventListener\("wheel"/);
    expect(source).not.toMatch(/minimapZoom/);
    expect(minimapSource).not.toMatch(/minimapZoom/);
    expect(minimapSource).not.toMatch(/onWheel=\{handleWheel\}/);
    expect(source).not.toMatch(/applyWorldmapWheelIntent\(/);
    expect(source).not.toMatch(/normalizeWorldmapWheelDelta\(/);
    expect(source).not.toMatch(/resolveWorldmapWheelAnchor\(/);
    expect(source).not.toMatch(/resolveWorldmapGroundIntersection\(/);
    expect(source).not.toMatch(/applyDirectionalZoomIntent\(/);
  });

  it("does not register worldmap camera-view zoom shortcuts", () => {
    const source = readSceneSource("worldmap.tsx");

    expect(source).not.toMatch(/camera-view-close/);
    expect(source).not.toMatch(/camera-view-medium/);
    expect(source).not.toMatch(/camera-view-far/);
    expect(source).not.toMatch(/Zoom to close view/);
    expect(source).not.toMatch(/Zoom to medium view/);
    expect(source).not.toMatch(/Zoom to far view/);
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

  it("snaps the first worldmap entry to the locked far camera band", () => {
    const source = readSceneSource("worldmap.tsx");

    expect(source).toMatch(/if \(!this\.hasInitialized\) \{\s*this\.alignInitialWorldmapCameraView\(\);\s*\}/);
    expect(source).toMatch(/this\.alignWorldmapCameraToBand\(LOCKED_WORLDMAP_CAMERA_VIEW\)/);
    expect(source).toMatch(/this\.syncLockedWorldmapCameraView\(\)/);
  });

  it("locks every worldmap camera view request to the far band without a transition", () => {
    const source = readSceneSource("worldmap.tsx");
    const changeCameraViewSource = source.slice(
      source.indexOf("public override changeCameraView"),
      source.indexOf("public override getCurrentCameraView"),
    );

    expect(source).toMatch(/resolveLockedWorldmapCameraView\(/);
    expect(changeCameraViewSource).toMatch(/const lockedView = resolveLockedWorldmapCameraView\(position\)/);
    expect(changeCameraViewSource).toMatch(/this\.alignWorldmapCameraToBand\(lockedView\)/);
    expect(changeCameraViewSource).not.toMatch(/incrementWorldmapRenderCounter\("zoomTransitionsStarted"\)/);
    expect(source).not.toMatch(/this\.cameraAnimate\(\s*newPosition,\s*target,\s*duration/);
  });

  it("removes worldmap zoom transition helpers from the scene", () => {
    const source = readSceneSource("worldmap.tsx");

    expect(source).not.toMatch(/WORLDMAP_ZOOM_SPRING_CONFIG/);
    expect(source).not.toMatch(/advanceWorldmapCameraSpring\(/);
    expect(source).not.toMatch(/retargetWorldmapZoomSpring\(/);
    expect(source).not.toMatch(/updateWorldmapZoomSpring\(/);
    expect(source).not.toMatch(/snapWorldmapZoomBandChange\(/);
    expect(source).not.toMatch(/shouldSnapWorldmapZoomBandChange\(/);
    expect(source).not.toMatch(/isTransientRenderPerformanceModeActive\(\)/);
  });

  it("keeps minimap camera state polling active because there is no zoom animation", () => {
    const source = readSceneSource("worldmap.tsx");
    const updateSource = source.slice(
      source.indexOf("update(deltaTime: number)"),
      source.indexOf("private syncLockedWorldmapCameraView"),
    );

    expect(updateSource).toMatch(/this\.updateCameraTargetHexThrottled\?\.\(\)/);
    expect(updateSource).not.toMatch(/isWorldmapZoomSpringActive/);
    expect(source).toMatch(/this\.publishWorldmapCameraDistance\(profile\.distance\)/);
  });
});
