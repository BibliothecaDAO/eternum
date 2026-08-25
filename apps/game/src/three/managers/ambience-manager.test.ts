import { describe, expect, it, vi } from "vitest";
import { WeatherType } from "./weather-manager";
import { AmbienceManager } from "./ambience-manager";

describe("ambience-manager", () => {
  const installLocalStorageMock = () => {
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        key: vi.fn(),
        length: 0,
      },
      configurable: true,
      writable: true,
    });
  };

  it("avoids repeated sound-layer churn for stable weather inputs across frames", () => {
    installLocalStorageMock();
    const manager = new AmbienceManager() as any;
    manager.isAudioReady = () => true;

    const updateLayersSpy = vi.spyOn(manager, "updateSoundLayers").mockImplementation(() => {});
    vi.spyOn(manager, "updateActiveSounds").mockImplementation(() => {});

    manager.update(50, WeatherType.CLEAR, 0.016, 0.8, 0);
    const callCountAfterFirstFrame = updateLayersSpy.mock.calls.length;

    manager.update(50, WeatherType.CLEAR, 0.016, 0.8, 0);

    expect(updateLayersSpy.mock.calls.length).toBe(callCountAfterFirstFrame);
  });

  it("tracks random-interval clip sources so newly played clips are layer-owned", async () => {
    installLocalStorageMock();
    const manager = new AmbienceManager() as any;
    manager.isAudioReady = () => true;

    const sourceA = { id: "A" } as unknown as AudioBufferSourceNode;
    const sourceB = { id: "B" } as unknown as AudioBufferSourceNode;
    const play = vi.fn().mockResolvedValueOnce(sourceA).mockResolvedValueOnce(sourceB);

    manager.audioManager = {
      play,
      stop: vi.fn(),
      setSourceVolume: vi.fn(),
      isInitialized: () => true,
    };

    const layer = manager.soundLayers[0];
    const layerId = manager.getLayerId(layer, 0);

    await manager.startSound(layer, layerId);

    const activeSound = manager.activeSounds.get(layerId);
    activeSound.nextPlayTime = 0.001;
    manager.updateActiveSounds(0.016);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(activeSound.sources?.has(sourceA)).toBe(true);
    expect(activeSound.sources?.has(sourceB)).toBe(true);
    expect(play).toHaveBeenCalledTimes(2);
  });
});
