import { describe, expect, it } from "vitest";
import { Scene, PerspectiveCamera, Vector3 } from "three";
import { createWorldWeatherFxBackend } from "./world-weather-fx-backend";
import type { AtmosphereSnapshot } from "./atmosphere-controller";

function createSnapshot(overrides: Partial<AtmosphereSnapshot> = {}): AtmosphereSnapshot {
  return {
    cycleProgress: 50,
    fogFactor: 0,
    intensity: 0,
    rainIntensity: 0,
    skyDarkness: 0,
    stormIntensity: 0,
    sunOcclusion: 0,
    timeOfDay: "day",
    weatherPhase: "clear",
    weatherType: "clear",
    windDirection: { x: 1, y: 0 },
    windSpeed: 0,
    ...overrides,
  };
}

describe("createWorldWeatherFxBackend", () => {
  it("installs world-owned weather FX instead of relying on the HUD overlay", () => {
    const scene = new Scene();
    const backend = createWorldWeatherFxBackend({
      activeMode: "webgpu",
      scene,
    });

    expect(backend.kind).toBe("world-scene-weather");
    expect(scene.children.length).toBeGreaterThan(0);
  });

  it("updates world weather from a shared snapshot and tears down cleanly", () => {
    const scene = new Scene();
    const backend = createWorldWeatherFxBackend({
      activeMode: "legacy-webgl",
      scene,
    });

    backend.setSnapshot(
      createSnapshot({
        cycleProgress: 80,
        intensity: 0.8,
        rainIntensity: 0.8,
        stormIntensity: 0.4,
        weatherPhase: "peak",
        weatherType: "storm",
        windSpeed: 0.7,
      }),
    );

    backend.update(0.016, new PerspectiveCamera(), new Vector3(1, 2, 3));
    expect(scene.children.length).toBeGreaterThan(0);

    backend.destroy();
    expect(scene.children.length).toBe(0);
  });
});
