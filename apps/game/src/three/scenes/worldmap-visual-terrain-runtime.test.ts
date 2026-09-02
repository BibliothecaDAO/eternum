// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  applyWorldmapVisualTerrainPage,
  composeWorldmapTerrainPresentations,
  createWorldmapTerrainPresentationState,
  partitionPreparedTerrainIntoVisualPages,
  resolveWorldmapVisualTerrainWindow,
  type WorldmapTerrainCellRef,
  type WorldmapTerrainPresentation,
} from "./worldmap-terrain-presentation-runtime";

const pagePresentation = (
  coverageKey: string,
  kind: "exact" | "provisional",
  generation: number,
  cells: Array<{ col: number; row: number; biomeKey: string; instanceIndex: number; authoritative?: boolean }>,
  authorityChunkKey: string | null = null,
): WorldmapTerrainPresentation<Record<string, true>, string> => ({
  chunkKey: authorityChunkKey ?? coverageKey,
  coverageKey,
  coverageKind: "visual_page",
  authorityChunkKey,
  kind,
  generation,
  transitionToken: generation,
  bounds: `${coverageKey}:bounds`,
  biomeEntries: { [coverageKey]: true },
  cells: cells.map((cell) => ({
    ...cell,
    authoritative: cell.authoritative ?? false,
  })),
});

describe("worldmap visual terrain runtime", () => {
  it("resolves a 48x48 camera window plus one 24x24 page margin into sixteen visual pages", () => {
    const window = resolveWorldmapVisualTerrainWindow({
      focusPoint: { x: 0, z: 0 },
      generation: 3,
      hexSize: 1,
      marginPages: 1,
      pageSize: { width: 24, height: 24 },
      renderSize: { width: 48, height: 48 },
    });

    expect(window.centerPageKey).toBe("0,0");
    expect(window.criticalPageKeys).toEqual(["0,0"]);
    expect(window.pageKeys).toHaveLength(16);
    expect(window.pageKeys).toEqual([
      "-24,-24",
      "-24,0",
      "-24,24",
      "-24,48",
      "0,-24",
      "0,0",
      "0,24",
      "0,48",
      "24,-24",
      "24,0",
      "24,24",
      "24,48",
      "48,-24",
      "48,0",
      "48,24",
      "48,48",
    ]);
  });

  it("composes exact authoritative pages ahead of target provisional and retained pages", () => {
    const retainedPrevious = pagePresentation("-24,0", "exact", 4, [
      { col: 0, row: 0, biomeKey: "Grassland", instanceIndex: 0 },
      { col: 1, row: 0, biomeKey: "Grassland", instanceIndex: 1 },
    ]);
    const targetShell = pagePresentation("0,0", "provisional", 5, [
      { col: 1, row: 0, biomeKey: "Outline", instanceIndex: 0 },
      { col: 2, row: 0, biomeKey: "Outline", instanceIndex: 1 },
    ]);
    const authoritativeExact = pagePresentation(
      "0,0",
      "exact",
      5,
      [{ col: 1, row: 0, biomeKey: "Beach", instanceIndex: 0, authoritative: true }],
      "0,0",
    );

    const composite = composeWorldmapTerrainPresentations({
      authoritativeChunkKey: "0,0",
      maxCells: 10,
      presentations: [retainedPrevious, targetShell, authoritativeExact],
      targetCoverageKeys: new Set(["0,0"]),
    });

    expect(composite.cells.map((cell) => [`${cell.col},${cell.row}`, cell.biomeKey, cell.coverageKey])).toEqual([
      ["1,0", "Beach", "0,0"],
      ["2,0", "Outline", "0,0"],
      ["0,0", "Grassland", "-24,0"],
    ]);
  });

  it("drops stale visual page generations without mutating active presentation state", () => {
    const state = createWorldmapTerrainPresentationState<Record<string, true>, string>();
    const staleResult = applyWorldmapVisualTerrainPage(state, {
      latestGeneration: 2,
      maxCompositePages: 16,
      presentation: pagePresentation("0,0", "provisional", 1, [
        { col: 0, row: 0, biomeKey: "Outline", instanceIndex: 0 },
      ]),
      targetCoverageKeys: new Set(["0,0"]),
    });

    expect(staleResult).toBe("stale_dropped");
    expect(state.presentations).toEqual([]);

    const currentResult = applyWorldmapVisualTerrainPage(state, {
      latestGeneration: 2,
      maxCompositePages: 16,
      presentation: pagePresentation("0,0", "provisional", 2, [
        { col: 0, row: 0, biomeKey: "Outline", instanceIndex: 0 },
      ]),
      targetCoverageKeys: new Set(["0,0"]),
    });

    expect(currentResult).toBe("applied");
    expect(state.presentations).toHaveLength(1);
  });

  it("drops stale transition-owned visual pages without mutating active presentation state", () => {
    const state = createWorldmapTerrainPresentationState<Record<string, true>, string>();
    const staleResult = applyWorldmapVisualTerrainPage(state, {
      latestGeneration: 2,
      latestTransitionToken: 3,
      maxCompositePages: 16,
      presentation: pagePresentation("0,0", "provisional", 2, [
        { col: 0, row: 0, biomeKey: "Outline", instanceIndex: 0 },
      ]),
      targetCoverageKeys: new Set(["0,0"]),
    });

    expect(staleResult).toBe("stale_dropped");
    expect(state.presentations).toEqual([]);
  });

  it("keeps the newly accepted page when a full visual window has equal-priority pages", () => {
    const state = createWorldmapTerrainPresentationState<Record<string, true>, string>();
    state.presentations = [
      pagePresentation("0,0", "provisional", 3, [{ col: 0, row: 0, biomeKey: "Outline", instanceIndex: 0 }]),
      pagePresentation("0,24", "provisional", 3, [{ col: 24, row: 0, biomeKey: "Outline", instanceIndex: 0 }]),
    ];

    const result = applyWorldmapVisualTerrainPage(state, {
      latestGeneration: 3,
      maxCompositePages: 2,
      presentation: pagePresentation("24,0", "provisional", 3, [
        { col: 0, row: 24, biomeKey: "Outline", instanceIndex: 0 },
      ]),
      targetCoverageKeys: new Set(["0,0", "0,24", "24,0"]),
    });

    expect(result).toBe("applied");
    expect(state.presentations.map((presentation) => presentation.coverageKey)).toContain("24,0");
    const composite = composeWorldmapTerrainPresentations({
      authoritativeChunkKey: null,
      maxCells: 10,
      presentations: state.presentations,
      targetCoverageKeys: new Set(["0,0", "0,24", "24,0"]),
    });
    expect(composite.cells.map((cell) => cell.coverageKey)).toContain("24,0");
  });

  it("partitions exact 48x48 prepared terrain into four 24x24 visual pages with page-local indices", () => {
    const cells: WorldmapTerrainCellRef[] = [];
    for (let row = -12; row < 36; row += 1) {
      for (let col = -12; col < 36; col += 1) {
        cells.push({
          col,
          row,
          biomeKey: "Grassland",
          instanceIndex: cells.length,
          authoritative: true,
        });
      }
    }

    const pages = partitionPreparedTerrainIntoVisualPages({
      authorityChunkKey: "0,0",
      biomeEntries: { exact: true },
      bounds: "bounds",
      cells,
      kind: "exact",
      pageOrigin: { row: -12, col: -12 },
      pageSize: { width: 24, height: 24 },
      transitionToken: 7,
    });

    expect(pages.map((page) => page.coverageKey).sort()).toEqual(["-12,-12", "-12,12", "12,-12", "12,12"]);
    expect(pages.every((page) => page.cells.length === 576)).toBe(true);
    expect(pages.find((page) => page.coverageKey === "12,12")?.cells[0]).toMatchObject({
      col: 12,
      row: 12,
      instanceIndex: 0,
    });
  });
});
