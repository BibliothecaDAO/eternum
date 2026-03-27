import { beforeAll, describe, expect, it, vi } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";

import {
  WORLDMAP_STRATEGIC_MAX_SCALE,
  WORLDMAP_STRATEGIC_MIN_SCALE,
} from "@/three/scenes/worldmap-navigation/world-navigation-mode-machine";

const browserGlobals = vi.hoisted(() => {
  const localStorageMock: Storage = {
    getItem: (key: string) => {
      if (key === "INITIAL_LAPTOP_CHECK") {
        return "true";
      }

      if (key === "GRAPHICS_SETTING") {
        return "HIGH";
      }

      if (key === "FLAT_MODE") {
        return "false";
      }

      return null;
    },
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
    key: () => null,
    length: 0,
  };

  const navigatorMock = {
    userAgent: "vitest-node",
    getBattery: async () => ({ charging: true, chargingTime: 0 }),
  };

  return { localStorageMock, navigatorMock };
});

vi.stubGlobal("localStorage", browserGlobals.localStorageMock);
vi.stubGlobal("navigator", browserGlobals.navigatorMock);

const VIEWPORT_WIDTH = 1600;
const VIEWPORT_HEIGHT = 900;

let centeredHexToContractHex: typeof import("./strategic-map-coordinates").centeredHexToContractHex;
let resolveMatchedStrategicMapScale: typeof import("./strategic-map-viewport").resolveMatchedStrategicMapScale;
let resolveStrategicMapFallbackScale: typeof import("./strategic-map-viewport").resolveStrategicMapFallbackScale;

beforeAll(async () => {
  ({ centeredHexToContractHex } = await import("./strategic-map-coordinates"));
  ({ resolveMatchedStrategicMapScale, resolveStrategicMapFallbackScale } = await import("./strategic-map-viewport"));
});

describe("resolveMatchedStrategicMapScale", () => {
  it("returns a clamped projection-matched scale for a valid focus hex", () => {
    const scale = resolveMatchedStrategicMapScale({
      camera: createStrategicProjectionCamera(new Vector3(0, 0, 0)),
      viewportWidth: VIEWPORT_WIDTH,
      viewportHeight: VIEWPORT_HEIGHT,
      anchorHex: centeredHexToContractHex({ col: 0, row: 0 }),
    });

    expect(scale).toBeGreaterThan(WORLDMAP_STRATEGIC_MIN_SCALE);
    expect(scale).toBeLessThanOrEqual(WORLDMAP_STRATEGIC_MAX_SCALE);
    expect(scale).not.toBe(resolveStrategicMapFallbackScale());
  });

  it("falls back safely when the viewport dimensions are unavailable", () => {
    const fallbackScale = 2.75;

    const scale = resolveMatchedStrategicMapScale({
      camera: createStrategicProjectionCamera(new Vector3(0, 0, 0)),
      viewportWidth: 0,
      viewportHeight: VIEWPORT_HEIGHT,
      anchorHex: centeredHexToContractHex({ col: 0, row: 0 }),
      fallbackScale,
    });

    expect(scale).toBe(fallbackScale);
  });

  it("falls back safely when the anchor projection is invalid", () => {
    const fallbackScale = 2.75;

    const scale = resolveMatchedStrategicMapScale({
      camera: createStrategicProjectionCamera(new Vector3(0, 56, 100)),
      viewportWidth: VIEWPORT_WIDTH,
      viewportHeight: VIEWPORT_HEIGHT,
      anchorHex: centeredHexToContractHex({ col: 0, row: 0 }),
      fallbackScale,
    });

    expect(scale).toBe(fallbackScale);
  });
});

function createStrategicProjectionCamera(lookAt: Vector3): PerspectiveCamera {
  const camera = new PerspectiveCamera(16, VIEWPORT_WIDTH / VIEWPORT_HEIGHT, 0.1, 1000);
  camera.position.set(0, 55.7, 5.85);
  camera.lookAt(lookAt);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  camera.updateWorldMatrix(true, false);
  return camera;
}
