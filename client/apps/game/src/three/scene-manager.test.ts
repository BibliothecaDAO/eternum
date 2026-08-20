import { describe, expect, it, vi } from "vitest";
import { TransitionManager } from "./managers/transition-manager";
import { SceneManager } from "./scene-manager";
import { HexagonScene, type SceneSetupContext } from "./scenes/hexagon-scene";
import { SceneName } from "./types";

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function createTransitionHarness(events?: string[]) {
  const fadeOuts: Array<Deferred<boolean>> = [];
  const transitionManager = {
    fadeIn: vi.fn(),
    fadeOut: vi.fn(() => {
      events?.push("fade-out");
      const fadeOut = createDeferred<boolean>();
      fadeOuts.push(fadeOut);
      return fadeOut.promise;
    }),
    isActive: vi.fn(() => true),
  };

  return {
    fadeOuts,
    sceneManager: new SceneManager(transitionManager as unknown as TransitionManager),
    transitionManager,
  };
}

async function flushTransitionWork() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function completeFade(fadeOut: Deferred<boolean>) {
  fadeOut.resolve(true);
  await flushTransitionWork();
}

function createScene(overrides: Partial<HexagonScene> = {}) {
  return {
    setup: vi.fn(async () => {}),
    onSwitchOff: vi.fn(),
    moveCameraToURLLocation: vi.fn(),
    ...overrides,
  } as unknown as HexagonScene;
}

describe("SceneManager transitions", () => {
  it("starts setup with fade-out and waits for the fade when setup is faster", async () => {
    const events: string[] = [];
    const { fadeOuts, sceneManager, transitionManager } = createTransitionHarness(events);
    const worldMap = createScene({
      setup: vi.fn(async () => {
        events.push("setup");
      }),
    });
    sceneManager.addScene(SceneName.WorldMap, worldMap);

    sceneManager.switchScene(SceneName.WorldMap);
    await flushTransitionWork();

    expect(events).toEqual(["fade-out", "setup"]);
    expect(sceneManager.getCurrentScene()).toBeUndefined();
    expect(transitionManager.fadeIn).not.toHaveBeenCalled();

    await completeFade(fadeOuts[0]);

    expect(sceneManager.getCurrentScene()).toBe(SceneName.WorldMap);
    expect(transitionManager.fadeIn).toHaveBeenCalledOnce();
  });

  it("keeps the previous scene hidden until slower setup finishes", async () => {
    const setup = createDeferred<void>();
    const { fadeOuts, sceneManager, transitionManager } = createTransitionHarness();
    const worldMap = createScene({ setup: vi.fn(() => setup.promise) });
    sceneManager.addScene(SceneName.WorldMap, worldMap);

    sceneManager.switchScene(SceneName.WorldMap);
    await completeFade(fadeOuts[0]);

    expect(worldMap.setup).toHaveBeenCalledOnce();
    expect(sceneManager.getCurrentScene()).toBeUndefined();
    expect(transitionManager.fadeIn).not.toHaveBeenCalled();

    setup.resolve();
    await flushTransitionWork();

    expect(sceneManager.getCurrentScene()).toBe(SceneName.WorldMap);
    expect(transitionManager.fadeIn).toHaveBeenCalledOnce();
  });

  it("queues a superseding request and promotes only its scene", async () => {
    const firstSetup = createDeferred<void>();
    const { fadeOuts, sceneManager, transitionManager } = createTransitionHarness();
    const activateWorldMapInput = vi.fn();
    let worldMapIsSubscribed = false;
    const worldMap = createScene({
      activateInputSurface: activateWorldMapInput,
      setup: vi.fn(() => {
        worldMapIsSubscribed = true;
        return firstSetup.promise;
      }),
      onSwitchOff: vi.fn(() => {
        worldMapIsSubscribed = false;
      }),
    });
    const activateHexInput = vi.fn();
    const hexception = createScene({ activateInputSurface: activateHexInput });
    sceneManager.addScene(SceneName.WorldMap, worldMap);
    sceneManager.addScene(SceneName.Hexception, hexception);

    sceneManager.switchScene(SceneName.WorldMap);
    sceneManager.switchScene(SceneName.Hexception);

    expect(transitionManager.fadeOut).toHaveBeenCalledTimes(1);
    expect(worldMap.setup).toHaveBeenCalledOnce();
    expect(hexception.setup).not.toHaveBeenCalled();

    await completeFade(fadeOuts[0]);
    firstSetup.resolve();
    await flushTransitionWork();

    expect(sceneManager.getCurrentScene()).toBeUndefined();
    expect(transitionManager.fadeIn).not.toHaveBeenCalled();
    expect(activateWorldMapInput).not.toHaveBeenCalled();
    expect(worldMapIsSubscribed).toBe(false);
    expect(worldMap.onSwitchOff).toHaveBeenCalledOnce();
    expect(worldMap.onSwitchOff).toHaveBeenCalledWith(SceneName.Hexception);
    expect(worldMap.moveCameraToURLLocation).not.toHaveBeenCalled();
    expect(transitionManager.fadeOut).toHaveBeenCalledTimes(2);
    expect(hexception.setup).toHaveBeenCalledOnce();

    await completeFade(fadeOuts[1]);

    expect(sceneManager.getCurrentScene()).toBe(SceneName.Hexception);
    expect(transitionManager.fadeIn).toHaveBeenCalledOnce();
    expect(activateWorldMapInput).not.toHaveBeenCalled();
    expect(worldMap.onSwitchOff).toHaveBeenCalledOnce();
    expect(activateHexInput).toHaveBeenCalledOnce();
    expect(worldMap.moveCameraToURLLocation).not.toHaveBeenCalled();
    expect(hexception.moveCameraToURLLocation).toHaveBeenCalledOnce();
  });

  it("invalidates the candidate setup context as soon as a newer scene request wins", async () => {
    const setup = createDeferred<void>();
    const { fadeOuts, sceneManager } = createTransitionHarness();
    let setupContext: SceneSetupContext | undefined;
    const worldMap = createScene({
      setup: vi.fn((context?: SceneSetupContext) => {
        setupContext = context;
        return setup.promise;
      }),
    });
    const hexception = createScene();
    sceneManager.addScene(SceneName.WorldMap, worldMap);
    sceneManager.addScene(SceneName.Hexception, hexception);

    sceneManager.switchScene(SceneName.WorldMap);
    expect(setupContext?.isCurrent()).toBe(true);

    sceneManager.switchScene(SceneName.Hexception);
    expect(setupContext?.isCurrent()).toBe(false);

    await completeFade(fadeOuts[0]);
    setup.resolve();
    await flushTransitionWork();
    await completeFade(fadeOuts[1]);
  });

  it("invalidates the candidate setup context when the transition manager becomes inactive", async () => {
    const setup = createDeferred<void>();
    const { fadeOuts, sceneManager, transitionManager } = createTransitionHarness();
    let setupContext: SceneSetupContext | undefined;
    const worldMap = createScene({
      setup: vi.fn((context?: SceneSetupContext) => {
        setupContext = context;
        return setup.promise;
      }),
    });
    sceneManager.addScene(SceneName.WorldMap, worldMap);

    sceneManager.switchScene(SceneName.WorldMap);
    expect(setupContext?.isCurrent()).toBe(true);

    transitionManager.isActive.mockReturnValue(false);
    expect(setupContext?.isCurrent()).toBe(false);

    fadeOuts[0].resolve(false);
    setup.resolve();
    await flushTransitionWork();
  });

  it("coalesces rapid requests to the latest pending scene", async () => {
    const firstSetup = createDeferred<void>();
    const { fadeOuts, sceneManager } = createTransitionHarness();
    const worldMapSetup = vi.fn<() => Promise<void>>();
    worldMapSetup.mockImplementationOnce(() => firstSetup.promise).mockResolvedValueOnce();
    const worldMap = createScene({ setup: worldMapSetup });
    const hexception = createScene();
    sceneManager.addScene(SceneName.WorldMap, worldMap);
    sceneManager.addScene(SceneName.Hexception, hexception);

    sceneManager.switchScene(SceneName.WorldMap);
    sceneManager.switchScene(SceneName.Hexception);
    sceneManager.switchScene(SceneName.WorldMap);

    await completeFade(fadeOuts[0]);
    firstSetup.resolve();
    await flushTransitionWork();
    await completeFade(fadeOuts[1]);

    expect(worldMap.setup).toHaveBeenCalledTimes(2);
    expect(hexception.setup).not.toHaveBeenCalled();
    expect(sceneManager.getCurrentScene()).toBe(SceneName.WorldMap);
  });

  it("keeps the previous scene current and restores visibility when setup fails", async () => {
    const { fadeOuts, sceneManager, transitionManager } = createTransitionHarness();
    const worldMap = createScene();
    const brokenSetupError = new Error("setup failed");
    let brokenSceneIsSubscribed = false;
    const brokenSetup = vi.fn(async () => {
      brokenSceneIsSubscribed = true;
      throw brokenSetupError;
    });
    const hexception = createScene({
      setup: brokenSetup,
      onSwitchOff: vi.fn(() => {
        brokenSceneIsSubscribed = false;
      }),
    });
    sceneManager.addScene(SceneName.WorldMap, worldMap);
    sceneManager.addScene(SceneName.Hexception, hexception);

    sceneManager.switchScene(SceneName.WorldMap);
    await completeFade(fadeOuts[0]);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    sceneManager.switchScene(SceneName.Hexception);
    await completeFade(fadeOuts[1]);

    expect(brokenSetup).toHaveBeenCalledOnce();
    expect(sceneManager.getCurrentScene()).toBe(SceneName.WorldMap);
    expect(transitionManager.fadeIn).toHaveBeenCalledTimes(2);
    expect(worldMap.moveCameraToURLLocation).toHaveBeenCalledTimes(2);
    expect(brokenSceneIsSubscribed).toBe(false);
    expect(hexception.onSwitchOff).toHaveBeenCalledOnce();
    expect(hexception.onSwitchOff).toHaveBeenCalledWith(SceneName.WorldMap);
    expect(hexception.moveCameraToURLLocation).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith("[SceneManager] Failed to set up scene hex: setup failed");
  });

  it("cleans a candidate and starts the pending request when fade-out is canceled", async () => {
    const { fadeOuts, sceneManager, transitionManager } = createTransitionHarness();
    let worldMapIsSubscribed = false;
    const worldMap = createScene({
      setup: vi.fn(async () => {
        worldMapIsSubscribed = true;
      }),
      onSwitchOff: vi.fn(() => {
        worldMapIsSubscribed = false;
      }),
    });
    const activateHexInput = vi.fn();
    const hexception = createScene({ activateInputSurface: activateHexInput });
    sceneManager.addScene(SceneName.WorldMap, worldMap);
    sceneManager.addScene(SceneName.Hexception, hexception);

    sceneManager.switchScene(SceneName.WorldMap);
    sceneManager.switchScene(SceneName.Hexception);
    fadeOuts[0].resolve(false);
    await flushTransitionWork();

    expect(worldMapIsSubscribed).toBe(false);
    expect(worldMap.onSwitchOff).toHaveBeenCalledOnce();
    expect(worldMap.onSwitchOff).toHaveBeenCalledWith(SceneName.Hexception);
    expect(sceneManager.getCurrentScene()).toBeUndefined();
    expect(transitionManager.fadeIn).not.toHaveBeenCalled();
    expect(transitionManager.fadeOut).toHaveBeenCalledTimes(2);
    expect(hexception.setup).toHaveBeenCalledOnce();

    await completeFade(fadeOuts[1]);

    expect(sceneManager.getCurrentScene()).toBe(SceneName.Hexception);
    expect(activateHexInput).toHaveBeenCalledOnce();
  });

  it("activates input on reveal and deactivates it when the next transition begins", async () => {
    const { fadeOuts, sceneManager } = createTransitionHarness();
    const activateWorldMapInput = vi.fn();
    const deactivateWorldMapInput = vi.fn();
    const activateHexInput = vi.fn();
    const worldMap = createScene({
      activateInputSurface: activateWorldMapInput,
      deactivateInputSurface: deactivateWorldMapInput,
    });
    const hexception = createScene({ activateInputSurface: activateHexInput });
    sceneManager.addScene(SceneName.WorldMap, worldMap);
    sceneManager.addScene(SceneName.Hexception, hexception);

    sceneManager.switchScene(SceneName.WorldMap);
    await completeFade(fadeOuts[0]);
    sceneManager.switchScene(SceneName.Hexception);

    expect(deactivateWorldMapInput).toHaveBeenCalledOnce();
    expect(activateHexInput).not.toHaveBeenCalled();

    await completeFade(fadeOuts[1]);

    expect(activateWorldMapInput).toHaveBeenCalledOnce();
    expect(activateHexInput).toHaveBeenCalledOnce();
  });
});
