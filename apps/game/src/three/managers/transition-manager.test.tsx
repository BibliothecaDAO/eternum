// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SceneName } from "../types";

const setIsLoadingScreenEnabled = vi.fn();
const setTooltip = vi.fn();

vi.mock("@/hooks/store/use-ui-store", () => ({
  useUIStore: {
    getState: () => ({
      setIsLoadingScreenEnabled,
      setTooltip,
    }),
  },
}));

const { TransitionManager } = await import("./transition-manager");
const { SceneManager } = await import("../scene-manager");

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function flushTransitionWork() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("TransitionManager lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves a destroyed pending fade-out as cancelled", async () => {
    const manager = new TransitionManager();

    const fadeOut = manager.fadeOut();
    manager.destroy();
    vi.runAllTimers();

    await expect(fadeOut).resolves.toBe(false);
    expect(setIsLoadingScreenEnabled).toHaveBeenCalledWith(true);
  });

  it("does not reveal or run post-effects when destroy follows fade-out but setup is still pending", async () => {
    const setup = createDeferred<void>();
    const manager = new TransitionManager();
    const sceneManager = new SceneManager(manager);
    const activateInputSurface = vi.fn();
    const moveCameraToURLLocation = vi.fn();
    sceneManager.addScene(SceneName.WorldMap, {
      activateInputSurface,
      moveCameraToURLLocation,
      onSwitchOff: vi.fn(),
      setup: vi.fn(() => setup.promise),
    } as never);

    sceneManager.switchScene(SceneName.WorldMap);
    vi.advanceTimersByTime(300);
    await flushTransitionWork();
    manager.destroy();
    setup.resolve();
    await flushTransitionWork();

    expect(sceneManager.getCurrentScene()).toBeUndefined();
    expect(activateInputSurface).not.toHaveBeenCalled();
    expect(moveCameraToURLLocation).not.toHaveBeenCalled();
    expect(setIsLoadingScreenEnabled).not.toHaveBeenCalledWith(false);
  });
});
