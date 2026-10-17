import { act, Profiler } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { HexMinimap, type MinimapTile } from "./hex-minimap";

// The minimap's markers and the game's synchronized configuration are not this test's business.
vi.mock("@/hooks/use-fact-view", () => ({ useFactView: () => new Map() }));
vi.mock("@/ui/config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/ui/config")>()),
  FELT_CENTER: () => 0,
}));

type Hex = { col: number; row: number };

/** Animation frames run only when the test steps them, 20 ms apart, with React's commits counted. */
let frames: Map<number, FrameRequestCallback>;
let serial: number;
let now: number;
let commits: number;
let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  frames = new Map();
  serial = 0;
  now = 0;
  commits = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++serial, callback);
    return serial;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  host = document.createElement("div");
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  vi.unstubAllGlobals();
});

const show = (tiles: MinimapTile[], camera: Hex, look: "badges" | "classic" = "badges") =>
  act(async () =>
    root.render(
      <Profiler id="minimap" onRender={() => commits++}>
        <HexMinimap tiles={tiles} selectedHex={null} navigationTarget={null} cameraTargetHex={camera} look={look} />
      </Profiler>,
    ),
  );

const step = async (count = 1) => {
  for (let index = 0; index < count; index++) {
    now += 20;
    const due = [...frames.values()];
    frames.clear();
    await act(async () => due.forEach((callback) => callback(now)));
  }
};

/** What 20 more frames with no input change: commits and frames still asked for. Zero both once settled. */
const idleWork = async () => {
  const before = commits;
  await step(20);
  return { commits: commits - before, frames: frames.size };
};

const shown = () => {
  const [minX, minY, width, height] = host.querySelector("svg")!.getAttribute("viewBox")!.split(" ").map(Number);
  return { x: minX + width / 2, y: minY + height / 2, width };
};

const revealed = (cols: number[], row = 0): MinimapTile[] => cols.map((col) => ({ col, row, biome: 11 }));
/** A known structure standing on a hex the player has not revealed: a marker, not terrain. */
const knownStructure = (col: number, row: number): MinimapTile => ({
  col,
  row,
  occupier_id: "123",
  occupier_type: 3,
  occupier_is_structure: true,
});
const EXPLORED = revealed([-6, -4, -2, 0, 2, 4, 6]);

it("fits the revealed terrain once it loads after mount, and settles while the camera stands elsewhere", async () => {
  await show([], { col: 6, row: 0 });
  await step();
  await show(EXPLORED, { col: 6, row: 0 });
  await step(100);
  expect(shown().x).toBeCloseTo(0, 0);
  expect(shown().y).toBeCloseTo(0, 0);
  expect(await idleWork()).toEqual({ commits: 0, frames: 0 });

  const fitted = host.querySelector("svg")!.getAttribute("viewBox");
  await show(EXPLORED, { col: -6, row: 0 });
  await step(100);
  expect(host.querySelector("svg")!.getAttribute("viewBox")).toBe(fitted);
  expect(await idleWork()).toEqual({ commits: 0, frames: 0 });
});

it("does not zoom out to a known structure on unrevealed terrain", async () => {
  await show(EXPLORED, { col: 0, row: 0 });
  await step(100);
  const fitted = host.querySelector("svg")!.getAttribute("viewBox");
  await show([...EXPLORED, knownStructure(30, 20)], { col: 0, row: 0 });
  await step(100);
  expect(host.querySelector("svg")!.getAttribute("viewBox")).toBe(fitted);
});

it("takes in remote terrain once it is revealed", async () => {
  await show(EXPLORED, { col: 0, row: 0 });
  await step(100);
  const before = shown();
  await show([...EXPLORED, ...revealed([20])], { col: 0, row: 0 });
  await step(100);
  expect(shown().width).toBeGreaterThan(before.width);
  expect(shown().x).toBeGreaterThan(before.x);
});

it("leaves the fit for the camera once the revealed terrain needs less than the readable scale, already there", async () => {
  // Where the camera is on the minimap: a classic minimap, which never fits, follows it there.
  await show(EXPLORED, { col: 6, row: 0 }, "classic");
  await step(100);
  const camera = shown();
  await act(async () => root.unmount());
  root = createRoot(host);

  await show(EXPLORED, { col: 6, row: 0 });
  await step(100);
  expect(shown().x).toBeCloseTo(0, 0);
  await show([...EXPLORED, ...revealed([-400, 400])], { col: 6, row: 0 });
  await step();
  expect(shown().x).toBeCloseTo(camera.x, 0);
  expect(shown().y).toBeCloseTo(camera.y, 0);
  expect(await idleWork()).toEqual({ commits: 0, frames: 0 });
});

it("gives the panel the fitted map's shape: wide for a wide revealed area, square-ish for a cross, none before any", async () => {
  const { fittedMapAspect } = await import("./hex-minimap");
  const wide = fittedMapAspect(revealed([-8, -6, -4, -2, 0, 2, 4, 6, 8]))!;
  const cross = fittedMapAspect(EXPLORED)!;
  expect(wide).toBeGreaterThan(cross);
  expect(wide).toBeGreaterThan(1);
  expect(fittedMapAspect([...EXPLORED, knownStructure(30, 20)])).toBe(cross);
  expect(fittedMapAspect([knownStructure(30, 20)])).toBeNull();
});
