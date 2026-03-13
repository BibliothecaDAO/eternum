// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
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

  const manager = new InputManager(SceneName.WorldMap, sceneManager as any, raycaster, mouse, camera);
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

describe("InputManager lifecycle", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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
