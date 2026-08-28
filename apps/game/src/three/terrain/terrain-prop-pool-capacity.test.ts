import { BiomeType } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";

import { TerrainField } from "./terrain-field";
import { prepareTerrainPropInstances } from "./terrain-props";
import {
  createTerrainBenchmarkFixture,
  createTerrainBenchmarkWindowInput,
} from "./verification/terrain-benchmark-fixture";
import { TERRAIN_PROP_POOL_CAPACITY } from "./terrain-prop-pools";
import { buildWorldmapTerrainPageRequests } from "./worldmap-procedural-terrain";

describe("terrain prop pool capacity", () => {
  it("holds balanced and homogeneous full-screen production windows without runtime buffer growth", () => {
    const fixture = createTerrainBenchmarkFixture();
    const balancedInput = createTerrainBenchmarkWindowInput(fixture, { col: -1, row: -1 });
    const inputs = [
      balancedInput,
      ...Object.values(BiomeType)
        .filter((biome) => biome !== BiomeType.None)
        .map((biome) => ({
          ...balancedInput,
          cells: balancedInput.cells.map((cell) => ({ ...cell, biomeKey: biome, occupied: false })),
        })),
    ];
    const maximumDemand = Math.max(...inputs.map(resolveMaximumArchetypeDemand));

    expect(maximumDemand).toBeGreaterThan(4_096);
    expect(maximumDemand).toBeLessThanOrEqual(TERRAIN_PROP_POOL_CAPACITY);
  });
});

function resolveMaximumArchetypeDemand(input: ReturnType<typeof createTerrainBenchmarkWindowInput>): number {
  const instances = buildWorldmapTerrainPageRequests(input).flatMap((request) =>
    prepareTerrainPropInstances(request, new TerrainField(request)),
  );
  const demandByArchetype = Object.groupBy(instances, ({ archetype }) => archetype);
  return Math.max(...Object.values(demandByArchetype).map((entries) => entries?.length ?? 0));
}
