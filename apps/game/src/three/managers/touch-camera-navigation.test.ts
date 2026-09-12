// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { PerspectiveCamera, Plane, Raycaster, Vector2, Vector3 } from "three";
import { MapControls } from "three/addons/controls/MapControls.js";
import type { SceneManager } from "../scene-manager";
import { SceneName } from "../types";
import { resolveWorldmapCameraPitchRadians, WORLDMAP_CAMERA_ZOOM } from "../scenes/worldmap-camera-view-profile";
import { WorldmapZoomCoordinator } from "../scenes/worldmap-zoom/worldmap-zoom-coordinator";
import { InputManager } from "./input-manager";
import { TouchCameraNavigation } from "./touch-camera-navigation";

const cleanups: Array<() => void> = [];
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function createMap() {
  const surface = document.createElement("canvas");
  document.body.append(surface);
  surface.getBoundingClientRect = () => ({ left: 20, top: 30, width: 400, height: 800 }) as DOMRect;
  Object.defineProperties(surface, { clientWidth: { value: 400 }, clientHeight: { value: 800 } });
  const captured = new Set<number>();
  surface.setPointerCapture = (id) => {
    captured.add(id);
  };
  surface.hasPointerCapture = (id) => captured.has(id);
  surface.releasePointerCapture = (id) => {
    captured.delete(id);
    surface.dispatchEvent(new PointerEvent("lostpointercapture", { pointerType: "touch", pointerId: id }));
  };
  const camera = new PerspectiveCamera(38, 0.5, 0.1, 1000);
  const controls = new MapControls(camera, surface);
  controls.enableRotate = false;
  controls.enableZoom = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.panSpeed = 2;
  controls.minDistance = WORLDMAP_CAMERA_ZOOM.minDistance;
  controls.maxDistance = WORLDMAP_CAMERA_ZOOM.maxDistance;
  const place = (distance: number) => {
    const pitch = resolveWorldmapCameraPitchRadians(distance);
    camera.position.copy(controls.target).add(new Vector3(0, Math.sin(pitch) * distance, Math.cos(pitch) * distance));
  };
  place(20);
  controls.update();
  const coordinator = new WorldmapZoomCoordinator({ initialDistance: 20, ...WORLDMAP_CAMERA_ZOOM });
  const navigation = new TouchCameraNavigation(controls, {
    begin: () => {
      coordinator.beginDirectManipulation(camera.position.distanceTo(controls.target));
    },
    zoom: (distance) => {
      place(coordinator.applyDirectDistance(distance).actualDistance);
    },
    end: () => coordinator.endDirectManipulation(),
    changed: () => {
      controls.update();
    },
  });
  const manager = new InputManager(
    SceneName.WorldMap,
    { getCurrentScene: () => SceneName.WorldMap } as SceneManager,
    new Raycaster(),
    new Vector2(),
    camera,
    navigation,
  );
  manager.setSurface(surface);
  manager.activate();
  const click = vi.fn();
  const order = vi.fn();
  manager.addListener("click", click);
  manager.addListener("contextmenu", order);
  const send = (type: string, id: number, x: number, y = 400) =>
    surface.dispatchEvent(
      new PointerEvent(type, {
        pointerId: id,
        pointerType: "touch",
        clientX: x,
        clientY: y,
        bubbles: true,
        cancelable: true,
      }),
    );
  const distance = () => camera.position.distanceTo(controls.target);
  const groundPoint = (x: number, y = 400) => {
    camera.updateMatrixWorld();
    const raycaster = new Raycaster();
    raycaster.setFromCamera(new Vector2((x - 20) / 200 - 1, -(y - 30) / 400 + 1), camera);
    return raycaster.ray.intersectPlane(new Plane(new Vector3(0, 1, 0), 0), new Vector3())!;
  };
  cleanups.push(() => {
    manager.destroy();
    controls.dispose();
    surface.remove();
  });
  return { surface, controls, camera, coordinator, manager, captured, send, distance, groundPoint, click, order };
}

describe("touch navigation with real MapControls and scene input", () => {
  it("pans with one finger without zoom, selects neither on drag nor release, and stops immediately", () => {
    const map = createMap();
    map.send("pointerdown", 1, 120);
    map.send("pointermove", 1, 140);
    const anchor = map.groundPoint(140);
    map.send("pointermove", 1, 180);
    expect(map.groundPoint(180).distanceTo(anchor)).toBeLessThan(1e-8);
    expect(map.distance()).toBeCloseTo(20);
    map.send("pointerup", 1, 180);
    const position = map.camera.position.clone();
    for (let i = 0; i < 60; i++) map.controls.update();
    expect(map.camera.position.distanceTo(position)).toBeLessThan(1e-8);
    expect(map.click).not.toHaveBeenCalled();
    expect(map.order).not.toHaveBeenCalled();
    expect(map.captured.size).toBe(0);
    expect(map.controls.enableDamping).toBe(true);
  });

  it("rebaselines 1 → 2 → 1 without a camera jump or a leftover zoom", () => {
    const map = createMap();
    map.send("pointerdown", 1, 120);
    map.send("pointermove", 1, 140);
    const before = map.camera.position.clone();
    map.send("pointerdown", 2, 300);
    expect(map.camera.position.distanceTo(before)).toBeLessThan(1e-8);
    const anchor = map.groundPoint(220);
    map.send("pointermove", 2, 301);
    expect(map.distance()).toBeCloseTo((20 * 160) / 161);
    expect(map.groundPoint(220.5).distanceTo(anchor)).toBeLessThan(1e-8);
    expect(map.camera.position.distanceTo(before)).toBeLessThan(0.2);
    map.send("pointerup", 2, 301);
    const pinchDistance = map.distance();
    const panAnchor = map.groundPoint(140);
    map.send("pointermove", 1, 170);
    expect(map.distance()).toBeCloseTo(pinchDistance);
    expect(map.groundPoint(170).distanceTo(panAnchor)).toBeLessThan(1e-8);
    map.send("pointerup", 1, 170);
    expect(map.click).not.toHaveBeenCalled();
  });

  it("anchors an off-centre pinch while changing pitch and clamps both zoom limits", () => {
    const map = createMap();
    map.send("pointerdown", 1, 80, 240);
    map.send("pointerdown", 2, 180, 240);
    const anchor = map.groundPoint(130, 240);
    map.send("pointermove", 2, 280, 240);
    expect(map.distance()).toBeCloseTo(10);
    expect(map.groundPoint(180, 240).distanceTo(anchor)).toBeLessThan(1e-8);
    expect(Math.asin((map.camera.position.y - map.controls.target.y) / map.distance())).toBeCloseTo(
      resolveWorldmapCameraPitchRadians(10),
    );
    map.send("pointermove", 2, 380, 240);
    expect(map.distance()).toBeCloseTo(10);
    map.send("pointermove", 2, 81, 240);
    expect(map.distance()).toBeCloseTo(45);
  });

  it.each(["pointercancel", "lostpointercapture", "blur", "hidden", "deactivate", "surface"])(
    "cancels all pointers on %s and lets a new finger pan without zoom",
    (interruption) => {
      const map = createMap();
      map.send("pointerdown", 1, 100);
      map.send("pointerdown", 2, 200);
      if (interruption === "blur") window.dispatchEvent(new Event("blur"));
      else if (interruption === "hidden") {
        vi.spyOn(document, "hidden", "get").mockReturnValue(true);
        document.dispatchEvent(new Event("visibilitychange"));
      } else if (interruption === "deactivate") {
        map.manager.deactivate();
        map.manager.activate();
      } else if (interruption === "surface") {
        map.manager.setSurface(document.createElement("canvas"));
        map.manager.setSurface(map.surface);
      } else map.send(interruption, 1, 100);
      expect(map.captured.size).toBe(0);
      map.send("pointerdown", 3, 120);
      map.send("pointermove", 3, 160);
      expect(map.distance()).toBeCloseTo(20);
      map.send("pointerup", 3, 160);
      expect(map.click).not.toHaveBeenCalled();
      expect(map.order).not.toHaveBeenCalled();
    },
  );

  it("keeps finger jitter still for taps and holds, and suppresses a release after a held order", () => {
    vi.useFakeTimers();
    const map = createMap();
    const before = map.camera.position.clone();
    map.send("pointerdown", 1, 120);
    map.send("pointermove", 1, 126);
    map.send("pointerup", 1, 126);
    expect(map.click).toHaveBeenCalledTimes(1);
    expect(map.camera.position.distanceTo(before)).toBeLessThan(1e-8);
    map.send("pointerdown", 2, 120);
    vi.advanceTimersByTime(500);
    map.send("pointermove", 2, 180);
    map.send("pointerup", 2, 180);
    expect(map.order).toHaveBeenCalledTimes(1);
    expect(map.click).toHaveBeenCalledTimes(1);
    expect(map.camera.position.distanceTo(before)).toBeLessThan(1e-8);
  });
});
