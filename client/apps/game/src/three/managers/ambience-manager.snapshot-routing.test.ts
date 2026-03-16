import { describe, expect, it, vi } from "vitest";
import { AmbienceManager } from "./ambience-manager";

describe("AmbienceManager shared atmosphere routing", () => {
  it("routes storm semantics from the shared snapshot instead of inferring stale clear weather", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        clear: vi.fn(),
        getItem: vi.fn(() => null),
        key: vi.fn(),
        length: 0,
        removeItem: vi.fn(),
        setItem: vi.fn(),
      },
    });
    const manager = new AmbienceManager() as any;
    manager.isAudioReady = () => true;
    vi.spyOn(manager, "updateSoundLayers").mockImplementation(() => {});
    vi.spyOn(manager, "updateActiveSounds").mockImplementation(() => {});

    manager.updateFromSnapshot(
      {
        cycleProgress: 82,
        fogFactor: 0.7,
        intensity: 0.9,
        rainIntensity: 1,
        skyDarkness: 0.8,
        stormIntensity: 0.85,
        sunOcclusion: 0.7,
        timeOfDay: "evening",
        weatherPhase: "peak",
        weatherType: "storm",
        windDirection: { x: 1, y: 0 },
        windSpeed: 0.8,
      },
      0.016,
    );

    expect(manager.getCurrentWeather()).toBe("storm");
  });
});
