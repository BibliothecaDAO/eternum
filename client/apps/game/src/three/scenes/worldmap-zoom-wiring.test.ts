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

    expect(source).toMatch(/WorldmapZoomCoordinator/);
    expect(source).toMatch(/applyWorldmapWheelIntent\(/);
    expect(source).toMatch(/resolveWorldmapWheelThreshold\(/);
    expect(source).toMatch(/resolveWorldmapWheelGestureTimeoutMs\(/);
    expect(source).toMatch(/setWorldmapZoomTargetView\(/);
    expect(source).not.toMatch(/type:\s*"continuous_delta"/);
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

    expect(source).not.toMatch(/resolveWorldmapWheelAnchor\(/);
    expect(source).not.toMatch(/resolveWorldmapGroundIntersection\(/);
  });

  it("removes direct worldmap refresh requests from GameRenderer control changes", () => {
    const source = readSceneSource("../game-renderer.ts");

    expect(source).not.toMatch(/this\.worldmapScene\.requestChunkRefresh\(/);
  });

  it("snaps worldmap entry to the player's persisted camera band, defaulting to medium", () => {
    const source = readSceneSource("worldmap.tsx");

    expect(source).toMatch(/if \(!this\.hasInitialized\) \{\s*this\.alignInitialWorldmapCameraView\(\);\s*\}/);
    expect(source).toMatch(/resolveStoredWorldmapCameraView\(CameraView\.Medium\)/);
    expect(source).toMatch(/this\.zoomCoordinator\.syncToBand\(view/);
    expect(source).toMatch(/onResumeStart: \(\) => this\.alignWorldmapCameraToView\(/);
  });

  it("uses a worldmap-specific camera transition curve for fixed zoom band changes", () => {
    const source = readSceneSource("worldmap.tsx");

    expect(source).toMatch(/resolveCameraViewTransitionDuration\(/);
    expect(source).toMatch(/resolveCameraTransitionEase\(/);
  });

  it("publishes camera zoom state without presenting chunk loading UI", () => {
    const source = readSceneSource("worldmap.tsx");
    const publishZoomSnapshotSource = source.slice(
      source.indexOf("private publishWorldmapZoomSnapshot("),
      source.indexOf("public moveCameraToURLLocation("),
    );

    expect(publishZoomSnapshotSource).toMatch(/worldmapCameraTransitionListeners/);
    expect(publishZoomSnapshotSource).not.toMatch(/LoadingStateKey\.ChunkTransition/);
    expect(publishZoomSnapshotSource).not.toMatch(/setLoading\(/);
  });

  it("keeps the passive chunk status wired to real terrain transitions and their finalizers", () => {
    const source = readSceneSource("worldmap.tsx");
    const visibleChunkUpdateSource = source.slice(
      source.indexOf("async updateVisibleChunks("),
      source.indexOf("private prepareChunkPresentation("),
    );

    expect(visibleChunkUpdateSource).toMatch(
      /chunkDecision\.action === "switch_chunk"[\s\S]*setLoading\(LoadingStateKey\.ChunkTransition, true\)[\s\S]*onFinally:[\s\S]*setLoading\(LoadingStateKey\.ChunkTransition, false\)/,
    );
    expect(visibleChunkUpdateSource).toMatch(
      /chunkDecision\.action === "refresh_current_chunk"[\s\S]*setLoading\(LoadingStateKey\.ChunkTransition, true\)[\s\S]*onFinally:[\s\S]*setLoading\(LoadingStateKey\.ChunkTransition, false\)/,
    );
  });
});
