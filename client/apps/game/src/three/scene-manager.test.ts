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

  it("drops superseded in-flight transition setup and applies only the latest requested scene", async () => {
    const fadeOutCallbacks: Array<() => void | Promise<void>> = [];
    const transitionManager = {
      fadeOut: vi.fn((callback: () => void | Promise<void>) => {
        fadeOutCallbacks.push(callback);
      }),
      fadeIn: vi.fn(),
    };

    const sceneManager = new SceneManager(transitionManager as unknown as TransitionManager);
    const worldMapSetup = vi.fn(async () => {});
    const hexSetup = vi.fn(async () => {});

    sceneManager.addScene(
      SceneName.WorldMap,
      {
        setup: worldMapSetup,
        onSwitchOff: vi.fn(),
        moveCameraToURLLocation: vi.fn(),
      } as unknown as HexagonScene,
    );

    sceneManager.addScene(
      SceneName.Hexception,
      {
        setup: hexSetup,
        onSwitchOff: vi.fn(),
        moveCameraToURLLocation: vi.fn(),
      } as unknown as HexagonScene,
    );

    sceneManager.switchScene(SceneName.WorldMap);
    sceneManager.switchScene(SceneName.Hexception);

    expect(transitionManager.fadeOut).toHaveBeenCalledTimes(1);
    await fadeOutCallbacks[0]();

    expect(worldMapSetup).not.toHaveBeenCalled();
    expect(sceneManager.getCurrentScene()).toBeUndefined();
    expect(transitionManager.fadeIn).not.toHaveBeenCalled();
    expect(transitionManager.fadeOut).toHaveBeenCalledTimes(2);
    expect(fadeOutCallbacks).toHaveLength(2);

    await fadeOutCallbacks[1]();

    expect(hexSetup).toHaveBeenCalledTimes(1);
    expect(sceneManager.getCurrentScene()).toBe(SceneName.Hexception);
    expect(transitionManager.fadeIn).toHaveBeenCalledTimes(1);
  });

  it("coalesces multiple rapid scene toggles to the latest pending scene", async () => {
    const fadeOutCallbacks: Array<() => void | Promise<void>> = [];
    const transitionManager = {
      fadeOut: vi.fn((callback: () => void | Promise<void>) => {
        fadeOutCallbacks.push(callback);
      }),
      fadeIn: vi.fn(),
    };

    const sceneManager = new SceneManager(transitionManager as unknown as TransitionManager);
    const worldMapSetup = vi.fn(async () => {});
    const hexSetup = vi.fn(async () => {});

    sceneManager.addScene(
      SceneName.WorldMap,
      {
        setup: worldMapSetup,
        onSwitchOff: vi.fn(),
        moveCameraToURLLocation: vi.fn(),
      } as unknown as HexagonScene,
    );

    sceneManager.addScene(
      SceneName.Hexception,
      {
        setup: hexSetup,
        onSwitchOff: vi.fn(),
        moveCameraToURLLocation: vi.fn(),
      } as unknown as HexagonScene,
    );

    sceneManager.switchScene(SceneName.WorldMap);
    sceneManager.switchScene(SceneName.Hexception);
    sceneManager.switchScene(SceneName.WorldMap);

    expect(transitionManager.fadeOut).toHaveBeenCalledTimes(1);
    await fadeOutCallbacks[0]();

    expect(transitionManager.fadeOut).toHaveBeenCalledTimes(2);
    expect(fadeOutCallbacks).toHaveLength(2);
    expect(worldMapSetup).not.toHaveBeenCalled();
    expect(hexSetup).not.toHaveBeenCalled();

    await fadeOutCallbacks[1]();

    expect(worldMapSetup).toHaveBeenCalledTimes(1);
    expect(hexSetup).not.toHaveBeenCalled();
    expect(sceneManager.getCurrentScene()).toBe(SceneName.WorldMap);
  });
});
