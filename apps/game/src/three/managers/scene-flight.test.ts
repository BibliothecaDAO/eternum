// @vitest-environment jsdom
import { Vector3 } from "three";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { HexagonScene } from "../scenes/hexagon-scene";
import { SceneName } from "../types";
import { SceneFlight, canFlyBetweenScenes } from "./scene-flight";

function scene() {
  const camera = { position: new Vector3(0, 20, 20) };
  const cancel = vi.fn();
  return {
    getCamera: () => camera,
    getCameraTargetPosition: () => new Vector3(),
    getLocationCoordinates: () => ({ x: 10, z: 20 }),
    cameraAnimate: vi.fn(() => cancel),
    moveCameraToXYZ: vi.fn(),
    cancel,
  };
}
beforeEach(() => {
  vi.useFakeTimers();
  const canvas = document.createElement("canvas");
  canvas.id = "main-canvas";
  document.body.append(canvas);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn() } as never);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

it("uses camera flights only between world and realm, respecting reduced motion", () => {
  expect(canFlyBetweenScenes(SceneName.WorldMap, SceneName.Hexception, false)).toBe(true);
  expect(canFlyBetweenScenes(SceneName.Hexception, SceneName.WorldMap, false)).toBe(true);
  expect(canFlyBetweenScenes(SceneName.WorldMap, SceneName.Hexception, true)).toBe(false);
  expect(canFlyBetweenScenes(undefined, SceneName.WorldMap, false)).toBe(false);
  expect(canFlyBetweenScenes(SceneName.WorldMap, SceneName.FastTravel, false)).toBe(false);
});
it("holds the outgoing frame through setup, then crossfades as the incoming camera settles", async () => {
  const outgoing = scene();
  const incoming = scene();
  const flight = new SceneFlight(outgoing as unknown as HexagonScene, SceneName.Hexception);
  const completion = flight.flyOut();
  expect(outgoing.cameraAnimate).toHaveBeenCalledWith(expect.any(Vector3), new Vector3(10, 0, 20), 0.45);
  await vi.advanceTimersByTimeAsync(500);
  await expect(completion).resolves.toBe(true);
  expect(document.querySelector('[data-scene-transition="frame"]')).not.toBeNull();
  expect(outgoing.cancel).toHaveBeenCalledOnce();
  flight.reveal(incoming as unknown as HexagonScene);
  expect(incoming.cameraAnimate).toHaveBeenCalledWith(new Vector3(0, 20, 20), new Vector3(), 0.3);
  await vi.advanceTimersByTimeAsync(200);
  expect(document.querySelector('[data-scene-transition="frame"]')).toBeNull();
});
it("cancels an interrupted flight and removes its timer without touching a destroyed scene", async () => {
  const outgoing = scene();
  const flight = new SceneFlight(outgoing as unknown as HexagonScene, SceneName.Hexception);
  const completion = flight.flyOut();
  flight.destroy();
  await expect(completion).resolves.toBe(false);
  expect(outgoing.cancel).toHaveBeenCalledOnce();
  expect(outgoing.moveCameraToXYZ).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});
