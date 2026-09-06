import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const { resolveBiome, mode, store } = vi.hoisted(() => ({
  resolveBiome: vi.fn((id: number) => id),
  mode: { assets: { labels: { fragmentMine: "mine.png" } } },
  store: { playerStructures: [], selectableArmies: [], cameraDistance: 20 },
}));
vi.mock("@/config/game-modes/use-game-mode-config", () => ({ useGameModeConfig: () => mode }));
vi.mock("@/hooks/store/use-ui-store", () => ({
  useUIStore: (select: (state: typeof store) => unknown) => select(store),
}));
vi.mock("@/ui/config", () => ({ FELT_CENTER: () => 0 }));
vi.mock("@/three/managers/biome-colors", () => ({
  resolveBiomeTypeFromId: resolveBiome,
  requireBiomeColor: (id: number) => ({ getStyle: () => (id === 1 ? "red" : "blue") }),
}));
vi.mock("@bibliothecadao/eternum", () => ({
  getExplorerInfoFromTileOccupier: () => null,
  getStructureInfoFromTileOccupier: () => null,
  hasTileOccupier: () => false,
  isTileOccupierReservedHyperstructure: () => false,
  isTileOccupierStructure: () => false,
}));

import { HexMinimap } from "./hex-minimap";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it("reuses unchanged tile elements while following the camera and still applies new tile facts immediately", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const frames = new Map<number, FrameRequestCallback>();
  let id = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (frame: number) => frames.delete(frame));
  let timestamp = 0;
  const tick = async () => {
    const pending = [...frames.values()];
    frames.clear();
    await act(async () => pending.forEach((fn) => fn((timestamp += 20))));
  };
  const host = document.createElement("div");
  const root = createRoot(host);
  let tiles = [{ col: 0, row: 0, biome: 1 }];
  const render = async (col: number) =>
    act(async () =>
      root.render(
        <HexMinimap tiles={tiles} selectedHex={null} navigationTarget={null} cameraTargetHex={{ col, row: 0 }} />,
      ),
    );
  try {
    await render(0);
    await tick();
    const originalView = host.querySelector("svg")!.getAttribute("viewBox");
    resolveBiome.mockClear();
    await render(1);
    await tick();
    expect(host.querySelector("svg")!.getAttribute("viewBox")).not.toBe(originalView);
    expect(resolveBiome).not.toHaveBeenCalled();
    tiles = [{ col: 0, row: 0, biome: 2 }];
    await render(1);
    expect(host.querySelector("polygon")!.getAttribute("fill")).toBe("blue");
  } finally {
    await act(async () => root.unmount());
  }
  expect(frames.size).toBe(0);
});
