import { create } from "zustand";
import { createJSONStorage, persist, subscribeWithSelector } from "zustand/middleware";

export const CAMERA_ZOOM_STORAGE_KEY = "eternum-camera-zoom";

/**
 * Player camera-zoom preference, persisted per scene so switching between the
 * local (hexception) and world scenes restores the zoom the player left off at.
 *
 * `null` means "use the scene's built-in default". Both scenes zoom in
 * continuous camera distance.
 */
interface CameraZoomState {
  worldmapDistance: number | null;
  localDistance: number | null;
  setWorldmapDistance: (distance: number) => void;
  setLocalDistance: (distance: number) => void;
  resetToDefaults: () => void;
}

export const useCameraZoomStore = create<CameraZoomState>()(
  subscribeWithSelector(
    persist(
      (set) => ({
        worldmapDistance: null,
        localDistance: null,
        setWorldmapDistance: (worldmapDistance) => set({ worldmapDistance }),
        setLocalDistance: (localDistance) => set({ localDistance }),
        resetToDefaults: () => set({ worldmapDistance: null, localDistance: null }),
      }),
      {
        name: CAMERA_ZOOM_STORAGE_KEY,
        // v1 stored a worldmap zoom band; it is dropped rather than mapped to a distance.
        version: 2,
        migrate: () => ({ worldmapDistance: null, localDistance: null }),
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({ worldmapDistance: state.worldmapDistance, localDistance: state.localDistance }),
      },
    ),
  ),
);

export const clampCameraDistance = (distance: number, range: { min: number; max: number }): number =>
  Math.min(range.max, Math.max(range.min, distance));

/** Stored camera distance clamped to the scene's zoom limits, or null when unset/invalid. */
const resolveStoredCameraDistance = (stored: number | null, range: { min: number; max: number }): number | null => {
  if (typeof stored !== "number" || !Number.isFinite(stored)) {
    return null;
  }

  return clampCameraDistance(stored, range);
};

export const resolveStoredWorldmapCameraDistance = (range: { min: number; max: number }): number | null =>
  resolveStoredCameraDistance(useCameraZoomStore.getState().worldmapDistance, range);

export const resolveStoredLocalCameraDistance = (range: { min: number; max: number }): number | null =>
  resolveStoredCameraDistance(useCameraZoomStore.getState().localDistance, range);
