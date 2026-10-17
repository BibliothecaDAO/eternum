import { act, Profiler } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { useUIStore } from "@/hooks/store/use-ui-store";
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
const EXPLORED = revealed([-6, -4, -2, 0, 2, 4, 6]);

/** The world camera's distance, as the world map publishes it. */
const cameraAt = (distance: number) => act(async () => useUIStore.setState({ cameraDistance: distance }));

it("follows the camera, centred on its hex, and settles there", async () => {
  await cameraAt(10);
  await show(EXPLORED, { col: 6, row: 0 }, "classic");
  await step(100);
  const east = shown();
  await act(async () => root.unmount());
  root = createRoot(host);

  await show(EXPLORED, { col: -6, row: 0 });
  await step(100);
  expect(shown().x).toBeCloseTo(-east.x, 0);
  await show(EXPLORED, { col: 6, row: 0 });
  await step(100);
  expect(shown().x).toBeCloseTo(east.x, 0);
  expect(shown().y).toBeCloseTo(east.y, 0);
  expect(await idleWork()).toEqual({ commits: 0, frames: 0 });
});

it("zooms with the camera: closer shows fewer hexes, down to its closest", async () => {
  const widthAt = async (distance: number) => {
    await cameraAt(distance);
    await step(2);
    return shown().width;
  };
  await show(EXPLORED, { col: 0, row: 0 });
  const far = await widthAt(20);
  const middle = await widthAt(16);
  const close = await widthAt(8);
  expect(far).toBeGreaterThan(middle);
  expect(middle).toBeGreaterThan(close);
  // Closer still, it holds: some seven hexes across a 320 px plate, more than the closest camera shows.
  expect(await widthAt(5)).toBe(close);
});

it("keeps the camera's zoom when remote terrain is revealed", async () => {
  await cameraAt(10);
  await show(EXPLORED, { col: 0, row: 0 });
  await step(100);
  const before = shown();
  await show([...EXPLORED, ...revealed([-400, 400])], { col: 0, row: 0 });
  await step(100);
  expect(shown()).toEqual(before);
});
