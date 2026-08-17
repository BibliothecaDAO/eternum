import { CameraView } from "@/three/scenes/camera-view";
import { create } from "zustand";
import { createJSONStorage, persist, subscribeWithSelector } from "zustand/middleware";

export const CAMERA_ZOOM_STORAGE_KEY = "eternum-camera-zoom";

/**
 * Player camera-zoom preference, persisted per scene so switching between the
 * local (hexception) and world scenes restores the zoom the player left off at.
 *
 * `null` means "use the scene's built-in default". The worldmap zooms in
 * discrete bands (CameraView), the local scene in continuous camera distance.
 */
interface CameraZoomState {
  worldmapView: CameraView | null;
  localDistance: number | null;
  setWorldmapView: (view: CameraView) => void;
  setLocalDistance: (distance: number) => void;
  resetToDefaults: () => void;
}

export const useCameraZoomStore = create<CameraZoomState>()(
  subscribeWithSelector(
    persist(
      (set) => ({
        worldmapView: null,
        localDistance: null,
        setWorldmapView: (worldmapView) => set({ worldmapView }),
        setLocalDistance: (localDistance) => set({ localDistance }),
        resetToDefaults: () => set({ worldmapView: null, localDistance: null }),
      }),
      {
        name: CAMERA_ZOOM_STORAGE_KEY,
        version: 1,
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({ worldmapView: state.worldmapView, localDistance: state.localDistance }),
      },
    ),
  ),
);

export const sanitizeWorldmapCameraView = (value: unknown): CameraView | null =>
  value === CameraView.Close || value === CameraView.Medium || value === CameraView.Far ? value : null;

export const clampCameraDistance = (distance: number, range: { min: number; max: number }): number =>
  Math.min(range.max, Math.max(range.min, distance));

export const resolveStoredWorldmapCameraView = (fallback: CameraView): CameraView =>
  sanitizeWorldmapCameraView(useCameraZoomStore.getState().worldmapView) ?? fallback;

/** Stored local-scene camera distance clamped to the scene's zoom limits, or null when unset/invalid. */
export const resolveStoredLocalCameraDistance = (range: { min: number; max: number }): number | null => {
  const stored = useCameraZoomStore.getState().localDistance;
  if (typeof stored !== "number" || !Number.isFinite(stored)) {
    return null;
  }

  return clampCameraDistance(stored, range);
};
