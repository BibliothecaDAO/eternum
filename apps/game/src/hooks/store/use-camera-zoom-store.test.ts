import { beforeEach, describe, expect, it } from "vitest";

import {
  CAMERA_ZOOM_STORAGE_KEY,
  clampCameraDistance,
  resolveStoredLocalCameraDistance,
  resolveStoredWorldmapCameraDistance,
  useCameraZoomStore,
} from "./use-camera-zoom-store";

describe("useCameraZoomStore", () => {
  beforeEach(async () => {
    window.localStorage.clear();
    useCameraZoomStore.setState({ worldmapDistance: null, localDistance: null });
    await useCameraZoomStore.persist.clearStorage();
  });

  it("persists per-scene zoom distances to localStorage under the camera zoom key", () => {
    useCameraZoomStore.getState().setWorldmapDistance(37.5);
    useCameraZoomStore.getState().setLocalDistance(12.5);

    const persisted = window.localStorage.getItem(CAMERA_ZOOM_STORAGE_KEY);
    expect(JSON.parse(persisted ?? "{}")).toMatchObject({
      state: {
        worldmapDistance: 37.5,
        localDistance: 12.5,
      },
    });
  });

  it("resets both scene preferences back to scene defaults", () => {
    useCameraZoomStore.getState().setWorldmapDistance(30);
    useCameraZoomStore.getState().setLocalDistance(8);

    useCameraZoomStore.getState().resetToDefaults();

    expect(useCameraZoomStore.getState().worldmapDistance).toBeNull();
    expect(useCameraZoomStore.getState().localDistance).toBeNull();
  });

  it("clamps stale stored distances to the scene zoom limits when applying", () => {
    useCameraZoomStore.getState().setWorldmapDistance(500);
    expect(resolveStoredWorldmapCameraDistance({ min: 10, max: 80 })).toBe(80);

    useCameraZoomStore.getState().setLocalDistance(1);
    expect(resolveStoredLocalCameraDistance({ min: 5, max: 20 })).toBe(5);

    useCameraZoomStore.getState().setLocalDistance(12);
    expect(resolveStoredLocalCameraDistance({ min: 5, max: 20 })).toBe(12);
  });

  it("treats missing or invalid distances as unset", () => {
    expect(resolveStoredWorldmapCameraDistance({ min: 10, max: 80 })).toBeNull();
    expect(resolveStoredLocalCameraDistance({ min: 5, max: 20 })).toBeNull();

    useCameraZoomStore.setState({ localDistance: Number.NaN });
    expect(resolveStoredLocalCameraDistance({ min: 5, max: 20 })).toBeNull();
  });

  it("clamps camera distances into the provided range", () => {
    expect(clampCameraDistance(3, { min: 5, max: 20 })).toBe(5);
    expect(clampCameraDistance(25, { min: 5, max: 20 })).toBe(20);
    expect(clampCameraDistance(10, { min: 5, max: 20 })).toBe(10);
  });
});
