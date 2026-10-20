import { act, Profiler } from "react";
import { createRoot, type Root } from "react-dom/client";
import { PerspectiveCamera, Vector3 } from "three";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import type { MinimapTile } from "./hex-minimap";

// The minimap's markers and the game's synchronized configuration are not this test's business.
vi.mock("@/hooks/use-fact-view", () => ({ useFactView: () => new Map() }));
vi.mock("@/ui/config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/ui/config")>()),
  FELT_CENTER: () => 0,
}));

/** Each test meets a world map that has not drawn yet: fresh modules, so no camera view is left from another. */
let HexMinimap: typeof import("./hex-minimap").HexMinimap;
let publishCameraView: typeof import("@/three/scenes/worldmap-camera-view").publishCameraView;
let setWorldOrigin: typeof import("@/three/world-origin").setWorldOrigin;
let host: HTMLDivElement;
let root: Root;
let commits: number;

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.resetModules();
  ({ HexMinimap } = await import("./hex-minimap"));
  ({ publishCameraView } = await import("@/three/scenes/worldmap-camera-view"));
  ({ setWorldOrigin } = await import("@/three/world-origin"));
  commits = 0;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

const show = (tiles: MinimapTile[], look: "badges" | "classic" = "badges") =>
  act(async () =>
    root.render(
      <Profiler id="minimap" onRender={() => commits++}>
        <HexMinimap tiles={tiles} selectedHex={null} navigationTarget={null} cameraTargetHex={null} look={look} />
      </Profiler>,
    ),
  );

/** The world map's camera as it stands: a 38 degree view looking down at 49 degrees on `target`, `distance` away. */
const PITCH = (49 * Math.PI) / 180;
const HALF_FOV = (19 * Math.PI) / 180;
const camera = new PerspectiveCamera(38, 16 / 9, 0.1, 1000);
const look = (distance: number, target = { x: 0, z: 9 }) => {
  camera.position.set(target.x, distance * Math.sin(PITCH), target.z + distance * Math.cos(PITCH));
  camera.lookAt(new Vector3(target.x, 0, target.z));
  camera.updateProjectionMatrix();
  publishCameraView(camera, target);
};

const svg = () => host.querySelector("svg")!;
const shown = () => {
  const [minX, minY, width, height] = svg().getAttribute("viewBox")!.split(" ").map(Number);
  return { x: minX + width / 2, y: minY + height / 2, width, height };
};
/** The view marker's corners (top left, then clockwise), in minimap pixels, and how wide it stands. */
const marker = () => {
  const polygon = svg().querySelector("g[pointer-events='none'] polygon")!;
  const corners = (polygon.getAttribute("points") ?? "").split(" ").map((pair) => pair.split(",").map(Number));
  const xs = corners.map(([x]) => x);
  return { corners, width: Math.max(...xs) - Math.min(...xs), shown: polygon.getAttribute("display") !== "none" };
};

const revealed = (cols: number[], row = 0): MinimapTile[] => cols.map((col) => ({ col, row, biome: 11 }));
const EXPLORED = revealed([-6, -4, -2, 0, 2, 4, 6]);

it("draws what the camera sees, the moment the camera tells it, at its true size", async () => {
  await show(EXPLORED);
  expect(marker().shown).toBe(false);

  look(20);
  // No frame and no render in between: the camera's own change has drawn it. The screen's top edge meets the ground
  // along the ray 30 degrees under the horizon, its bottom edge along the one 68 degrees under it: 7 pixels a unit.
  const seen = marker();
  const height = 20 * Math.sin(PITCH);
  const cameraZ = 9 + 20 * Math.cos(PITCH);
  expect(seen.shown).toBe(true);
  expect(seen.corners[0][1] / 7).toBeCloseTo(cameraZ - height / Math.tan(PITCH - HALF_FOV), 2);
  expect(seen.corners[3][1] / 7).toBeCloseTo(cameraZ - height / Math.tan(PITCH + HALF_FOV), 2);

  const commitsBefore = commits;
  look(16);
  // Closer, the view marker narrows in the same call, and the tiles were not drawn again for it.
  expect(marker().width).toBeLessThan(seen.width);
  expect(commits).toBe(commitsBefore);
});

it("frames more of the world than the camera sees, and holds at its closest while the camera comes closer", async () => {
  await show(EXPLORED);
  look(30);
  const far = { shown: shown(), marker: marker() };
  // Centred on the view, which it shows whole inside a wider frame.
  expect(far.shown.width).toBeGreaterThan(far.marker.width * 1.15);
  expect(far.shown.x).toBeCloseTo(
    (Math.max(...far.marker.corners.map(([x]) => x)) + Math.min(...far.marker.corners.map(([x]) => x))) / 2,
    3,
  );
  look(20);
  expect(shown().width).toBeLessThan(far.shown.width);

  // Close in, the frame stops narrowing at its closest; the marker keeps shrinking with the camera.
  look(3);
  const close = { shown: shown(), marker: marker() };
  look(2);
  expect(shown().width).toBe(close.shown.width);
  expect(marker().width).toBeLessThan(close.marker.width);
});

it("places the view and the tiles about the same origin when the world origin moves", async () => {
  await show(revealed([64, 66]));
  setWorldOrigin({ col: 64, row: 0 });
  // A new origin rebuilds where the tiles stand: one render, as a jump across the map is one.
  await act(async () => look(10, { x: 0, z: 0 }));
  // The tile at column 64 is now drawn about the origin, where the camera looks.
  const tiles = [...svg().querySelectorAll("g:not([pointer-events]) > polygon")];
  const near = tiles.filter((polygon) =>
    polygon
      .getAttribute("points")!
      .split(" ")
      .every((pair) => Math.abs(Number(pair.split(",")[0])) < 10),
  );
  expect([tiles.length, near.length]).toEqual([2, 1]);
  expect(Math.abs(shown().x)).toBeLessThan(10);
});

it("keeps the camera's framing when remote terrain is revealed", async () => {
  await show(EXPLORED);
  look(12);
  const before = shown();
  await show([...EXPLORED, ...revealed([-400, 400])]);
  expect(shown()).toEqual(before);
});

it("moves the camera's target with a drag, and the minimap follows the camera", async () => {
  // The fresh modules' configuration: the minimap names positions through it.
  const { configManager } = await import("@bibliothecadao/eternum");
  vi.spyOn(configManager, "getMapCenter").mockReturnValue(0);
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => frames.push(callback));
  const moves: { x: number; y: number }[] = [];
  const listen = (event: Event) => moves.push((event as CustomEvent).detail.getNormalized());
  window.addEventListener("minimapCameraMove", listen);
  try {
    await show(EXPLORED, "classic");
    look(12, { x: 0, z: 0 });
    const target = svg();
    target.setPointerCapture = () => {};
    target.releasePointerCapture = () => {};
    await act(async () => {
      for (const [type, x] of [
        ["pointerdown", 100],
        ["pointermove", 20],
        ["pointerup", 20],
      ] as const) {
        const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: 100 });
        Object.defineProperty(event, "pointerId", { value: 1 });
        target.dispatchEvent(event);
      }
    });
    await act(async () => frames.splice(0).forEach((callback) => callback(0)));
    // Dragged left, the camera is asked to look further east.
    expect(moves).toHaveLength(1);
    expect(moves[0].x).toBeGreaterThan(0);
  } finally {
    window.removeEventListener("minimapCameraMove", listen);
    vi.unstubAllGlobals();
  }
});
