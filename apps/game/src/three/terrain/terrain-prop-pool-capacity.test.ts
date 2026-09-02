import { BiomeType } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";

import { TerrainField } from "./terrain-field";
import { TERRAIN_PROP_ARCHETYPE_IDS, type TerrainPropArchetypeId } from "./terrain-prop-catalog";
import { TERRAIN_PROP_PAGE_SLOT_CAPACITY } from "./terrain-prop-pools";
import { prepareTerrainPropInstances } from "./terrain-props";
import type { TerrainPageRequest } from "./terrain-types";
import { createTerrainBenchmarkFixture } from "./verification/terrain-benchmark-fixture";
import { buildWorldmapTerrainPageRequests } from "./worldmap-procedural-terrain";

const PAGE_SIZE = 24;
const PAGE_ORIGIN = { col: -12, row: -12 };
const HOMOGENEOUS_CENTER_PAGE_KEY = `${PAGE_ORIGIN.row},${PAGE_ORIGIN.col}`;

describe("terrain prop page slot capacity", () => {
  it("holds the densest balanced and homogeneous production pages with headroom, without runtime buffer growth", () => {
    const fixture = createTerrainBenchmarkFixture();
    const demand = new Map<TerrainPropArchetypeId, number>();
    const record = (request: TerrainPageRequest) => {
      for (const instance of prepareTerrainPropInstances(request, new TerrainField(request))) {
        demand.set(instance.archetype, (demand.get(instance.archetype) ?? 0) + 1);
      }
    };
    const maximum = new Map<TerrainPropArchetypeId, number>();
    const measure = (requests: readonly TerrainPageRequest[]) => {
      for (const request of requests) {
        demand.clear();
        record(request);
        demand.forEach((count, archetype) => maximum.set(archetype, Math.max(maximum.get(archetype) ?? 0, count)));
      }
    };

    measure(pageRequests(Array.from(fixture.pages.values()).flat(), fixture.climate));
    for (const biome of Object.values(BiomeType)) {
      if (biome === BiomeType.None) continue;
      const block = pageRequests(homogeneousBlockCells(biome), fixture.climate);
      measure(block.filter((request) => request.pageKey === HOMOGENEOUS_CENTER_PAGE_KEY));
    }

    for (const archetype of TERRAIN_PROP_ARCHETYPE_IDS) {
      const capacity = TERRAIN_PROP_PAGE_SLOT_CAPACITY[archetype];
      const densest = maximum.get(archetype) ?? 0;
      expect(densest, `${archetype} densest page`).toBeLessThanOrEqual(capacity);
      // Slots are drawn in full, so a slot far above its densest page is padding; re-measure the table instead.
      // The table carries 1.5× the maximum over these fixtures and eight climate seed pairs, so this floor
      // trips only after a density retune, not on seed variance.
      expect(densest, `${archetype} slot headroom`).toBeGreaterThanOrEqual(capacity * 0.4);
    }
  });
});

function pageRequests(
  cells: ReadonlyArray<{ biomeKey: string; col: number; occupied: boolean; row: number }>,
  climate: ReturnType<typeof createTerrainBenchmarkFixture>["climate"],
): TerrainPageRequest[] {
  return buildWorldmapTerrainPageRequests({
    cells,
    climate,
    mapCenter: 0,
    pageHeight: PAGE_SIZE,
    pageOrigin: PAGE_ORIGIN,
    pageWidth: PAGE_SIZE,
    subdivisions: 2,
  });
}

/** A 3×3-page block of one biome so the centre page sees the densest possible neighbourhood on every side. */
function homogeneousBlockCells(biome: BiomeType) {
  const span = PAGE_SIZE * 3;
  return Array.from({ length: span * span }, (_, index) => ({
    biomeKey: biome,
    col: PAGE_ORIGIN.col - PAGE_SIZE + (index % span),
    occupied: false,
    row: PAGE_ORIGIN.row - PAGE_SIZE + Math.floor(index / span),
  }));
}
