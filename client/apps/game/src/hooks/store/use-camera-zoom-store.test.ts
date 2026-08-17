import { beforeEach, describe, expect, it } from "vitest";

import { CameraView } from "@/three/scenes/camera-view";
import {
  CAMERA_ZOOM_STORAGE_KEY,
  clampCameraDistance,
  resolveStoredLocalCameraDistance,
  resolveStoredWorldmapCameraView,
  sanitizeWorldmapCameraView,
  useCameraZoomStore,
} from "./use-camera-zoom-store";

describe("useCameraZoomStore", () => {
  beforeEach(async () => {
    window.localStorage.clear();
    useCameraZoomStore.setState({ worldmapView: null, localDistance: null });
    await useCameraZoomStore.persist.clearStorage();
  });

  it("persists per-scene zoom preferences to localStorage under the camera zoom key", () => {
    useCameraZoomStore.getState().setWorldmapView(CameraView.Far);
    useCameraZoomStore.getState().setLocalDistance(12.5);

    const persisted = window.localStorage.getItem(CAMERA_ZOOM_STORAGE_KEY);
    expect(JSON.parse(persisted ?? "{}")).toMatchObject({
      state: {
        worldmapView: CameraView.Far,
        localDistance: 12.5,
      },
    });
  });

  it("resets both scene preferences back to scene defaults", () => {
    useCameraZoomStore.getState().setWorldmapView(CameraView.Close);
    useCameraZoomStore.getState().setLocalDistance(8);

    useCameraZoomStore.getState().resetToDefaults();

    expect(useCameraZoomStore.getState().worldmapView).toBeNull();
    expect(useCameraZoomStore.getState().localDistance).toBeNull();
  });

  it("falls back to the scene default when no worldmap view is stored or the value is invalid", () => {
    expect(resolveStoredWorldmapCameraView(CameraView.Medium)).toBe(CameraView.Medium);

    useCameraZoomStore.setState({ worldmapView: 99 as CameraView });
    expect(resolveStoredWorldmapCameraView(CameraView.Medium)).toBe(CameraView.Medium);

    useCameraZoomStore.setState({ worldmapView: CameraView.Far });
    expect(resolveStoredWorldmapCameraView(CameraView.Medium)).toBe(CameraView.Far);
  });

  it("clamps a stale stored local distance to the scene zoom limits when applying", () => {
    useCameraZoomStore.getState().setLocalDistance(500);
    expect(resolveStoredLocalCameraDistance({ min: 5, max: 20 })).toBe(20);

    useCameraZoomStore.getState().setLocalDistance(1);
    expect(resolveStoredLocalCameraDistance({ min: 5, max: 20 })).toBe(5);

    useCameraZoomStore.getState().setLocalDistance(12);
    expect(resolveStoredLocalCameraDistance({ min: 5, max: 20 })).toBe(12);
  });

  it("treats missing or invalid local distances as unset", () => {
    expect(resolveStoredLocalCameraDistance({ min: 5, max: 20 })).toBeNull();

    useCameraZoomStore.setState({ localDistance: Number.NaN });
    expect(resolveStoredLocalCameraDistance({ min: 5, max: 20 })).toBeNull();
  });

  it("sanitizes worldmap views to the known camera bands", () => {
    expect(sanitizeWorldmapCameraView(CameraView.Close)).toBe(CameraView.Close);
    expect(sanitizeWorldmapCameraView(0)).toBeNull();
    expect(sanitizeWorldmapCameraView("2")).toBeNull();
    expect(sanitizeWorldmapCameraView(undefined)).toBeNull();
  });

  it("clamps camera distances into the provided range", () => {
    expect(clampCameraDistance(3, { min: 5, max: 20 })).toBe(5);
    expect(clampCameraDistance(25, { min: 5, max: 20 })).toBe(20);
    expect(clampCameraDistance(10, { min: 5, max: 20 })).toBe(10);
  });
});
