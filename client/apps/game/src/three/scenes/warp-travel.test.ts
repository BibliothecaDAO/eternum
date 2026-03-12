import { describe, expect, it, vi } from "vitest";

vi.mock("./hexagon-scene", () => ({
  HexagonScene: class {},
}));

import { WarpTravel } from "./warp-travel";
import {
  runWarpTravelSetupLifecycle,
  runWarpTravelSwitchOffLifecycle,
  type WarpTravelLifecycleAdapter,
  type WarpTravelLifecycleState,
} from "./warp-travel-lifecycle";

function createAdapter(overrides: Partial<WarpTravelLifecycleAdapter> = {}): {
  adapter: WarpTravelLifecycleAdapter;
  events: string[];
} {
  const events: string[] = [];

  return {
    events,
    adapter: {
      onSetupStart: () => events.push("setup:start"),
      onInitialSetupStart: () => events.push("setup:initial:start"),
      onResumeStart: () => events.push("setup:resume:start"),
      moveCameraToSceneLocation: () => events.push("camera:move"),
      attachLabelGroupsToScene: () => events.push("labels:groups:attach"),
      attachManagerLabels: () => events.push("labels:managers:attach"),
      registerStoreSubscriptions: () => events.push("subscriptions:register"),
      setupCameraZoomHandler: () => events.push("zoom:setup"),
      refreshScene: async () => {
        events.push("scene:refresh");
      },
      onInitialSetupComplete: async () => {
        events.push("setup:initial:complete");
      },
      onResumeComplete: async () => {
        events.push("setup:resume:complete");
      },
      reportSetupError: (error, phase) => {
        events.push(`setup:error:${phase}:${String(error)}`);
      },
      onSwitchOffStart: () => events.push("switchOff:start"),
      disposeStoreSubscriptions: () => events.push("subscriptions:dispose"),
      onAfterDisposeSubscriptions: () => events.push("subscriptions:afterDispose"),
      detachLabelGroupsFromScene: () => events.push("labels:groups:detach"),
      detachManagerLabels: () => events.push("labels:managers:detach"),
      onSwitchOffComplete: () => events.push("switchOff:complete"),
      ...overrides,
    },
  };
}

class CountingWarpTravel extends WarpTravel {
  public adapterCreations = 0;
  public readonly events: string[] = [];

  protected getWarpTravelLifecycleAdapter(): WarpTravelLifecycleAdapter {
    this.adapterCreations += 1;

    return {
      moveCameraToSceneLocation: () => this.events.push("camera:move"),
      attachLabelGroupsToScene: () => this.events.push("labels:groups:attach"),
      attachManagerLabels: () => this.events.push("labels:managers:attach"),
      registerStoreSubscriptions: () => this.events.push("subscriptions:register"),
      setupCameraZoomHandler: () => this.events.push("zoom:setup"),
      refreshScene: async () => {
        this.events.push("scene:refresh");
      },
      disposeStoreSubscriptions: () => this.events.push("subscriptions:dispose"),
      detachLabelGroupsFromScene: () => this.events.push("labels:groups:detach"),
      detachManagerLabels: () => this.events.push("labels:managers:detach"),
    };
  }

  public triggerSwitchOffLifecycle(): void {
    this.runWarpTravelSwitchOffLifecycle();
  }

  protected onHexagonMouseMove(): void {}

  protected onHexagonDoubleClick(): void {}

  protected onHexagonClick(): void {}

  protected onHexagonRightClick(): void {}

  public moveCameraToURLLocation(): void {}

  public onSwitchOff(_nextSceneName?: unknown): void {
    this.triggerSwitchOffLifecycle();
  }
}

function createCountingWarpTravel(): CountingWarpTravel {
  const instance = Object.create(CountingWarpTravel.prototype) as CountingWarpTravel & WarpTravelLifecycleState;
  instance.adapterCreations = 0;
  Object.defineProperty(instance, "events", {
    value: [],
    writable: true,
    configurable: true,
  });
  instance.hasInitialized = false;
  instance.initialSetupPromise = null;
  instance.isSwitchedOff = true;

  return instance;
}

describe("runWarpTravelSetupLifecycle", () => {
  it("runs shared initial activation and marks the runtime initialized", async () => {
    const { adapter, events } = createAdapter();

    const result = await runWarpTravelSetupLifecycle(
      {
        hasInitialized: false,
        initialSetupPromise: null,
        isSwitchedOff: true,
      },
      adapter,
    );

    expect(events).toEqual([
      "setup:start",
      "setup:initial:start",
      "camera:move",
      "labels:groups:attach",
      "labels:managers:attach",
      "subscriptions:register",
      "zoom:setup",
      "scene:refresh",
      "setup:initial:complete",
    ]);
    expect(result).toEqual({
      hasInitialized: true,
      initialSetupPromise: null,
      isSwitchedOff: false,
    });
  });

  it("reruns shared activation on resume without the initial-only hook", async () => {
    const { adapter, events } = createAdapter();

    const result = await runWarpTravelSetupLifecycle(
      {
        hasInitialized: true,
        initialSetupPromise: null,
        isSwitchedOff: true,
      },
      adapter,
    );

    expect(events).toEqual([
      "setup:start",
      "setup:resume:start",
      "camera:move",
      "labels:groups:attach",
      "labels:managers:attach",
      "subscriptions:register",
      "zoom:setup",
      "scene:refresh",
      "setup:resume:complete",
    ]);
    expect(result).toEqual({
      hasInitialized: true,
      initialSetupPromise: null,
      isSwitchedOff: false,
    });
  });

  it("keeps setup green when refresh fails and reports the failed phase", async () => {
    const refreshError = new Error("refresh failed");
    const reportSetupError = vi.fn();
    const { adapter, events } = createAdapter({
      refreshScene: async () => {
        throw refreshError;
      },
      reportSetupError,
    });

    const result = await runWarpTravelSetupLifecycle(
      {
        hasInitialized: false,
        initialSetupPromise: null,
        isSwitchedOff: true,
      },
      adapter,
    );

    expect(reportSetupError).toHaveBeenCalledWith(refreshError, "initial");
    expect(events).toEqual([
      "setup:start",
      "setup:initial:start",
      "camera:move",
      "labels:groups:attach",
      "labels:managers:attach",
      "subscriptions:register",
      "zoom:setup",
      "setup:initial:complete",
    ]);
    expect(result.hasInitialized).toBe(true);
    expect(result.isSwitchedOff).toBe(false);
  });
});

describe("runWarpTravelSwitchOffLifecycle", () => {
  it("disposes shared subscriptions and detaches labels symmetrically", () => {
    const { adapter, events } = createAdapter();
    const initialState: WarpTravelLifecycleState = {
      hasInitialized: true,
      initialSetupPromise: null,
      isSwitchedOff: false,
    };

    const result = runWarpTravelSwitchOffLifecycle(initialState, adapter);

    expect(events).toEqual([
      "switchOff:start",
      "subscriptions:dispose",
      "subscriptions:afterDispose",
      "labels:groups:detach",
      "labels:managers:detach",
      "switchOff:complete",
    ]);
    expect(result).toEqual({
      hasInitialized: true,
      initialSetupPromise: null,
      isSwitchedOff: true,
    });
  });
});

describe("WarpTravel", () => {
  it("reuses one lifecycle adapter across setup and switch-off cycles", async () => {
    const runtime = createCountingWarpTravel();

    await runtime.setup();
    runtime.triggerSwitchOffLifecycle();
    await runtime.setup();

    expect(runtime.adapterCreations).toBe(1);
  });
});
