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

  return {
    manager,
    sceneManager,
    raycaster,
    mouse,
  };
}

describe("InputManager lifecycle", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("registers, pauses, restarts, and destroys listeners", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const callback = vi.fn();
    const fixture = createSubject();

    fixture.manager.addListener("click", callback);
    const clickEvent = new MouseEvent("click", { clientX: 10, clientY: 20 });
    window.dispatchEvent(clickEvent);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(fixture.raycaster.setFromCamera).toHaveBeenCalledTimes(1);

    fixture.manager.pauseListeners();
    window.dispatchEvent(new MouseEvent("click", { clientX: 10, clientY: 20 }));
    expect(callback).toHaveBeenCalledTimes(1);

    fixture.manager.restartListeners();
    window.dispatchEvent(new MouseEvent("click", { clientX: 15, clientY: 25 }));
    expect(callback).toHaveBeenCalledTimes(2);

    fixture.manager.destroy();
    window.dispatchEvent(new MouseEvent("click", { clientX: 20, clientY: 30 }));
    expect(callback).toHaveBeenCalledTimes(2);
    expect(addSpy).toHaveBeenCalledWith("mousedown", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("mousedown", expect.any(Function));
  });

  it("ignores callbacks when current scene does not match", () => {
    const callback = vi.fn();
    const fixture = createSubject(SceneName.Hexception);

    fixture.manager.addListener("click", callback);
    window.dispatchEvent(new MouseEvent("click", { clientX: 5, clientY: 6 }));

    expect(callback).not.toHaveBeenCalled();
    expect(fixture.raycaster.setFromCamera).not.toHaveBeenCalled();
  });

  it("suppresses click callback after drag threshold is exceeded", () => {
    const callback = vi.fn();
    const fixture = createSubject();

    fixture.manager.addListener("click", callback);

    window.dispatchEvent(new MouseEvent("mousedown", { clientX: 10, clientY: 10 }));
    window.dispatchEvent(new MouseEvent("mousemove", { clientX: 40, clientY: 40 }));
    window.dispatchEvent(new MouseEvent("click", { clientX: 40, clientY: 40 }));

    expect(callback).not.toHaveBeenCalled();
  });

  it("is idempotent and skips duplicate destroy cleanup", () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fixture = createSubject();

    fixture.manager.addListener("mousemove", vi.fn());

    fixture.manager.destroy();
    fixture.manager.destroy();

    const mousedownRemovals = removeSpy.mock.calls.filter((call) => call[0] === "mousedown");
    expect(mousedownRemovals).toHaveLength(1);
    expect(warnSpy).toHaveBeenCalledWith("InputManager already destroyed, skipping cleanup");
  });
});
