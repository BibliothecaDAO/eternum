import { act, Profiler } from "react";
import { createRoot, type Root } from "react-dom/client";
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
let forgetCameraView: typeof import("@/three/scenes/worldmap-camera-view").forgetCameraView;
let setWorldOrigin: typeof import("@/three/world-origin").setWorldOrigin;
let host: HTMLDivElement;
let root: Root;
let commits: number;

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.resetModules();
  ({ HexMinimap } = await import("./hex-minimap"));
  ({ publishCameraView, forgetCameraView } = await import("@/three/scenes/worldmap-camera-view"));
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

/** The world map's camera looking at `target` from `distance` away, as its controls tell it. */
const look = (target = { x: 0, z: 9 }, distance = 20) => publishCameraView(target, distance);

const svg = () => host.querySelector("svg")!;
const shown = () => {
  const [minX, minY, width, height] = svg().getAttribute("viewBox")!.split(" ").map(Number);
  return { x: minX + width / 2, y: minY + height / 2, width, height };
};

const revealed = (cols: number[], row = 0): MinimapTile[] => cols.map((col) => ({ col, row, biome: 11 }));
const EXPLORED = revealed([-6, -4, -2, 0, 2, 4, 6]);

it("frames the point the camera looks at and zooms with it, the moment the camera tells it, with only tiles drawn", async () => {
  await show(EXPLORED);
  look({ x: 4, z: 9 }, 20);
  // 7 minimap pixels a unit; a 320 px minimap at the badges' scale, 1.4 x 20 / distance x 1.75: 2.45 at the default.
  expect(shown()).toEqual({ x: 28, y: 63, width: 320 / 2.45, height: 320 / 2.45 });

  const commitsBefore = commits;
  // Drawn back to the farthest, it shows more ground; close in, it holds at its closest (3.5). Each in the same call.
  look({ x: 6, z: 7 }, 45);
  expect([shown().x, shown().y, shown().width]).toEqual([42, 49, 320 / (((1.4 * 20) / 45) * 1.75)]);
  look({ x: 6, z: 7 }, 10);
  expect(shown().width).toBe(320 / 3.5);
  expect(commits).toBe(commitsBefore);
  // Nothing over the tiles: every element the minimap holds is a tile's.
  const children = [...svg().children];
  expect(children.length).toBeGreaterThan(0);
  expect(children.every((child) => child.tagName === "g" && child.querySelector("polygon[fill]") !== null)).toBe(true);
});

it("opens on its own game's place once the last world map is gone, not where that one's camera looked", async () => {
  look({ x: 40, z: 40 }, 45);
  forgetCameraView();
  await show(EXPLORED);
  // No camera yet: the tiles' own middle, at the default distance's scale.
  expect(shown()).toEqual({ x: 0, y: 0, width: 320 / 2.45, height: 320 / 2.45 });
});

it("places the framing and the tiles about the same origin when the world origin moves", async () => {
  await show(revealed([64, 66]));
  setWorldOrigin({ col: 64, row: 0 });
  // A new origin rebuilds where the tiles stand: one render, as a jump across the map is one.
  await act(async () => look({ x: 0, z: 0 }));
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
  look({ x: 0, z: 9 });
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
    look({ x: 0, z: 0 });
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
