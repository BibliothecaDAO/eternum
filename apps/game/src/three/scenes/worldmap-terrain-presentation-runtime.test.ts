// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  applyWorldmapTerrainPresentation,
  composeWorldmapTerrainPresentations,
  createWorldmapTerrainPresentationState,
  resolveWorldmapVisualTerrainPageKeyForHex,
  resolveWorldmapVisualTerrainWindow,
  type WorldmapTerrainPresentation,
} from "./worldmap-terrain-presentation-runtime";

const presentation = (
  chunkKey: string,
  kind: "exact" | "provisional",
  transitionToken: number,
  cells: Array<{ col: number; row: number; biomeKey: string; instanceIndex: number; authoritative?: boolean }>,
): WorldmapTerrainPresentation<Record<string, true>, string> => ({
  chunkKey,
  kind,
  transitionToken,
  bounds: `${chunkKey}:bounds`,
  biomeEntries: { [chunkKey]: true },
  cells: cells.map((cell) => ({
    ...cell,
    authoritative: cell.authoritative ?? false,
  })),
});

describe("worldmap terrain presentation runtime", () => {
  it("resolves live tile writes to the visual page that owns the hex", () => {
    expect(
      resolveWorldmapVisualTerrainPageKeyForHex(
        { col: -25, row: 24 },
        { width: 24, height: 24 },
        { col: -24, row: -24 },
      ),
    ).toEqual({ pageKey: "24,-48", startCol: -48, startRow: 24 });
  });

  it("composes active exact, target provisional, and retained previous terrain without duplicate hexes", () => {
    const retainedPrevious = presentation("0,0", "exact", 7, [
      { col: 0, row: 0, biomeKey: "Grassland", instanceIndex: 0 },
      { col: 1, row: 0, biomeKey: "Grassland", instanceIndex: 1 },
    ]);
    const targetShell = presentation("24,0", "provisional", 8, [
      { col: 1, row: 0, biomeKey: "Outline", instanceIndex: 0 },
      { col: 2, row: 0, biomeKey: "Outline", instanceIndex: 1 },
    ]);
    const activeExact = presentation("24,0", "exact", 8, [
      { col: 1, row: 0, biomeKey: "Beach", instanceIndex: 0, authoritative: true },
    ]);

    const composite = composeWorldmapTerrainPresentations({
      authoritativeChunkKey: "24,0",
      maxCells: 10,
      presentations: [retainedPrevious, targetShell, activeExact],
      targetChunkKey: "24,0",
    });

    expect(
      composite.cells.map((cell) => [`${cell.col},${cell.row}`, cell.biomeKey, cell.presentationChunkKey]),
    ).toEqual([
      ["1,0", "Beach", "24,0"],
      ["2,0", "Outline", "24,0"],
      ["0,0", "Grassland", "0,0"],
    ]);
    expect(composite.cellsByBiome.get("Beach")?.[0].instanceIndex).toBe(0);
    expect(composite.cellsByBiome.get("Outline")?.[0].instanceIndex).toBe(0);
    expect(composite.cellsByBiome.get("Grassland")?.[0].instanceIndex).toBe(0);
  });

  it("caps composed terrain cells to the configured composite capacity", () => {
    const composite = composeWorldmapTerrainPresentations({
      authoritativeChunkKey: "24,0",
      maxCells: 2,
      presentations: [
        presentation("24,0", "exact", 8, [
          { col: 0, row: 0, biomeKey: "Beach", instanceIndex: 0, authoritative: true },
          { col: 1, row: 0, biomeKey: "Beach", instanceIndex: 1, authoritative: true },
          { col: 2, row: 0, biomeKey: "Beach", instanceIndex: 2, authoritative: true },
        ]),
      ],
      targetChunkKey: "24,0",
    });

    expect(composite.cells).toHaveLength(2);
    expect(composite.capped).toBe(true);
    expect(composite.droppedCellCount).toBe(1);
  });

  it("chooses the nearest visual page when the camera focus is near a hex edge", () => {
    const window = resolveWorldmapVisualTerrainWindow({
      focusPoint: { x: -2.61, z: -2.49 },
      generation: 1,
      hexSize: 1,
      marginPages: 0,
      pageOrigin: { col: 0, row: 0 },
      pageSize: { width: 1, height: 1 },
      renderSize: { width: 1, height: 1 },
    });

    expect(window.centerPageKey).toBe("-1,-1");
  });

  it("drops stale terrain shells and replaces provisional target terrain with exact authority", () => {
    const state = createWorldmapTerrainPresentationState<Record<string, true>, string>();

    const staleResult = applyWorldmapTerrainPresentation(state, {
      authoritativeChunkKey: "0,0",
      latestTransitionToken: 2,
      maxCompositeChunks: 3,
      nowMs: 100,
      presentation: presentation("24,0", "provisional", 1, [{ col: 1, row: 0, biomeKey: "Outline", instanceIndex: 0 }]),
      targetChunkKey: "24,0",
    });

    expect(staleResult).toBe("stale_dropped");
    expect(state.presentations).toEqual([]);

    applyWorldmapTerrainPresentation(state, {
      authoritativeChunkKey: "0,0",
      latestTransitionToken: 2,
      maxCompositeChunks: 3,
      nowMs: 100,
      presentation: presentation("24,0", "provisional", 2, [{ col: 1, row: 0, biomeKey: "Outline", instanceIndex: 0 }]),
      targetChunkKey: "24,0",
    });

    const exactResult = applyWorldmapTerrainPresentation(state, {
      authoritativeChunkKey: "24,0",
      latestTransitionToken: 2,
      maxCompositeChunks: 3,
      nowMs: 120,
      presentation: presentation("24,0", "exact", 2, [
        { col: 1, row: 0, biomeKey: "Beach", instanceIndex: 0, authoritative: true },
      ]),
      targetChunkKey: "24,0",
    });

    expect(exactResult).toBe("applied");
    expect(state.presentations.map((item) => [item.chunkKey, item.kind])).toEqual([["24,0", "exact"]]);
    const composite = composeWorldmapTerrainPresentations({
      authoritativeChunkKey: "24,0",
      maxCells: 10,
      nowMs: 120,
      presentations: state.presentations,
      targetChunkKey: "24,0",
    });
    expect(composite.cells.map((cell) => [`${cell.col},${cell.row}`, cell.biomeKey, cell.authoritative])).toEqual([
      ["1,0", "Beach", true],
    ]);
  });
});
