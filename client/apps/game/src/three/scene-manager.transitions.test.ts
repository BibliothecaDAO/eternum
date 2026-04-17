import { beforeEach, describe, expect, it, vi } from "vitest";
import { SceneManager } from "./scene-manager";
import { SceneName } from "./types";

function createFakeScene(name: string) {
  return {
    name,
    setup: vi.fn(async () => {}),
    onSwitchOff: vi.fn(),
    moveCameraToURLLocation: vi.fn(),
    activateInputSurface: vi.fn(),
    deactivateInputSurface: vi.fn(),
    destroy: vi.fn(),
  };
}

function createSceneTransitionFixture() {
  const transitionManager = {
    fadeOut: vi.fn((callback: () => void | Promise<void>) => {
      void callback();
    }),
    fadeIn: vi.fn(),
  };
  const worldmapScene = createFakeScene("worldmap");
  const hexceptionScene = createFakeScene("hexception");
  const fastTravelScene = createFakeScene("fast-travel");

  const manager = new SceneManager(transitionManager as never);
  manager.addScene(SceneName.WorldMap, worldmapScene as never);
  manager.addScene(SceneName.Hexception, hexceptionScene as never);
  manager.addScene(SceneName.FastTravel, fastTravelScene as never);

  async function settle() {
    // fadeOut → completeTransition is async via microtasks; two drains cover setup + finalize.
    await Promise.resolve();
    await Promise.resolve();
  }

  return { fastTravelScene, hexceptionScene, manager, settle, transitionManager, worldmapScene };
}

describe("SceneManager multi-hop transitions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("walks Worldmap → Hexception → Worldmap → FastTravel with correct input-surface ordering", async () => {
    const fixture = createSceneTransitionFixture();

    fixture.manager.switchScene(SceneName.WorldMap);
    await fixture.settle();
    fixture.manager.switchScene(SceneName.Hexception);
    await fixture.settle();
    fixture.manager.switchScene(SceneName.WorldMap);
    await fixture.settle();
    fixture.manager.switchScene(SceneName.FastTravel);
    await fixture.settle();

    expect(fixture.manager.getCurrentScene()).toBe(SceneName.FastTravel);

    expect(fixture.worldmapScene.setup).toHaveBeenCalledTimes(2);
    expect(fixture.hexceptionScene.setup).toHaveBeenCalledTimes(1);
    expect(fixture.fastTravelScene.setup).toHaveBeenCalledTimes(1);

    expect(fixture.worldmapScene.activateInputSurface).toHaveBeenCalledTimes(2);
    expect(fixture.worldmapScene.deactivateInputSurface).toHaveBeenCalledTimes(2);
    expect(fixture.hexceptionScene.activateInputSurface).toHaveBeenCalledTimes(1);
    expect(fixture.hexceptionScene.deactivateInputSurface).toHaveBeenCalledTimes(1);
    expect(fixture.fastTravelScene.activateInputSurface).toHaveBeenCalledTimes(1);
    expect(fixture.fastTravelScene.deactivateInputSurface).not.toHaveBeenCalled();

    expect(fixture.worldmapScene.onSwitchOff).toHaveBeenNthCalledWith(1, SceneName.Hexception);
    expect(fixture.hexceptionScene.onSwitchOff).toHaveBeenCalledWith(SceneName.WorldMap);
    expect(fixture.worldmapScene.onSwitchOff).toHaveBeenNthCalledWith(2, SceneName.FastTravel);

    expect(fixture.transitionManager.fadeOut).toHaveBeenCalledTimes(4);
    expect(fixture.transitionManager.fadeIn).toHaveBeenCalledTimes(4);
  });

  it("supersedes an in-flight transition when a newer one is queued mid-setup", async () => {
    const fixture = createSceneTransitionFixture();
    let releaseWorldmapSetup!: () => void;
    const worldmapSetupGate = new Promise<void>((resolve) => {
      releaseWorldmapSetup = resolve;
    });
    fixture.worldmapScene.setup = vi.fn(async () => {
      await worldmapSetupGate;
    });

    fixture.manager.switchScene(SceneName.WorldMap);
    await Promise.resolve();
    // WorldMap is mid-setup. Queue a newer transition to Hexception.
    fixture.manager.switchScene(SceneName.Hexception);
    releaseWorldmapSetup();
    await fixture.settle();
    await fixture.settle();

    expect(fixture.manager.getCurrentScene()).toBe(SceneName.Hexception);
    expect(fixture.worldmapScene.activateInputSurface).not.toHaveBeenCalled();
    expect(fixture.hexceptionScene.activateInputSurface).toHaveBeenCalledTimes(1);
  });
});
