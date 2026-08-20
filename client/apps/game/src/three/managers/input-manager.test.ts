// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import type { SceneManager } from "../scene-manager";
import { SceneName } from "../types";

vi.mock("@/hooks/store/use-ui-store", () => ({
  useUIStore: {
    getState: () => ({
      setTooltip: vi.fn(),
    }),
  },
}));

const { InputManager } = await import("./input-manager");

function createSubject(currentScene: SceneName = SceneName.WorldMap) {
  const sceneManager = {
    getCurrentScene: vi.fn(() => currentScene),
  };
  const raycaster = {
    setFromCamera: vi.fn(),
  } as unknown as THREE.Raycaster;
  const mouse = new THREE.Vector2();
  const camera = new THREE.PerspectiveCamera();

  const manager = new InputManager(
    SceneName.WorldMap,
    sceneManager as unknown as SceneManager,
    raycaster,
    mouse,
    camera,
  );
  const surface = document.createElement("div");
  surface.getBoundingClientRect = () =>
    ({
      left: 100,
      top: 200,
      width: 400,
      height: 300,
    }) as DOMRect;

  return {
    manager,
    sceneManager,
    raycaster,
    mouse,
    surface,
  };
}

function installAnimationFrameHarness() {
  let nextFrameId = 1;
  const frames = new Map<number, FrameRequestCallback>();
  const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
    const frameId = nextFrameId;
    nextFrameId += 1;
    frames.set(frameId, callback);
    return frameId;
  });
  const cancelAnimationFrame = vi.fn((frameId: number) => {
    frames.delete(frameId);
  });

  vi.stubGlobal("requestAnimationFrame", requestAnimationFrame);
  vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrame);

  return {
    cancelAnimationFrame,
    flushNextFrame: () => {
      const nextFrame = frames.entries().next().value as [number, FrameRequestCallback] | undefined;
      if (!nextFrame) {
        return;
      }
      frames.delete(nextFrame[0]);
      nextFrame[1](performance.now());
    },
    requestAnimationFrame,
  };
}

describe("InputManager lifecycle", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("registers, pauses, restarts, and destroys listeners", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const surfaceAddSpy = vi.spyOn(HTMLElement.prototype, "addEventListener");
    const surfaceRemoveSpy = vi.spyOn(HTMLElement.prototype, "removeEventListener");
    const callback = vi.fn();
    const fixture = createSubject();

    fixture.manager.setSurface(fixture.surface);
    fixture.manager.activate();
    fixture.manager.addListener("click", callback);
    const clickEvent = new MouseEvent("click", { clientX: 150, clientY: 260 });
    fixture.surface.dispatchEvent(clickEvent);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(fixture.raycaster.setFromCamera).toHaveBeenCalledTimes(1);
    expect(fixture.mouse.x).toBeCloseTo(-0.75);
    expect(fixture.mouse.y).toBeCloseTo(0.6);

    fixture.manager.pauseListeners();
    fixture.surface.dispatchEvent(new MouseEvent("click", { clientX: 150, clientY: 260 }));
    expect(callback).toHaveBeenCalledTimes(1);

    fixture.manager.restartListeners();
    fixture.surface.dispatchEvent(new MouseEvent("click", { clientX: 200, clientY: 300 }));
    expect(callback).toHaveBeenCalledTimes(2);

    fixture.manager.destroy();
    fixture.surface.dispatchEvent(new MouseEvent("click", { clientX: 200, clientY: 300 }));
    expect(callback).toHaveBeenCalledTimes(2);
    expect(surfaceAddSpy).toHaveBeenCalledWith("mousedown", expect.any(Function));
    expect(surfaceAddSpy).toHaveBeenCalledWith("click", expect.any(Function));
    expect(surfaceRemoveSpy).toHaveBeenCalledWith("mousedown", expect.any(Function));
    expect(surfaceRemoveSpy).toHaveBeenCalledWith("click", expect.any(Function));
    expect(addSpy).not.toHaveBeenCalledWith("mousedown", expect.any(Function));
    expect(removeSpy).not.toHaveBeenCalledWith("mousedown", expect.any(Function));
    expect(removeSpy).not.toHaveBeenCalledWith("click", expect.any(Function));
  });

  it("processes many mousemoves once on the next frame using the latest coordinates", () => {
    const frameHarness = installAnimationFrameHarness();
    const callback = vi.fn();
    const fixture = createSubject();

    fixture.manager.setSurface(fixture.surface);
    fixture.manager.activate();
    fixture.manager.addListener("mousemove", callback);
    fixture.surface.dispatchEvent(new MouseEvent("mousemove", { clientX: 150, clientY: 250 }));
    fixture.surface.dispatchEvent(new MouseEvent("mousemove", { clientX: 250, clientY: 300 }));
    fixture.surface.dispatchEvent(new MouseEvent("mousemove", { clientX: 450, clientY: 350 }));

    expect(frameHarness.requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(callback).not.toHaveBeenCalled();
    expect(fixture.raycaster.setFromCamera).not.toHaveBeenCalled();

    frameHarness.flushNextFrame();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0]).toMatchObject({ clientX: 450, clientY: 350 });
    expect(fixture.raycaster.setFromCamera).toHaveBeenCalledTimes(1);
    expect(fixture.mouse.x).toBeCloseTo(0.75);
    expect(fixture.mouse.y).toBeCloseTo(0);
  });

  it.each(["click", "contextmenu", "dblclick"] as const)("keeps %s callbacks synchronous", (eventType) => {
    const frameHarness = installAnimationFrameHarness();
    const callback = vi.fn();
    const fixture = createSubject();

    fixture.manager.setSurface(fixture.surface);
    fixture.manager.activate();
    fixture.manager.addListener(eventType, callback);
    fixture.surface.dispatchEvent(new MouseEvent(eventType, { clientX: 150, clientY: 250 }));

    expect(callback).toHaveBeenCalledTimes(1);
    expect(fixture.raycaster.setFromCamera).toHaveBeenCalledTimes(1);
    expect(frameHarness.requestAnimationFrame).not.toHaveBeenCalled();
  });

  it("cancels pending mousemove work when deactivated before the frame", () => {
    const frameHarness = installAnimationFrameHarness();
    const callback = vi.fn();
    const fixture = createSubject();

    fixture.manager.setSurface(fixture.surface);
    fixture.manager.activate();
    fixture.manager.addListener("mousemove", callback);
    fixture.surface.dispatchEvent(new MouseEvent("mousemove", { clientX: 150, clientY: 250 }));

    fixture.manager.deactivate();
    frameHarness.flushNextFrame();

    expect(frameHarness.cancelAnimationFrame).toHaveBeenCalledTimes(1);
    expect(callback).not.toHaveBeenCalled();
    expect(fixture.raycaster.setFromCamera).not.toHaveBeenCalled();
  });

  it("cancels pending mousemove work when destroyed before the frame", () => {
    const frameHarness = installAnimationFrameHarness();
    const callback = vi.fn();
    const fixture = createSubject();

    fixture.manager.setSurface(fixture.surface);
    fixture.manager.activate();
    fixture.manager.addListener("mousemove", callback);
    fixture.surface.dispatchEvent(new MouseEvent("mousemove", { clientX: 150, clientY: 250 }));

    fixture.manager.destroy();
    frameHarness.flushNextFrame();

    expect(frameHarness.cancelAnimationFrame).toHaveBeenCalledTimes(1);
    expect(callback).not.toHaveBeenCalled();
    expect(fixture.raycaster.setFromCamera).not.toHaveBeenCalled();
  });

  it("cancels the old surface frame and reads movement from the replacement surface", () => {
    const frameHarness = installAnimationFrameHarness();
    const callback = vi.fn();
    const fixture = createSubject();
    const oldSurfaceRemoveSpy = vi.spyOn(fixture.surface, "removeEventListener");
    const replacementSurface = document.createElement("div");
    replacementSurface.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 200,
        height: 100,
      }) as DOMRect;

    fixture.manager.setSurface(fixture.surface);
    fixture.manager.activate();
    fixture.manager.addListener("mousemove", callback);
    fixture.surface.dispatchEvent(new MouseEvent("mousemove", { clientX: 150, clientY: 250 }));

    fixture.manager.setSurface(replacementSurface);
    fixture.surface.dispatchEvent(new MouseEvent("mousemove", { clientX: 450, clientY: 350 }));
    replacementSurface.dispatchEvent(new MouseEvent("mousemove", { clientX: 150, clientY: 25 }));
    frameHarness.flushNextFrame();

    expect(frameHarness.cancelAnimationFrame).toHaveBeenCalledTimes(1);
    expect(frameHarness.requestAnimationFrame).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0]).toMatchObject({ clientX: 150, clientY: 25 });
    expect(fixture.mouse.x).toBeCloseTo(0.5);
    expect(fixture.mouse.y).toBeCloseTo(0.5);
    expect(oldSurfaceRemoveSpy).toHaveBeenCalledWith("mousemove", expect.any(Function));
  });

  it("does not bind listeners before the input surface is activated", () => {
    const addSpy = vi.spyOn(HTMLElement.prototype, "addEventListener");
    const fixture = createSubject();

    fixture.manager.addListener("click", vi.fn());

    expect(addSpy).not.toHaveBeenCalledWith("click", expect.any(Function));
  });

  it("ignores callbacks when current scene does not match", () => {
    const callback = vi.fn();
    const fixture = createSubject(SceneName.Hexception);

    fixture.manager.setSurface(fixture.surface);
    fixture.manager.activate();
    fixture.manager.addListener("click", callback);
    fixture.surface.dispatchEvent(new MouseEvent("click", { clientX: 150, clientY: 260 }));

    expect(callback).not.toHaveBeenCalled();
    expect(fixture.raycaster.setFromCamera).not.toHaveBeenCalled();
  });

  it("suppresses click callback after drag threshold is exceeded", () => {
    const callback = vi.fn();
    const fixture = createSubject();

    fixture.manager.setSurface(fixture.surface);
    fixture.manager.activate();
    fixture.manager.addListener("click", callback);

    fixture.surface.dispatchEvent(new MouseEvent("mousedown", { clientX: 10, clientY: 10 }));
    window.dispatchEvent(new MouseEvent("mousemove", { clientX: 40, clientY: 40 }));
    fixture.surface.dispatchEvent(new MouseEvent("click", { clientX: 40, clientY: 40 }));

    expect(callback).not.toHaveBeenCalled();
  });

  it("is idempotent and skips duplicate destroy cleanup", () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fixture = createSubject();

    fixture.manager.setSurface(fixture.surface);
    fixture.manager.activate();
    fixture.manager.addListener("mousemove", vi.fn());

    fixture.manager.destroy();
    fixture.manager.destroy();

    const mousedownRemovals = removeSpy.mock.calls.filter((call) => String(call[0]) === "mousedown");
    expect(mousedownRemovals).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledWith("InputManager already destroyed, skipping cleanup");
  });
});
