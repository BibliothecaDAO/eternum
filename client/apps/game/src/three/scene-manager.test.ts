import { describe, expect, it, vi } from "vitest";
import { TransitionManager } from "./managers/transition-manager";
import { SceneManager } from "./scene-manager";
import { HexagonScene } from "./scenes/hexagon-scene";
import { SceneName } from "./types";

describe("SceneManager transition baseline", () => {
  it("does not start a second transition while a fade-out callback is still pending", () => {
    const fadeOutCallbacks: Array<() => void | Promise<void>> = [];
    const transitionManager = {
      fadeOut: vi.fn((callback: () => void | Promise<void>) => {
        fadeOutCallbacks.push(callback);
      }),
      fadeIn: vi.fn(),
    };

    const sceneManager = new SceneManager(transitionManager as unknown as TransitionManager);

    sceneManager.addScene(
      SceneName.WorldMap,
      {
        setup: vi.fn(async () => {}),
        onSwitchOff: vi.fn(),
        moveCameraToURLLocation: vi.fn(),
      } as unknown as HexagonScene,
    );

    sceneManager.addScene(
      SceneName.Hexception,
      {
        setup: vi.fn(async () => {}),
        onSwitchOff: vi.fn(),
        moveCameraToURLLocation: vi.fn(),
      } as unknown as HexagonScene,
    );

    sceneManager.switchScene(SceneName.WorldMap);
    sceneManager.switchScene(SceneName.Hexception);

    expect(transitionManager.fadeOut).toHaveBeenCalledTimes(1);
    expect(fadeOutCallbacks).toHaveLength(1);
  });
});
