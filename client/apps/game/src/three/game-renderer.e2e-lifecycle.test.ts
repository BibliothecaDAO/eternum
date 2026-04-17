// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SceneName } from "./types";
import { createGameRendererRuntimeHarness } from "./game-renderer.runtime-harness";

vi.mock("@bibliothecadao/eternum", () => {
  const scalar = new Proxy(
    {},
    {
      get: (_, key) => key,
    },
  );

  return new Proxy(
    {
      StructureProgress: { STAGE_1: 1, STAGE_2: 2, STAGE_3: 3 },
      FELT_CENTER: 0,
    } as Record<string, unknown>,
    {
      get: (target, prop) => (prop in target ? target[prop as string] : scalar),
      has: () => true,
    },
  );
});

vi.mock("@bibliothecadao/types", () => {
  const enumProxy = new Proxy(
    {},
    {
      get: (_, key) => key,
    },
  );

  return new Proxy(
    {
      TroopTier: { T1: "T1", T2: "T2", T3: "T3" },
      TroopType: { Knight: "Knight", Crossbowman: "Crossbowman", Paladin: "Paladin" },
      StructureType: { Realm: "Realm", Hyperstructure: "Hyperstructure", Bank: "Bank", FragmentMine: "FragmentMine" },
      ResourcesIds: { StaminaRelic1: 1, Copper: 2, ColdIron: 3 },
      BiomeType: enumProxy,
      BuildingType: enumProxy,
      RealmLevelNames: enumProxy,
      RealmLevels: enumProxy,
      ResourceMiningTypes: enumProxy,
    } as Record<string, unknown>,
    {
      get: (target, prop) => (prop in target ? target[prop as string] : enumProxy),
      has: () => true,
    },
  );
});

vi.mock("@/three/scenes/worldmap", () => ({ default: class MockWorldmapScene {} }));
vi.mock("@/three/scenes/hexception", () => ({ default: class MockHexceptionScene {} }));
vi.mock("@/three/scenes/hud-scene", () => ({ default: class MockHUDScene {} }));
vi.mock("@/three/scenes/fast-travel", () => ({ default: class MockFastTravelScene {} }));
vi.mock("../../env", () => ({
  env: {
    VITE_PUBLIC_ENABLE_MEMORY_MONITORING: false,
    VITE_PUBLIC_GRAPHICS_DEV: false,
    VITE_PUBLIC_RENDERER_BUILD_MODE: "experimental-webgpu-auto",
  },
}));
vi.mock("@/three/scenes/hexagon-scene", () => ({
  HexagonScene: class MockHexagonScene {},
  CameraView: { Close: 1, Medium: 2, Far: 3 },
}));

Object.defineProperty(navigator, "getBattery", {
  configurable: true,
  value: vi.fn(async () => ({ charging: true })),
});

Object.defineProperty(URL, "createObjectURL", {
  configurable: true,
  value: vi.fn(() => "blob:mock"),
});

vi.stubGlobal("GPUShaderStage", {
  COMPUTE: 4,
  FRAGMENT: 2,
  VERTEX: 1,
});

const { default: GameRenderer } = await import("./game-renderer");

function mountSubject() {
  const harness = createGameRendererRuntimeHarness();
  const subject = Object.assign(Object.create(GameRenderer.prototype), harness.createSubject());
  subject.animationFrameHandle = null;

  const canvasParent = document.createElement("div");
  canvasParent.appendChild(harness.backend.renderer.domElement);
  document.body.appendChild(canvasParent);

  return { harness, subject, canvasParent };
}

describe("GameRenderer E2E lifecycle", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("init → tick frames → destroy tears down cleanly with no pending RAF", async () => {
    const pendingFrames: Array<() => void> = [];
    const rafSpy = vi.fn((cb: FrameRequestCallback) => {
      pendingFrames.push(() => cb(performance.now()));
      return pendingFrames.length;
    });
    const cancelSpy = vi.fn();
    vi.stubGlobal("requestAnimationFrame", rafSpy);
    vi.stubGlobal("cancelAnimationFrame", cancelSpy);

    const { harness, subject, canvasParent } = mountSubject();
    subject.transitionManager = harness.transitionManager;

    harness.sceneManager.switchScene(SceneName.WorldMap);
    await Promise.resolve();

    subject.animate();
    expect(rafSpy).toHaveBeenCalledTimes(1);
    expect(typeof subject.animationFrameHandle).toBe("number");
    expect(harness.backend.renderFrame).toHaveBeenCalledTimes(1);

    pendingFrames.shift()!();
    expect(subject.animationFrameHandle).not.toBeNull();
    expect(harness.backend.renderFrame).toHaveBeenCalledTimes(2);

    const pendingHandleBeforeDestroy = subject.animationFrameHandle;
    expect(pendingHandleBeforeDestroy).not.toBeNull();

    subject.destroy();

    expect(subject.isDestroyed).toBe(true);
    expect(cancelSpy).toHaveBeenCalledWith(pendingHandleBeforeDestroy);
    expect(subject.animationFrameHandle).toBeNull();
    expect(harness.backend.dispose).toHaveBeenCalledTimes(1);
    expect(harness.worldmapScene.destroy).toHaveBeenCalledTimes(1);
    expect(harness.hexceptionScene.destroy).toHaveBeenCalledTimes(1);
    expect(harness.transitionManager.destroy).toHaveBeenCalledTimes(1);
    expect(canvasParent.contains(harness.backend.renderer.domElement)).toBe(false);

    const rafCallsBeforeLateFrame = rafSpy.mock.calls.length;
    const renderFramesBeforeLateFrame = harness.backend.renderFrame.mock.calls.length;

    // A stale frame that was already in flight before destroy must not re-render or schedule more work.
    pendingFrames.forEach((runFrame) => runFrame());

    expect(harness.backend.renderFrame).toHaveBeenCalledTimes(renderFramesBeforeLateFrame);
    expect(rafSpy).toHaveBeenCalledTimes(rafCallsBeforeLateFrame);
  });

  it("destroy is idempotent and cancels RAF at most once", () => {
    const rafSpy = vi.fn(() => 99);
    const cancelSpy = vi.fn();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("requestAnimationFrame", rafSpy);
    vi.stubGlobal("cancelAnimationFrame", cancelSpy);

    const { subject } = mountSubject();
    subject.animationFrameHandle = 99;

    subject.destroy();
    subject.destroy();

    expect(cancelSpy).toHaveBeenCalledTimes(1);
    expect(cancelSpy).toHaveBeenCalledWith(99);
    expect(warnSpy).toHaveBeenCalledWith("GameRenderer already destroyed, skipping cleanup");
  });
});
