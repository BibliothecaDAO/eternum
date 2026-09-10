import { BiomeType } from "@bibliothecadao/types";
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from "three";
import { describe, expect, it, vi } from "vitest";
import { BiomeCreaturePopulation, wildlifeRegion } from "./creatures/biome-creature-population";
import { findNearestTerrainHex } from "./terrain-coordinates";
import { loadBiomeCreature } from "./creatures/biome-creature-assets";
import { TERRAIN_WATER_LEVEL } from "./terrain-water";
import { TerrainWildlife } from "./terrain-wildlife";
import type { TerrainCellInput } from "./terrain-types";

vi.mock("./creatures/biome-creature-assets", async (importOriginal) => {
  const original = await importOriginal<typeof import("./creatures/biome-creature-assets")>();
  return {
    ...original,
    loadBiomeCreature: vi.fn(async () => {
      const root = new Group();
      root.userData = { animation_schema: "biome-creature-v1", profile: "zebra" };
      const body = new Group();
      body.userData.joint = "body";
      body.add(new Mesh(new BoxGeometry(0.2, 0.2, 0.2), new MeshStandardMaterial()));
      root.add(body);
      return root;
    }),
  };
});

function cells(size = 24): TerrainCellInput[] {
  return Array.from({ length: size * size }, (_, i) => ({
    col: (i % size) - 8,
    row: Math.floor(i / size) - 8,
    biome: i % 2 ? BiomeType.Grassland : BiomeType.TemperateDeciduousForest,
    explored: true,
    occupied: false,
    previewBiome: null,
  }));
}

function assertDensity(population: BiomeCreaturePopulation) {
  const occupied = new Set<string>();
  const reserved = new Map<string, number>();
  for (const creature of population.creatures.values()) {
    const region = wildlifeRegion(findNearestTerrainHex(creature.x, creature.z));
    expect(occupied.has(region)).toBe(false);
    occupied.add(region);
    for (const end of [creature.cell, creature.target].filter(Boolean)) {
      const region = wildlifeRegion(end!);
      expect(reserved.get(region) ?? creature.id).toBe(creature.id);
      reserved.set(region, creature.id);
    }
  }
}

describe("biome creature population", () => {
  it("spawns once per aligned 8x8 region, including negative coordinates and overlapping pages", () => {
    const first = new BiomeCreaturePopulation();
    const second = new BiomeCreaturePopulation();
    first.sync(cells());
    second.sync([...cells(), ...cells()].reverse());
    expect([...first.creatures.values()]).toEqual([...second.creatures.values()]);
    expect(first.creatures.size).toBe(9);
    expect(wildlifeRegion({ col: -1, row: -8 })).toBe("-1:-1");
    assertDensity(first);
  });

  it("walks between biome tiles while maintaining the cap and preserving animals through page refresh", () => {
    const population = new BiomeCreaturePopulation();
    population.sync(cells());
    const initial = [...population.creatures.values()].map((creature) => ({ ...creature }));
    const visitedBiomes = new Map<number, Set<number>>();
    for (let i = 0; i < 2400; i++) {
      population.update(0.05);
      if (i % 40 === 0) {
        assertDensity(population);
        for (const creature of population.creatures.values()) {
          const seen = visitedBiomes.get(creature.id) ?? new Set();
          seen.add(creature.cell.col % 2);
          visitedBiomes.set(creature.id, seen);
        }
      }
    }
    expect([...visitedBiomes.values()].some((seen) => seen.size > 1)).toBe(true);
    expect(
      [...population.creatures.values()].some(
        (creature, i) => creature.x !== initial[i].x || creature.z !== initial[i].z,
      ),
    ).toBe(true);
    const before = [...population.creatures.values()];
    population.sync(cells().reverse());
    for (const creature of before) expect(population.creatures.get(creature.id)).toBe(creature);
    assertDensity(population);
  });

  it("does not spawn or traverse hidden, occupied or rejected terrain and releases removed pages", () => {
    const population = new BiomeCreaturePopulation(() => false);
    population.sync(cells());
    expect(population.creatures.size).toBe(0);
    const roaming = new BiomeCreaturePopulation();
    roaming.sync(cells().map((cell) => ({ ...cell, explored: false })));
    expect(roaming.creatures.size).toBe(0);
    roaming.sync(cells().map((cell) => ({ ...cell, occupied: true })));
    expect(roaming.creatures.size).toBe(0);
    roaming.sync(cells());
    expect(roaming.creatures.size).toBeGreaterThan(0);
    roaming.sync([]);
    expect(roaming.creatures.size).toBe(0);
  });

  it("keeps water species in water and land species on land across long roaming sessions", () => {
    const terrain = cells().map((cell) => ({ ...cell, biome: cell.col < 4 ? BiomeType.Ocean : BiomeType.Grassland }));
    const population = new BiomeCreaturePopulation();
    population.sync(terrain);
    for (let i = 0; i < 3000; i++) {
      population.update(0.05);
      for (const creature of population.creatures.values()) {
        expect(creature.cell.col < 4).toBe(creature.species === "green-sea-turtle");
        if (creature.target) expect(creature.target.col < 4).toBe(creature.species === "green-sea-turtle");
      }
    }
  });

  it("can enter a vacant neighboring region without letting a refresh double-spawn there", () => {
    const population = new BiomeCreaturePopulation();
    population.sync(cells());
    const survivor = [...population.creatures.values()][0];
    for (const id of population.creatures.keys()) if (id !== survivor.id) population.creatures.delete(id);
    const origin = wildlifeRegion(survivor.cell);
    let crossed = false;
    for (let step = 0; step < 20000 && !crossed; step++) {
      population.update(0.05);
      assertDensity(population);
      crossed = wildlifeRegion(survivor.cell) !== origin;
    }
    expect(crossed).toBe(true);
    population.sync(cells());
    expect(population.creatures.get(survivor.id)).toBe(survivor);
    assertDensity(population);
  });

  it("clamps resume gaps and caps the total population", () => {
    const first = new BiomeCreaturePopulation(),
      second = new BiomeCreaturePopulation();
    first.sync(cells(64));
    second.sync(cells(64));
    expect(first.creatures.size).toBe(32);
    first.update(1000);
    second.update(0.05);
    expect([...first.creatures.values()]).toEqual([...second.creatures.values()]);
  });
});

describe("terrain wildlife lifecycle", () => {
  it("disposes a model that finishes loading after its terrain has been released", async () => {
    const template = await loadBiomeCreature("plains-zebra", () => {});
    const mesh = template.children[0].children[0] as Mesh;
    const disposeGeometry = vi.spyOn(mesh.geometry, "dispose");
    let finish!: (root: Group) => void;
    vi.mocked(loadBiomeCreature).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const wildlife = new TerrainWildlife(
      () => ({ biome: BiomeType.Grassland, height: 0, normal: [0, 1, 0] }),
      () => {},
    );
    wildlife.sync(
      cells().map((cell) => ({ ...cell, biome: BiomeType.Grassland })),
      [],
    );
    const loading = wildlife.load();
    wildlife.dispose();
    finish(template);
    await loading;
    expect(disposeGeometry).toHaveBeenCalledOnce();
    expect(wildlife.getStats().loaded).toBe(0);
    expect(wildlife.object3d.children).toHaveLength(0);
  });

  it("shares templates, gives every animal its own joints, freezes hidden wildlife and clears released views", async () => {
    const wildlife = new TerrainWildlife(
      () => ({ biome: BiomeType.Grassland, height: 0, normal: [0, 1, 0] }),
      () => {},
    );
    wildlife.sync(cells(), []);
    await wildlife.load();
    expect(wildlife.getStats().loaded).toBe(9);
    expect(wildlife.object3d.children[0].children[0]).not.toBe(wildlife.object3d.children[1].children[0]);
    const before = wildlife.getStats();
    wildlife.object3d.visible = false;
    wildlife.update(20);
    expect(wildlife.getStats().creatures).toEqual(before.creatures);
    wildlife.sync([], []);
    expect(wildlife.getStats().loaded).toBe(0);
    wildlife.dispose();
    expect(wildlife.object3d.children).toHaveLength(0);
  });
});

it.each([BiomeType.DeepOcean, BiomeType.Ocean])(
  "keeps aquatic wildlife partly submerged in biome %s",
  async (biome) => {
    const wildlife = new TerrainWildlife(
      () => ({ biome, height: TERRAIN_WATER_LEVEL, normal: [0, 1, 0] }),
      () => {},
    );
    try {
      wildlife.sync(
        cells().map((cell) => ({ ...cell, biome })),
        [],
      );
      await wildlife.load();
      expect(wildlife.object3d.children.length).toBeGreaterThan(0);
      for (let frame = 0; frame < 20; frame++) {
        wildlife.update(0.05);
        for (const creature of wildlife.object3d.children) {
          expect(creature.position.y).toBeLessThan(TERRAIN_WATER_LEVEL);
        }
      }
    } finally {
      wildlife.dispose();
    }
  },
);
