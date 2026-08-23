import { describe, expect, it } from "vitest";

import {
  TERRAIN_BENCHMARK_CELL_COLUMNS,
  TERRAIN_BENCHMARK_CELL_ROWS,
  TERRAIN_BENCHMARK_PAGE_COLUMNS,
  TERRAIN_BENCHMARK_PAGE_ROWS,
  TERRAIN_BENCHMARK_PAGE_SIZE,
  TERRAIN_BENCHMARK_WINDOW_COLUMNS,
  TERRAIN_BENCHMARK_WINDOW_ROWS,
  createTerrainBenchmarkFixture,
  createTerrainBenchmarkLifecycleWaypoints,
  createTerrainBenchmarkMotionWaypoints,
  createTerrainBenchmarkWindowInput,
  resolveTerrainBenchmarkPageWindow,
} from "./terrain-benchmark-fixture";

describe("terrain benchmark fixture", () => {
  it("creates a deterministic traversal world with a one-page coverage guard band", () => {
    const first = createTerrainBenchmarkFixture();
    const second = createTerrainBenchmarkFixture();
    const cells = Array.from(first.pages.values()).flat();

    expect(first.pages.size).toBe(TERRAIN_BENCHMARK_PAGE_COLUMNS * TERRAIN_BENCHMARK_PAGE_ROWS);
    expect(cells).toHaveLength(TERRAIN_BENCHMARK_CELL_COLUMNS * TERRAIN_BENCHMARK_CELL_ROWS);
    expect(new Set(cells.map(({ biomeKey }) => biomeKey))).toHaveLength(16);
    expect(first).toEqual(second);
  });

  it("resolves exactly twelve production-sized pages around every focus", () => {
    const fixture = createTerrainBenchmarkFixture();
    const expectedPages = TERRAIN_BENCHMARK_WINDOW_COLUMNS * TERRAIN_BENCHMARK_WINDOW_ROWS;
    const expectedCells = expectedPages * TERRAIN_BENCHMARK_PAGE_SIZE ** 2;

    for (const focus of [
      { col: -5, row: -5 },
      { col: 0, row: 0 },
      { col: 4, row: 4 },
    ]) {
      expect(resolveTerrainBenchmarkPageWindow(focus)).toHaveLength(expectedPages);
      expect(createTerrainBenchmarkWindowInput(fixture, focus).cells).toHaveLength(expectedCells);
      expect(createTerrainBenchmarkWindowInput(fixture, focus, { densityMultiplier: 2 }).propDensityMultiplier).toBe(2);
    }
  });

  it("crosses twelve boundaries and traverses every source page once", () => {
    const motion = createTerrainBenchmarkMotionWaypoints();
    const structuralMotion = createTerrainBenchmarkMotionWaypoints("structural");
    const lifecycle = createTerrainBenchmarkLifecycleWaypoints();

    expect(motion).toHaveLength(13);
    expect(structuralMotion).toEqual(motion.filter((_, index) => index % 2 === 0));
    expect(structuralMotion).toHaveLength(7);
    expect(lifecycle).toHaveLength(100);
    expect(new Set(lifecycle.map(({ col, row }) => `${row},${col}`))).toHaveLength(100);
  });

  it("creates a stable mixed exploration frontier without changing window coverage", () => {
    const fixture = createTerrainBenchmarkFixture();
    const explored = createTerrainBenchmarkWindowInput(fixture, { col: 0, row: 0 }, { explorationMode: "explored" });
    const frontier = createTerrainBenchmarkWindowInput(fixture, { col: 0, row: 0 }, { explorationMode: "frontier" });

    expect(frontier.cells).toHaveLength(explored.cells.length);
    expect(frontier.cells.some(({ biomeKey }) => biomeKey === "Outline")).toBe(true);
    expect(frontier.cells.some(({ biomeKey }) => biomeKey !== "Outline")).toBe(true);
    expect(createTerrainBenchmarkWindowInput(fixture, { col: 0, row: 0 }, { explorationMode: "frontier" })).toEqual(
      frontier,
    );
  });
});
