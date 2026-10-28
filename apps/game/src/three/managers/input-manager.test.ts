// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { MapControls } from "three/addons/controls/MapControls.js";
import { CONTROL_CONFIG } from "../constants/rendering";
import { HEX_SIZE } from "../constants/scene-constants";
import type { SceneManager } from "../scene-manager";
import {
  resolveWorldmapCameraFieldOfViewDegrees,
  resolveWorldmapCameraPitchRadians,
} from "../scenes/worldmap-camera-view-profile";
import { groundUnderCursor, zoomTowardCursor } from "../scenes/worldmap-zoom/worldmap-zoom-anchor";
import { WorldmapZoomCoordinator } from "../scenes/worldmap-zoom/worldmap-zoom-coordinator";
import { SceneName } from "../types";

vi.mock("@/hooks/store/use-ui-store", () => ({
  useUIStore: {
    getState: () => ({
      setTooltip: vi.fn(),
    }),
  },
}));
vi.mock("@/ui/config", () => ({ IS_FLAT_MODE: false }));

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
    camera,
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

  it("tells its listeners the pointer left the surface, and drops a move still waiting for its frame", () => {
    const frameHarness = installAnimationFrameHarness();
    const moved = vi.fn();
    const left = vi.fn();
    const fixture = createSubject();

    fixture.manager.setSurface(fixture.surface);
    fixture.manager.activate();
    fixture.manager.addListener("mousemove", moved);
    fixture.manager.addListener("mouseleave", left);
    fixture.surface.dispatchEvent(new MouseEvent("mousemove", { clientX: 150, clientY: 250 }));
    fixture.surface.dispatchEvent(new MouseEvent("mouseleave", { clientX: 99, clientY: 250 }));
    frameHarness.flushNextFrame();

    expect(left).toHaveBeenCalledTimes(1);
    expect(moved).not.toHaveBeenCalled();
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

function createTouchPointerEvent(type: string, pointerId: number, clientX: number, clientY: number) {
  return new PointerEvent(type, { pointerId, pointerType: "touch", clientX, clientY, bubbles: true, cancelable: true });
}

function createMousePointerEvent(type: string, clientX: number, clientY: number) {
  return new PointerEvent(type, { pointerId: 99, pointerType: "mouse", clientX, clientY, bubbles: true });
}

describe("InputManager touch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("dispatches a touch tap as one click from the recognizer and ignores the native click", () => {
    const frameHarness = installAnimationFrameHarness();
    const clickCallback = vi.fn();
    const moveCallback = vi.fn();
    const fixture = createSubject();

    fixture.manager.setSurface(fixture.surface);
    fixture.manager.activate();
    fixture.manager.addListener("click", clickCallback);
    fixture.manager.addListener("mousemove", moveCallback);

    const down = createTouchPointerEvent("pointerdown", 1, 150, 260);
    fixture.surface.dispatchEvent(down);
    fixture.surface.dispatchEvent(createTouchPointerEvent("pointermove", 1, 152, 261));
    fixture.surface.dispatchEvent(createTouchPointerEvent("pointerup", 1, 152, 261));
    fixture.surface.dispatchEvent(new MouseEvent("click", { clientX: 152, clientY: 261 }));

    expect(down.defaultPrevented).toBe(true);
    expect(clickCallback).toHaveBeenCalledTimes(1);
    expect(clickCallback.mock.calls[0][0].pointerType).toBe("touch");
    expect(fixture.mouse.x).toBeCloseTo(-0.74);
    expect(moveCallback).not.toHaveBeenCalled();
    expect(frameHarness.requestAnimationFrame).not.toHaveBeenCalled();
  });

  it("cancels the touch's end so the browser sends no click to whatever the tap put under the finger", () => {
    const fixture = createSubject();
    fixture.manager.setSurface(fixture.surface);
    fixture.manager.activate();

    const end = new Event("touchend", { bubbles: true, cancelable: true });
    fixture.surface.dispatchEvent(end);
    expect(end.defaultPrevented).toBe(true);

    fixture.manager.pauseListeners();
    const endWhilePaused = new Event("touchend", { bubbles: true, cancelable: true });
    fixture.surface.dispatchEvent(endWhilePaused);
    expect(endWhilePaused.defaultPrevented).toBe(false);
  });

  it("dispatches a touch long press as contextmenu and does not click on release", () => {
    vi.useFakeTimers();
    const clickCallback = vi.fn();
    const contextMenuCallback = vi.fn();
    const fixture = createSubject();

    fixture.manager.setSurface(fixture.surface);
    fixture.manager.activate();
    fixture.manager.addListener("click", clickCallback);
    fixture.manager.addListener("contextmenu", contextMenuCallback);

    fixture.surface.dispatchEvent(createTouchPointerEvent("pointerdown", 1, 150, 260));
    vi.advanceTimersByTime(500);
    fixture.surface.dispatchEvent(createTouchPointerEvent("pointerup", 1, 150, 260));
    fixture.surface.dispatchEvent(new MouseEvent("click", { clientX: 150, clientY: 260 }));

    expect(contextMenuCallback).toHaveBeenCalledTimes(1);
    expect(contextMenuCallback.mock.calls[0][0].pointerType).toBe("touch");
    expect(clickCallback).not.toHaveBeenCalled();
  });

  // Owner, 28 October 2026: "double tapping the realm on mobile should bring me to the realm view !"
  it("dispatches two quick taps as two clicks and one double-click, as a mouse's two clicks are", () => {
    vi.useFakeTimers();
    const clickCallback = vi.fn();
    const doubleClickCallback = vi.fn();
    const fixture = createSubject();

    fixture.manager.setSurface(fixture.surface);
    fixture.manager.activate();
    fixture.manager.addListener("click", clickCallback);
    fixture.manager.addListener("dblclick", doubleClickCallback);

    fixture.surface.dispatchEvent(createTouchPointerEvent("pointerdown", 1, 150, 260));
    fixture.surface.dispatchEvent(createTouchPointerEvent("pointerup", 1, 150, 260));
    vi.advanceTimersByTime(100);
    fixture.surface.dispatchEvent(createTouchPointerEvent("pointerdown", 2, 155, 262));
    fixture.surface.dispatchEvent(createTouchPointerEvent("pointerup", 2, 155, 262));

    expect(clickCallback).toHaveBeenCalledTimes(2);
    expect(doubleClickCallback).toHaveBeenCalledTimes(1);
    expect(doubleClickCallback.mock.calls[0][0]).toMatchObject({ clientX: 155, clientY: 262, pointerType: "touch" });
    // A native double-click after the touch is not a second one.
    fixture.surface.dispatchEvent(new MouseEvent("dblclick", { clientX: 155, clientY: 262 }));
    expect(doubleClickCallback).toHaveBeenCalledTimes(1);
  });

  // Review realm-double-tap-1: a pan between two taps moves the map and leaves no double-click behind.
  it("dispatches tap, pan, tap as two clicks and the pan, never a double-click", () => {
    vi.useFakeTimers();
    const clickCallback = vi.fn();
    const doubleClickCallback = vi.fn();
    const navigation = { begin: vi.fn(), move: vi.fn(), end: vi.fn() };
    const fixture = createSubject();
    const manager = new InputManager(
      SceneName.WorldMap,
      fixture.sceneManager as unknown as SceneManager,
      fixture.raycaster,
      fixture.mouse,
      fixture.camera,
      navigation as never,
    );
    manager.setSurface(fixture.surface);
    manager.activate();
    manager.addListener("click", clickCallback);
    manager.addListener("dblclick", doubleClickCallback);

    const touch = (type: string, id: number, x: number) =>
      fixture.surface.dispatchEvent(createTouchPointerEvent(type, id, x, 260));
    touch("pointerdown", 1, 150);
    touch("pointerup", 1, 150);
    vi.advanceTimersByTime(80);
    touch("pointerdown", 2, 150);
    touch("pointermove", 2, 200);
    touch("pointerup", 2, 200);
    vi.advanceTimersByTime(80);
    touch("pointerdown", 3, 150);
    touch("pointerup", 3, 150);

    expect(clickCallback).toHaveBeenCalledTimes(2);
    expect(navigation.move).toHaveBeenCalled();
    expect(doubleClickCallback).not.toHaveBeenCalled();
    manager.destroy();
  });

  it("returns to the native mouse path once a mouse pointer is seen again", () => {
    const clickCallback = vi.fn();
    const fixture = createSubject();

    fixture.manager.setSurface(fixture.surface);
    fixture.manager.activate();
    fixture.manager.addListener("click", clickCallback);

    fixture.surface.dispatchEvent(createTouchPointerEvent("pointerdown", 1, 150, 260));
    fixture.surface.dispatchEvent(createTouchPointerEvent("pointerup", 1, 150, 260));
    fixture.surface.dispatchEvent(createMousePointerEvent("pointerdown", 150, 260));
    fixture.surface.dispatchEvent(new MouseEvent("click", { clientX: 150, clientY: 260 }));

    expect(clickCallback).toHaveBeenCalledTimes(2);
    expect(clickCallback.mock.calls[1][0]).toBeInstanceOf(MouseEvent);
  });

  it("stops a pending long press when listeners are paused", () => {
    vi.useFakeTimers();
    const contextMenuCallback = vi.fn();
    const fixture = createSubject();

    fixture.manager.setSurface(fixture.surface);
    fixture.manager.activate();
    fixture.manager.addListener("contextmenu", contextMenuCallback);

    fixture.surface.dispatchEvent(createTouchPointerEvent("pointerdown", 1, 150, 260));
    fixture.manager.deactivate();
    vi.advanceTimersByTime(500);

    expect(contextMenuCallback).not.toHaveBeenCalled();
  });

  it.each(["drag", "pinch", "pointercancel", "lostpointercapture", "blur", "hidden"])(
    "cancels a held order on %s",
    (interruption) => {
      vi.useFakeTimers();
      const fixture = createSubject();
      const order = vi.fn();
      const select = vi.fn();
      fixture.manager.setSurface(fixture.surface);
      fixture.manager.activate();
      fixture.manager.addListener("contextmenu", order);
      fixture.manager.addListener("click", select);
      fixture.surface.dispatchEvent(createTouchPointerEvent("pointerdown", 1, 150, 260));
      vi.advanceTimersByTime(250);
      if (interruption === "drag") fixture.surface.dispatchEvent(createTouchPointerEvent("pointermove", 1, 180, 260));
      else if (interruption === "pinch")
        fixture.surface.dispatchEvent(createTouchPointerEvent("pointerdown", 2, 200, 260));
      else if (interruption === "blur") window.dispatchEvent(new Event("blur"));
      else if (interruption === "hidden") {
        vi.spyOn(document, "hidden", "get").mockReturnValue(true);
        document.dispatchEvent(new Event("visibilitychange"));
      } else fixture.surface.dispatchEvent(createTouchPointerEvent(interruption, 1, 150, 260));
      vi.advanceTimersByTime(500);
      fixture.surface.dispatchEvent(createTouchPointerEvent("pointerup", 1, interruption === "drag" ? 180 : 150, 260));
      fixture.surface.dispatchEvent(new MouseEvent("click", { clientX: 150, clientY: 260 }));
      expect(order).not.toHaveBeenCalled();
      expect(select).not.toHaveBeenCalled();
      fixture.manager.destroy();
    },
  );

  it("commits at the held position after 500ms, even with small finger drift, and suppresses Android's native menu", () => {
    vi.useFakeTimers();
    const fixture = createSubject();
    const order = vi.fn();
    fixture.manager.setSurface(fixture.surface);
    fixture.manager.activate();
    fixture.manager.addListener("contextmenu", order);
    fixture.surface.dispatchEvent(createTouchPointerEvent("pointerdown", 1, 150, 260));
    fixture.surface.dispatchEvent(createTouchPointerEvent("pointermove", 1, 156, 263));
    vi.advanceTimersByTime(499);
    expect(order).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(order).toHaveBeenCalledTimes(1);
    expect(order.mock.calls[0][0]).toMatchObject({ clientX: 150, clientY: 260, pointerType: "touch" });
    const nativeMenu = new MouseEvent("contextmenu", { cancelable: true });
    fixture.surface.dispatchEvent(nativeMenu);
    expect(nativeMenu.defaultPrevented).toBe(true);
    expect(order).toHaveBeenCalledTimes(1);
    fixture.manager.destroy();
  });
});

/**
 * The world map as a player drives it: its MapControls with the game's damping, its wheel zoom easing the distance,
 * both stepped once per animation frame as the renderer does.
 */
function createWorldMap() {
  const camera = new THREE.PerspectiveCamera(resolveWorldmapCameraFieldOfViewDegrees(), 1440 / 900, 0.1, 200);
  const surface = document.createElement("div");
  Object.defineProperty(surface, "clientWidth", { value: 1440 });
  Object.defineProperty(surface, "clientHeight", { value: 900 });
  surface.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1440, height: 900 }) as DOMRect;
  surface.setPointerCapture = vi.fn();
  surface.releasePointerCapture = vi.fn();
  document.body.append(surface);

  const controls = new MapControls(camera, surface);
  controls.enableRotate = CONTROL_CONFIG.enableRotate;
  controls.enableDamping = CONTROL_CONFIG.enableDamping;
  controls.dampingFactor = CONTROL_CONFIG.dampingFactor;
  controls.panSpeed = CONTROL_CONFIG.panSpeed;
  const placeAt = (distance: number) => {
    const pitch = resolveWorldmapCameraPitchRadians(distance);
    const target = controls.target;
    camera.position.set(target.x, target.y + Math.sin(pitch) * distance, target.z + Math.cos(pitch) * distance);
  };
  placeAt(20);
  controls.update();
  const zoom = new WorldmapZoomCoordinator({ initialDistance: 20, minDistance: 10, maxDistance: 40 });
  let zoomCursor: THREE.Vector2 | null = null;

  const manager = new InputManager(
    SceneName.WorldMap,
    { getCurrentScene: () => SceneName.WorldMap } as unknown as SceneManager,
    new THREE.Raycaster(),
    new THREE.Vector2(),
    camera,
  );
  manager.setSurface(surface);
  manager.activate();
  const clicked = vi.fn();
  manager.addListener("click", clicked);

  const frames = (count: number) => {
    for (let frame = 0; frame < count; frame += 1) {
      controls.update();
      const zoomFrame = zoom.tick({
        actualDistance: camera.position.distanceTo(controls.target),
        deltaMs: 1000 / 60,
        nowMs: 0,
      });
      if (zoomFrame.didMove) {
        zoomTowardCursor(camera, controls.target, zoomCursor, () => placeAt(zoomFrame.snapshot.actualDistance));
      }
    }
  };
  // What the browser sends for the left button: the pointer event, then its mouse event.
  const send = (target: EventTarget, pointer: string, mouse: string, x: number, y: number) => {
    const init = { clientX: x, clientY: y, button: 0, buttons: 1, bubbles: true };
    target.dispatchEvent(new PointerEvent(pointer, { ...init, pointerId: 1, pointerType: "mouse" }));
    target.dispatchEvent(new MouseEvent(mouse, init));
  };
  const press = (x: number, y: number) => send(surface, "pointerdown", "mousedown", x, y);
  const moveTo = (x: number, y: number) => send(document, "pointermove", "mousemove", x, y);
  const release = (x: number, y: number) => {
    send(document, "pointerup", "mouseup", x, y);
    surface.dispatchEvent(new MouseEvent("click", { clientX: x, clientY: y, button: 0, bubbles: true }));
  };
  /** A drag from (x, y) by (dx, dy), about two pixels a frame. */
  const drag = (x: number, y: number, dx: number, dy: number) => {
    press(x, y);
    const steps = Math.max(Math.abs(dx), Math.abs(dy)) / 2;
    for (let step = 1; step <= steps; step += 1) {
      moveTo(x + (dx * step) / steps, y + (dy * step) / steps);
      frames(1);
    }
    release(x + dx, y + dy);
  };
  /** The wheel turned in at (x, y): the zoom eases toward the closest distance over the next frames. */
  const wheelIn = (x: number, y: number) => {
    zoomCursor = new THREE.Vector2((x / 1440) * 2 - 1, -(y / 900) * 2 + 1);
    zoom.applyIntent({ type: "snap_to_distance", distance: 10 });
  };

  /** The ground under a screen point, where the camera stands now. */
  const groundAt = (x: number, y: number) =>
    groundUnderCursor(camera, controls.target, new THREE.Vector2((x / 1440) * 2 - 1, -(y / 900) * 2 + 1))!;

  return {
    camera,
    clicked,
    frames,
    groundAt,
    press,
    moveTo,
    release,
    drag,
    wheelIn,
    destroy: () => {
      manager.destroy();
      controls.dispose();
      surface.remove();
    },
  };
}

describe("InputManager on the world map's damped, easing camera", () => {
  it.each([1, 3, 5, 9])("takes a press %i s after a pan for a click, while the pan still drifts", (seconds) => {
    const map = createWorldMap();
    map.drag(400, 400, 200, 0);
    expect(map.clicked).not.toHaveBeenCalled();

    map.frames(seconds * 60);
    const drifting = map.camera.position.clone();
    map.frames(1);
    expect(map.camera.position.equals(drifting)).toBe(false);

    // A 100 ms press whose hand trembles by a pixel: the map controls follow the pointer by that pixel.
    map.press(700, 500);
    map.frames(3);
    map.moveTo(701, 500);
    map.frames(3);
    map.release(701, 500);

    expect(map.clicked).toHaveBeenCalledTimes(1);
    map.destroy();
  });

  it("takes a still press for a click while the wheel's zoom still eases", () => {
    const map = createWorldMap();
    map.wheelIn(900, 300);
    map.frames(6);

    const cameraAtPress = map.camera.position.clone();
    map.press(900, 300);
    map.frames(6); // a 100 ms press, the mouse held still
    map.release(900, 300);

    expect(map.camera.position.distanceTo(cameraAtPress)).toBeGreaterThan(0.1);
    expect(map.clicked).toHaveBeenCalledTimes(1);
    map.destroy();
  });

  it.each([4, 6, 8])(
    "selects the tile a press went down on in one click, though the hand travels %i px, and holds the map still",
    (travel) => {
      const map = createWorldMap();
      const pressedGround = map.groundAt(900, 500);
      const before = map.camera.position.clone();

      // A player's press: the button goes down, the hand drifts over two frames, the button comes up.
      map.press(900, 500);
      map.frames(2);
      map.moveTo(900 + travel / 2, 500);
      map.frames(2);
      map.moveTo(900 + travel, 500);
      map.frames(2);
      map.release(900 + travel, 500);
      map.frames(30);

      expect(map.clicked).toHaveBeenCalledTimes(1);
      expect(map.camera.position.distanceTo(before)).toBe(0);
      // The click picks the ground the press went down on: the tile the player pressed.
      const [, raycaster] = map.clicked.mock.calls[0] as [MouseEvent, THREE.Raycaster];
      const picked = raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3())!;
      expect(picked.distanceTo(pressedGround)).toBeLessThan(HEX_SIZE / 2);
      map.destroy();
    },
  );

  it("takes a six-pixel drag that pans the map for a pan, not a click", () => {
    const map = createWorldMap();
    const before = map.camera.position.clone();
    map.drag(400, 400, 6, 6);
    map.frames(60);

    expect(map.camera.position.distanceTo(before)).toBeGreaterThan(0.01);
    expect(map.clicked).not.toHaveBeenCalled();
    map.destroy();
  });
});
